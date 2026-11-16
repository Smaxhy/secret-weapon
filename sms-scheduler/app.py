#!/usr/bin/env python3
"""Client text scheduler.

Upload a client list (CSV), connect your own phones, and the app drips a
personalised text to each client across the day.

Runs on the Python standard library only:  python3 app.py
"""
import base64
import contextlib
import csv
import io
import json
import os
import random
import re
import secrets
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("SMS_DB", os.path.join(HERE, "data.sqlite3"))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
APP_PASSWORD = os.environ.get("APP_PASSWORD", "")

# Texts are never sent outside these hours (in the configured time zone).
QUIET_START_HOUR = 8   # earliest send 08:00
QUIET_END_HOUR = 21    # latest send 21:00
MIN_GAP_SECONDS = 20   # minimum pause between two texts from the same phone
STOP_WORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit", "remove"}
YES_WORDS = {"yes", "y", "true", "1", "x", "ok", "opted in", "opt-in", "optin"}
TIMEZONES = [
    "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix",
    "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu",
]

_lock = threading.RLock()


# ---------------------------------------------------------------- database

@contextlib.contextmanager
def db():
    """Open the database; commit on success, roll back on error, always close."""
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    with _lock, db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS senders (
            id INTEGER PRIMARY KEY, label TEXT, kind TEXT, url TEXT,
            username TEXT, password TEXT, from_number TEXT,
            daily_cap INTEGER DEFAULT 100, last_sent_at REAL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY, name TEXT, template TEXT, status TEXT,
            window_start REAL, window_end REAL, created_at REAL);
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY, campaign_id INTEGER, phone TEXT, name TEXT,
            body TEXT, sender_id INTEGER, scheduled_at REAL, status TEXT,
            error TEXT, sent_at REAL);
        CREATE INDEX IF NOT EXISTS idx_due ON messages(status, scheduled_at);
        CREATE TABLE IF NOT EXISTS optouts (
            phone TEXT PRIMARY KEY, reason TEXT, added_at REAL);
        """)
        if not c.execute("SELECT 1 FROM settings WHERE key='webhook_token'").fetchone():
            c.execute("INSERT INTO settings VALUES ('webhook_token', ?)",
                      (secrets.token_urlsafe(24),))
        c.execute("INSERT OR IGNORE INTO settings VALUES ('timezone', 'America/New_York')")


def get_setting(key):
    with _lock, db() as c:
        row = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None


def tz():
    return ZoneInfo(get_setting("timezone") or "America/New_York")


# ------------------------------------------------------------- client list

def normalize_phone(raw):
    """Return a US number as +1XXXXXXXXXX, or None if it isn't one."""
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] in "01" or digits[3] in "01":
        return None
    return "+1" + digits


PHONE_HEADERS = ("phone", "phone number", "phonenumber", "mobile", "cell",
                 "cell phone", "number", "tel", "telephone")
NAME_HEADERS = ("name", "full name", "client", "client name", "first name",
                "firstname", "first_name")
CONSENT_HEADERS = ("consent", "opt in", "opt-in", "optin", "opted in", "sms consent")


