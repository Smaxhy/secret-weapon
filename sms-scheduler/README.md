# Client Texts

Upload a client list (CSV), write one message, and the app sends it to each
client from your own phones, spread out across the day.

## Run it

Needs Python 3.9+ and nothing else.

```
cd sms-scheduler
python3 app.py
```

Open http://127.0.0.1:8765 and follow the three steps on the page. Leave the
app running while a send is in progress — it is what sends the texts.

## Connecting phones

| Type | How |
|---|---|
| **Android phone** | Install [SMS Gateway for Android](https://github.com/capcom6/android-sms-gateway) on the phone, turn on **Cloud server**, and paste the username and password it shows into the app. Texts go out from that phone's own number and plan. Connect as many phones as you like; the list is shared between them. |
| **Twilio number** | Paste the Account SID, Auth Token and your Twilio number. |
| **Practice mode** | Sends nothing; prints each text in the terminal so you can try the whole flow. |

iPhones can't be connected: iOS doesn't let any app send texts by itself.

## Client list

A CSV with a `phone` column. `name` and any other columns are optional and can
be used in the message as `{first_name}`, `{name}`, `{any column}`. See
`sample_clients.csv`. If the file has a `consent` column, only rows marked
`yes` are texted. Invalid numbers and duplicates are skipped and listed.

## How sending works

- Texts are spread across the window you choose, at slightly irregular times,
  shared evenly between your phones.
- Nothing is sent before 8am or after 9pm in the time zone you pick. That is one
  time zone for the whole list, so pick a window that works for clients elsewhere.
- Each phone has a daily limit (default 100) and waits at least 20 seconds
  between texts. Carriers block personal lines that send bulk texts, so keep
  the limits modest.
- Every text ends with "Reply STOP to opt out." unless you untick it.
- Numbers on the do-not-text list are always skipped.

### Automatic STOP handling

For STOP replies to land on the do-not-text list by themselves, the phone has to
be able to reach this app over HTTPS. Put the app behind a public HTTPS address
(a tunnel or a small server; set `HOST=0.0.0.0` and an `APP_PASSWORD`), then
register the webhook address shown at the bottom of the page with the phone app:

```
curl -X POST -u <username>:<password> -H "Content-Type: application/json" \
  -d '{"id":"client-texts","url":"https://<your-address>/webhook/sms/<token>","event":"sms:received"}' \
  https://api.sms-gate.app/3rdparty/v1/webhooks
```

Without this, add anyone who asks to stop to the do-not-text list by hand.

## Before you send

US law (TCPA) requires a person's prior consent for automated texts, and
written consent for marketing. Only text clients who agreed to hear from you,
and honour every opt-out.

## Settings

Environment variables: `PORT` (8765), `HOST` (127.0.0.1), `APP_PASSWORD`
(protects the page when it is reachable from other machines), `SMS_DB` (where
the data file lives). Phone logins are stored unencrypted in `data.sqlite3` on
your computer; that file is not committed to git.

## Tests

```
python3 -m unittest
```
