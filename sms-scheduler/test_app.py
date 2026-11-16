import os
import random
import tempfile
import time
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

import app

NY = ZoneInfo("America/New_York")
CSV = ("name,phone,consent,appointment\n"
       "Jordan Rivera,(202) 555-0143,yes,Tuesday 2pm\n"
       "Casey Nguyen,202-555-0178,yes,Wednesday 10am\n"
       "Morgan Patel,+1 202 555 0111,no,Friday 4pm\n"
       "Dup,2025550143,yes,x\n"
       "Bad,12345,yes,x\n")


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        app.DB_PATH = os.path.join(self.tmp.name, "t.sqlite3")
        app.init_db()

    def tearDown(self):
        self.tmp.cleanup()

    def add_sender(self, cap=100, label="P"):
        with app.db() as c:
            return c.execute(
                "INSERT INTO senders (label, kind, daily_cap) VALUES (?, 'dry_run', ?)",
                (label, cap)).lastrowid

    def messages(self):
        with app.db() as c:
            return [dict(r) for r in c.execute("SELECT * FROM messages ORDER BY scheduled_at")]


class ParsingTests(Base):
    def test_normalize_phone(self):
        self.assertEqual(app.normalize_phone("(202) 555-0143"), "+12025550143")
        self.assertEqual(app.normalize_phone("1-202-555-0143"), "+12025550143")
        self.assertIsNone(app.normalize_phone("555-0143"))
        self.assertIsNone(app.normalize_phone("+44 20 7946 0958"))
        self.assertIsNone(app.normalize_phone(None))

    def test_parse_skips_bad_rows(self):
        clients, problems = app.parse_clients(CSV)
        self.assertEqual([c["phone"] for c in clients], ["+12025550143", "+12025550178"])
        self.assertEqual(len(problems), 3)  # no consent, duplicate, invalid

    def test_parse_without_header(self):
        clients, _ = app.parse_clients("Jordan,2025550143\nCasey,2025550178\n")
        self.assertEqual(len(clients), 2)
        self.assertEqual(clients[0]["name"], "Jordan")

    def test_render(self):
        clients, _ = app.parse_clients(CSV)
        text = app.render("Hi {first_name}, see you {appointment}. {nope}", clients[0])
        self.assertEqual(text, "Hi Jordan, see you Tuesday 2pm.")


class ScheduleTests(Base):
    def test_slots_stay_in_window_and_in_order(self):
        slots = app.compute_slots(50, 1000, 37000, random.Random(1))
        self.assertEqual(len(slots), 50)
        self.assertEqual(slots, sorted(slots))
        self.assertTrue(all(1000 <= s <= 37000 for s in slots))

    def test_window_clamped_to_allowed_hours(self):
        now = datetime(2026, 11, 16, 6, 0, tzinfo=NY)
        start, end = app.resolve_window("05:00", "23:30", now=now, zone=NY)
        self.assertEqual((start.hour, end.hour), (8, 21))

    def test_window_rolls_to_tomorrow(self):
        now = datetime(2026, 11, 16, 20, 58, tzinfo=NY)
        start, _ = app.resolve_window("09:00", "21:00", now=now, zone=NY)
        self.assertEqual((start.day, start.hour), (17, 9))

    def test_campaign_sends_through_the_day(self):
        self.add_sender(label="A")
        self.add_sender(label="B")
        now = datetime(2026, 11, 16, 7, 0, tzinfo=NY)
        r = app.create_campaign("t", CSV, "Hi {first_name}", "09:00", "17:00", now=now)
        self.assertEqual(r["count"], 2)
        msgs = self.messages()
        self.assertEqual(len({m["sender_id"] for m in msgs}), 2)  # shared across phones
        self.assertTrue(msgs[0]["body"].endswith("Reply STOP to opt out."))

        before = datetime(2026, 11, 16, 8, 30, tzinfo=NY).timestamp()
        self.assertEqual(app.run_due(now=before), 0)  # nothing due yet
        after = datetime(2026, 11, 16, 17, 1, tzinfo=NY).timestamp()
        self.assertEqual(app.run_due(now=after), 2)
        self.assertEqual({m["status"] for m in self.messages()}, {"sent"})
        with app.db() as c:
            self.assertEqual(c.execute("SELECT status FROM campaigns").fetchone()[0], "done")

    def test_nothing_sends_at_night(self):
        self.add_sender()
        now = datetime(2026, 11, 16, 7, 0, tzinfo=NY)
        app.create_campaign("t", CSV, "Hi", "09:00", "17:00", now=now)
        night = datetime(2026, 11, 16, 23, 0, tzinfo=NY).timestamp()
        self.assertEqual(app.run_due(now=night), 0)

    def test_one_phone_pauses_between_texts(self):
        self.add_sender()
        now = datetime(2026, 11, 16, 7, 0, tzinfo=NY)
        app.create_campaign("t", CSV, "Hi", "09:00", "17:00", now=now)
        t = datetime(2026, 11, 16, 17, 1, tzinfo=NY).timestamp()
        self.assertEqual(app.run_due(now=t), 1)
        self.assertEqual(app.run_due(now=t + 5), 0)
        self.assertEqual(app.run_due(now=t + app.MIN_GAP_SECONDS + 1), 1)

    def test_daily_limit_blocks_oversized_list(self):
        self.add_sender(cap=1)
        with self.assertRaises(ValueError):
            app.create_campaign("t", CSV, "Hi", "09:00", "17:00")

    def test_needs_a_phone(self):
        with self.assertRaises(ValueError):
            app.create_campaign("t", CSV, "Hi", "09:00", "17:00")


class OptOutTests(Base):
    def test_stop_reply_skips_pending_and_future_sends(self):
        self.add_sender()
        now = datetime(2026, 11, 16, 7, 0, tzinfo=NY)
        app.create_campaign("t", CSV, "Hi", "09:00", "17:00", now=now)
        app.handle_inbound({"event": "sms:received", "payload": {
            "message": " Stop. ", "phoneNumber": "+12025550143"}})
        by_phone = {m["phone"]: m["status"] for m in self.messages()}
        self.assertEqual(by_phone["+12025550143"], "skipped")
        self.assertEqual(by_phone["+12025550178"], "pending")
        r = app.create_campaign("t2", CSV, "Hi", "09:00", "17:00", now=now)
        self.assertEqual(r["count"], 1)

    def test_ordinary_reply_is_not_an_opt_out(self):
        app.handle_inbound({"payload": {"message": "please don't stop by before 5",
                                        "phoneNumber": "+12025550143"}})
        with app.db() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM optouts").fetchone()[0], 0)


if __name__ == "__main__":
    unittest.main()