def parse_clients(text):
    """Parse CSV text -> (clients, problems).

    Each client is a dict of lower-cased column -> value plus 'phone' (E.164)
    and 'name'. Rows without a usable phone, without consent (when the sheet
    has a consent column) or duplicated are reported in problems.
    """
    text = (text or "").lstrip("﻿")
    if not text.strip():
        return [], ["The file is empty."]
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    rows = [r for r in rows if any(cell.strip() for cell in r)]
    if not rows:
        return [], ["The file is empty."]

    header = [h.strip().lower() for h in rows[0]]
    phone_col = next((h for h in PHONE_HEADERS if h in header), None)
    if phone_col is None:
        # No header row: guess that the first column holding a phone is it.
        idx = next((i for i, cell in enumerate(rows[0]) if normalize_phone(cell)), None)
        if idx is None:
            return [], ["Couldn't find a phone column. Add a header row with a "
                        "column called 'phone'."]
        header = ["col%d" % (i + 1) for i in range(len(rows[0]))]
        header[idx] = "phone"
        if idx != 0:
            header[0] = "name"
        elif len(header) > 1:
            header[1] = "name"
        phone_col, body = "phone", rows
        first_line = 1
    else:
        body, first_line = rows[1:], 2
    name_col = next((h for h in NAME_HEADERS if h in header), None)
    consent_col = next((h for h in CONSENT_HEADERS if h in header), None)

    clients, problems, seen = [], [], set()
    for n, row in enumerate(body, start=first_line):
        rec = {h: (row[i].strip() if i < len(row) else "") for i, h in enumerate(header)}
        phone = normalize_phone(rec.get(phone_col, ""))
        if not phone:
            problems.append("Row %d: '%s' is not a valid US number — skipped."
                            % (n, rec.get(phone_col, "")))
            continue
        if consent_col and rec.get(consent_col, "").lower() not in YES_WORDS:
            problems.append("Row %d: no consent recorded — skipped." % n)
            continue
        if phone in seen:
            problems.append("Row %d: duplicate of %s — skipped." % (n, phone))
            continue
        seen.add(phone)
        rec["phone"] = phone
        rec["name"] = rec.get(name_col, "") if name_col else ""
        rec.setdefault("first_name", rec["name"].split(" ")[0] if rec["name"] else "")
        clients.append(rec)
    return clients, problems


def render(template, client):
    """Fill {column} placeholders from the client's row."""
    def sub(m):
        return client.get(m.group(1).strip().lower().replace("_", " "),
                          client.get(m.group(1).strip().lower(), ""))
    text = re.sub(r"\{([^{}]+)\}", sub, template)
    return re.sub(r"[ \t]{2,}", " ", text).strip()


# -------------------------------------------------------------- scheduling

def parse_hhmm(s):
    h, m = s.split(":")
    return int(h), int(m)


def resolve_window(start_hhmm, end_hhmm, now=None, zone=None):
    """Turn 'HH:MM' start/end into concrete datetimes for today (or tomorrow
    if today's window is already over). Clamped to the allowed sending hours."""
    zone = zone or tz()
    now = now or datetime.now(zone)
    sh, sm = parse_hhmm(start_hhmm)
    eh, em = parse_hhmm(end_hhmm)
    if (sh, sm) < (QUIET_START_HOUR, 0):
        sh, sm = QUIET_START_HOUR, 0
    if (eh, em) > (QUIET_END_HOUR, 0):
        eh, em = QUIET_END_HOUR, 0
    if (eh, em) <= (sh, sm):
        raise ValueError("The end time must be after the start time "
                         "(allowed hours are 8:00am to 9:00pm).")
    day = now.date()
    for _ in range(2):
        start = datetime(day.year, day.month, day.day, sh, sm, tzinfo=zone)
        end = datetime(day.year, day.month, day.day, eh, em, tzinfo=zone)
        start = max(start, now + timedelta(seconds=30))
        if (end - start).total_seconds() >= 300:
            return start, end
        day = day + timedelta(days=1)
        now = datetime(day.year, day.month, day.day, 0, 0, tzinfo=zone)
    raise ValueError("Could not find a sending window.")


def compute_slots(n, start_ts, end_ts, rng=random):
    """n send times spread across the window: evenly spaced, each nudged by a
    random amount so they don't land on a robotic fixed interval."""
    if n <= 0:
        return []
    step = (end_ts - start_ts) / n
    return [start_ts + i * step + rng.uniform(0, step * 0.8) for i in range(n)]


def day_bounds(ts, zone):
    d = datetime.fromtimestamp(ts, zone)
    start = datetime(d.year, d.month, d.day, tzinfo=zone)
    return start.timestamp(), (start + timedelta(days=1)).timestamp()


def create_campaign(name, csv_text, template, start_hhmm, end_hhmm,
                    footer=True, now=None):
    if not template.strip():
        raise ValueError("Write a message first.")
    clients, problems = parse_clients(csv_text)
    zone = tz()
    start, end = resolve_window(start_hhmm, end_hhmm, now=now, zone=zone)
    with _lock, db() as c:
        opted = {r["phone"] for r in c.execute("SELECT phone FROM optouts")}
        kept = []
        for cl in clients:
            if cl["phone"] in opted:
                problems.append("%s opted out — skipped." % cl["phone"])
            else:
                kept.append(cl)
        if not kept:
            raise ValueError("No one left to text. " + " ".join(problems[:5]))

        senders = c.execute("SELECT * FROM senders ORDER BY id").fetchall()
        if not senders:
            raise ValueError("Connect at least one phone first.")
        lo, hi = day_bounds(start.timestamp(), zone)
        room = {}
        for s in senders:
            used = c.execute(
                "SELECT COUNT(*) n FROM messages WHERE sender_id=? AND "
                "status IN ('pending','sent') AND scheduled_at>=? AND scheduled_at<?",
                (s["id"], lo, hi)).fetchone()["n"]
            room[s["id"]] = max(0, s["daily_cap"] - used)
        capacity = sum(room.values())
        if capacity < len(kept):
            raise ValueError(
                "Your phones can send %d more texts that day but the list has %d. "
                "Connect another phone, raise a daily limit, or split the list."
                % (capacity, len(kept)))

        slots = compute_slots(len(kept), start.timestamp(), end.timestamp())
        random.shuffle(kept)
        cur = c.execute(
            "INSERT INTO campaigns (name, template, status, window_start, window_end, "
            "created_at) VALUES (?,?,?,?,?,?)",
            (name.strip() or "Campaign", template, "scheduled",
             start.timestamp(), end.timestamp(), time.time()))
        cid = cur.lastrowid
        order = [s["id"] for s in senders]
        i = 0
        for cl, when in zip(kept, slots):
            while room[order[i % len(order)]] <= 0:
                i += 1
            sid = order[i % len(order)]
            room[sid] -= 1
            i += 1
            body = render(template, cl)
            if footer:
                body += "\nReply STOP to opt out."
            c.execute(
                "INSERT INTO messages (campaign_id, phone, name, body, sender_id, "
                "scheduled_at, status) VALUES (?,?,?,?,?,?, 'pending')",
                (cid, cl["phone"], cl["name"], body, sid, when))
    return {"id": cid, "count": len(kept), "problems": problems,
            "start": start.isoformat(), "end": end.isoformat()}


# ----------------------------------------------------------------- sending

def http_post(url, data, headers, user, password):
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    token = base64.b64encode(("%s:%s" % (user, password)).encode()).decode()
    req.add_header("Authorization", "Basic " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def send_sms(sender, to, body):
    """Hand one text to a sender. Returns None on success or an error string."""
    kind = sender["kind"]
    try:
        if kind == "dry_run":
            print("[dry run] %s -> %s: %s" % (sender["label"], to, body), flush=True)
            return None
        if kind == "android":
            url = sender["url"].rstrip("/")
            if not url.endswith("/message"):
                url += "/message"
            payload = json.dumps({"textMessage": {"text": body},
                                  "phoneNumbers": [to]}).encode()
            status, text = http_post(url, payload,
                                     {"Content-Type": "application/json"},
                                     sender["username"], sender["password"])
        elif kind == "twilio":
            url = ("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json"
                   % urllib.parse.quote(sender["username"]))
            payload = urllib.parse.urlencode(
                {"From": sender["from_number"], "To": to, "Body": body}).encode()
            status, text = http_post(
                url, payload, {"Content-Type": "application/x-www-form-urlencoded"},
                sender["username"], sender["password"])
        else:
            return "Unknown sender type: %s" % kind
        if 200 <= status < 300:
            return None
        return "HTTP %d: %s" % (status, text[:200])
    except Exception as e:  # network errors, bad URL, timeouts
        return "%s: %s" % (type(e).__name__, e)


def run_due(now=None):
    """Send every message that is due. Called every few seconds."""
    zone = tz()
    now = now or time.time()
    local = datetime.fromtimestamp(now, zone)
    if not (QUIET_START_HOUR <= local.hour < QUIET_END_HOUR):
        return 0
    sent = 0
    with _lock, db() as c:
        due = c.execute(
            "SELECT m.* FROM messages m JOIN campaigns k ON k.id=m.campaign_id "
            "WHERE m.status='pending' AND m.scheduled_at<=? AND k.status='scheduled' "
            "ORDER BY m.scheduled_at LIMIT 50", (now,)).fetchall()
        busy = set()
        for m in due:
            if c.execute("SELECT 1 FROM optouts WHERE phone=?", (m["phone"],)).fetchone():
                c.execute("UPDATE messages SET status='skipped', error='opted out' "
                          "WHERE id=?", (m["id"],))
                continue
            s = c.execute("SELECT * FROM senders WHERE id=?", (m["sender_id"],)).fetchone()
            if s is None:
                c.execute("UPDATE messages SET status='failed', "
                          "error='its phone was removed' WHERE id=?", (m["id"],))
                continue
            if s["id"] in busy or now - (s["last_sent_at"] or 0) < MIN_GAP_SECONDS:
                continue  # keep a pause between texts from one phone
            busy.add(s["id"])
            err = send_sms(s, m["phone"], m["body"])
            if err:
                c.execute("UPDATE messages SET status='failed', error=? WHERE id=?",
                          (err, m["id"]))
            else:
                c.execute("UPDATE messages SET status='sent', sent_at=?, error=NULL "
                          "WHERE id=?", (now, m["id"]))
                sent += 1
            c.execute("UPDATE senders SET last_sent_at=? WHERE id=?", (now, s["id"]))
        c.execute(
            "UPDATE campaigns SET status='done' WHERE status='scheduled' AND NOT EXISTS "
            "(SELECT 1 FROM messages WHERE campaign_id=campaigns.id AND status='pending')")
    return sent


def scheduler_loop():
    while True:
        try:
            run_due()
        except Exception as e:
            print("scheduler error:", e, flush=True)
        time.sleep(5)


def add_optout(phone, reason):
    with _lock, db() as c:
        c.execute("INSERT OR IGNORE INTO optouts VALUES (?,?,?)",
                  (phone, reason, time.time()))
        c.execute("UPDATE messages SET status='skipped', error='opted out' "
                  "WHERE phone=? AND status='pending'", (phone,))


def handle_inbound(payload):
    """Incoming-text webhook from the phone app. Opt the sender out on STOP."""
    events = payload if isinstance(payload, list) else [payload]
    for ev in events:
        p = ev.get("payload", ev) if isinstance(ev, dict) else {}
        text = (p.get("message") or p.get("Body") or "").strip().lower()
        phone = normalize_phone(p.get("phoneNumber") or p.get("From") or "")
        if phone and text.strip(" .!") in STOP_WORDS:
            add_optout(phone, "replied STOP")


# --------------------------------------------------------------------- api

def state():
    zone = tz()
    with _lock, db() as c:
        lo, hi = day_bounds(time.time(), zone)
        senders = []
        for s in c.execute("SELECT * FROM senders ORDER BY id"):
            used = c.execute(
                "SELECT COUNT(*) n FROM messages WHERE sender_id=? AND status='sent' "
                "AND sent_at>=? AND sent_at<?", (s["id"], lo, hi)).fetchone()["n"]
            senders.append({"id": s["id"], "label": s["label"], "kind": s["kind"],
                            "url": s["url"], "from_number": s["from_number"],
                            "daily_cap": s["daily_cap"], "sent_today": used})
        campaigns = []
        for k in c.execute("SELECT * FROM campaigns ORDER BY id DESC LIMIT 30"):
            counts = {r["status"]: r["n"] for r in c.execute(
                "SELECT status, COUNT(*) n FROM messages WHERE campaign_id=? "
                "GROUP BY status", (k["id"],))}
            nxt = c.execute("SELECT MIN(scheduled_at) t FROM messages WHERE "
                            "campaign_id=? AND status='pending'", (k["id"],)).fetchone()["t"]
            campaigns.append({
                "id": k["id"], "name": k["name"], "status": k["status"],
                "template": k["template"], "counts": counts, "next": nxt,
                "window_start": k["window_start"], "window_end": k["window_end"]})
        optouts = [dict(r) for r in c.execute(
            "SELECT * FROM optouts ORDER BY added_at DESC")]
    return {"senders": senders, "campaigns": campaigns, "optouts": optouts,
            "timezone": str(zone), "timezones": TIMEZONES,
            "webhook_path": "/webhook/sms/" + get_setting("webhook_token"),
            "now": time.time()}


class Handler(BaseHTTPRequestHandler):
    server_version = "ClientTexts/1.0"

    def log_message(self, *args):
        pass

    def reply(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authed(self):
        if not APP_PASSWORD:
            return True
        head = self.headers.get("Authorization", "")
        try:
            given = base64.b64decode(head.split(" ", 1)[1]).decode().split(":", 1)[1]
        except Exception:
            given = ""
        if secrets.compare_digest(given, APP_PASSWORD):
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Client texts"')
        self.end_headers()
        return False

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 20_000_000:
            raise ValueError("That file is too large.")
        raw = self.rfile.read(n) if n else b""
        return json.loads(raw or b"{}")

    def do_GET(self):
        if not self.authed():
            return
        path = self.path.split("?")[0]
        if path == "/":
            with open(os.path.join(HERE, "static", "index.html"), "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif path == "/api/state":
            self.reply(200, state())
        elif re.fullmatch(r"/api/campaigns/\d+/messages", path):
            cid = int(path.split("/")[3])
            with _lock, db() as c:
                rows = [dict(r) for r in c.execute(
                    "SELECT m.id, m.phone, m.name, m.body, m.scheduled_at, m.status, "
                    "m.error, m.sent_at, s.label sender FROM messages m "
                    "LEFT JOIN senders s ON s.id=m.sender_id "
                    "WHERE campaign_id=? ORDER BY scheduled_at", (cid,))]
            self.reply(200, rows)
        else:
            self.reply(404, {"error": "Not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        try:
            if path == "/webhook/sms/" + (get_setting("webhook_token") or "-"):
                handle_inbound(self.body())
                return self.reply(200, {"ok": True})
            if path.startswith("/webhook/"):
                return self.reply(404, {"error": "Not found"})
            if not self.authed():
                return
            # JSON-only: a cross-site form can't forge these requests.
            if "application/json" not in self.headers.get("Content-Type", ""):
                return self.reply(415, {"error": "JSON only"})
            d = self.body()
            self.reply(200, self.route_post(path, d))
        except ValueError as e:
            self.reply(400, {"error": str(e)})
        except Exception as e:
            self.reply(500, {"error": "%s: %s" % (type(e).__name__, e)})

    def route_post(self, path, d):
        if path == "/api/senders":
            kind = d.get("kind")
            if kind not in ("android", "twilio", "dry_run"):
                raise ValueError("Pick a phone type.")
            if kind == "android" and not (d.get("url") and d.get("username")
                                          and d.get("password")):
                raise ValueError("Fill in the address, username and password "
                                 "shown in the SMS Gateway app.")
            if kind == "twilio" and not (d.get("username") and d.get("password")
                                         and normalize_phone(d.get("from_number"))):
                raise ValueError("Fill in the Account SID, Auth Token and a valid "
                                 "Twilio number.")
            cap = max(1, min(int(d.get("daily_cap") or 100), 1000))
            with _lock, db() as c:
                c.execute(
                    "INSERT INTO senders (label, kind, url, username, password, "
                    "from_number, daily_cap) VALUES (?,?,?,?,?,?,?)",
                    ((d.get("label") or "Phone").strip(), kind,
                     (d.get("url") or "").strip(), (d.get("username") or "").strip(),
                     d.get("password") or "",
                     normalize_phone(d.get("from_number")) or "", cap))
            return {"ok": True}
        m = re.fullmatch(r"/api/senders/(\d+)/(delete|test)", path)
        if m:
            sid = int(m.group(1))
            with _lock, db() as c:
                s = c.execute("SELECT * FROM senders WHERE id=?", (sid,)).fetchone()
                if not s:
                    raise ValueError("That phone no longer exists.")
                if m.group(2) == "delete":
                    c.execute("DELETE FROM senders WHERE id=?", (sid,))
                    return {"ok": True}
            to = normalize_phone(d.get("to"))
            if not to:
                raise ValueError("Enter a valid US number to send the test to.")
            err = send_sms(s, to, "Test from your client text scheduler.")
            if err:
                raise ValueError("Test failed — " + err)
            return {"ok": True}
        if path == "/api/preview":
            clients, problems = parse_clients(d.get("csv", ""))
            with _lock, db() as c:
                opted = {r["phone"] for r in c.execute("SELECT phone FROM optouts")}
            keep = [cl for cl in clients if cl["phone"] not in opted]
            columns = sorted({k for cl in clients for k in cl})
            samples = [{"phone": cl["phone"], "text": render(d.get("template", ""), cl)}
                       for cl in keep[:3]]
            return {"count": len(keep), "opted_out": len(clients) - len(keep),
                    "problems": problems[:50], "columns": columns, "samples": samples}
        if path == "/api/campaigns":
            if not d.get("consent_confirmed"):
                raise ValueError("Confirm that everyone on the list agreed to get "
                                 "texts from you.")
            return create_campaign(d.get("name", ""), d.get("csv", ""),
                                   d.get("template", ""), d.get("start", "09:00"),
                                   d.get("end", "19:00"), footer=d.get("footer", True))
        m = re.fullmatch(r"/api/campaigns/(\d+)/(pause|resume|cancel|retry)", path)
        if m:
            cid, action = int(m.group(1)), m.group(2)
            with _lock, db() as c:
                if action == "pause":
                    c.execute("UPDATE campaigns SET status='paused' WHERE id=? AND "
                              "status='scheduled'", (cid,))
                elif action == "resume":
                    c.execute("UPDATE campaigns SET status='scheduled' WHERE id=? AND "
                              "status='paused'", (cid,))
                elif action == "cancel":
                    c.execute("UPDATE campaigns SET status='cancelled' WHERE id=?", (cid,))
                    c.execute("UPDATE messages SET status='skipped', error='cancelled' "
                              "WHERE campaign_id=? AND status='pending'", (cid,))
                else:  # retry failed ones, a minute apart
                    rows = c.execute("SELECT id FROM messages WHERE campaign_id=? AND "
                                     "status='failed'", (cid,)).fetchall()
                    for i, r in enumerate(rows):
                        c.execute("UPDATE messages SET status='pending', error=NULL, "
                                  "scheduled_at=? WHERE id=?",
                                  (time.time() + 60 * i, r["id"]))
                    if rows:
                        c.execute("UPDATE campaigns SET status='scheduled' WHERE id=?",
                                  (cid,))
            return {"ok": True}
        if path == "/api/optouts":
            phone = normalize_phone(d.get("phone"))
            if not phone:
                raise ValueError("Enter a valid US number.")
            if d.get("remove"):
                with _lock, db() as c:
                    c.execute("DELETE FROM optouts WHERE phone=?", (phone,))
            else:
                add_optout(phone, "added by hand")
            return {"ok": True}
        if path == "/api/settings":
            if d.get("timezone") not in TIMEZONES:
                raise ValueError("Unknown time zone.")
            with _lock, db() as c:
                c.execute("INSERT OR REPLACE INTO settings VALUES ('timezone', ?)",
                          (d["timezone"],))
            return {"ok": True}
        raise ValueError("Unknown action.")


def main():
    init_db()
    threading.Thread(target=scheduler_loop, daemon=True).start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("Client text scheduler running at http://%s:%d" % (HOST, PORT), flush=True)
    if HOST != "127.0.0.1" and not APP_PASSWORD:
        print("WARNING: reachable from the network with no APP_PASSWORD set.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
