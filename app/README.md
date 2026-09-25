# St Agnes Guild register: Anglican Diocese of Masvingo

Tracks St Agnes Guild members and their **yearly** tributes (USD) across every church in the diocese.
React + Tailwind front end, Node.js (Express 5) API, MongoDB.

## What it does
- **Guild register**: every girl with date of birth and age, phone, parent/guardian name and phone, home address or village, church, joining year and status. Filter by church and active/archived, search by girl or guardian, export to CSV. Missing details are flagged so they can be filled in from the paper register.
- Churches grouped by **archdeaconry → parish → church**
- Yearly tribute: **$2 a year up to 2024, $5 a year from 2025** (changeable in Setup)
- Arrears per member, church and archdeaconry, with the exact years owed
- Every payment records the **date paid**; each year in a girl's ledger shows when it was paid
- Record any amount: it fills the oldest unpaid years first; next year can be paid in advance
- Copy the paper books: tick the years already paid and type the date paid for each
- **Archive** when a girl marries (or moves, leaves...). Tributes stop after the year you pick; history is kept. Restore any time.
- Receipts are never edited or deleted, only **voided with a reason**
- Tribute amount changes apply from a chosen year, so old arrears stay correct
- Arrears export to CSV with years owed and last date paid (opens in Excel)
- Activity log of every change

## Accounts and handover
Each login belongs to an **office** ("Diocesan Secretary", "Treasurer, St Mary's"), not a person.

| Access | Can do |
|---|---|
| Diocesan admin | Everything: churches, tribute amount, accounts, all members, delete |
| Treasurer | Members and payments for their assigned churches only (enforced on the server) |

When a new person takes over an office, an admin opens **Setup → Accounts → Hand over**:
1. Enter the new holder's name and a new username
2. The app shows a one-time password **once**. Give it to them in person or by phone.
3. The previous holder is signed out everywhere and their password stops working
4. At first sign-in the new holder must choose their own password (old passwords can't be reused)

**Reset password** does the same for a forgotten password, without changing the holder.

## Running it

Requirements: Node.js 20+, and MongoDB 6+ (local install or a free MongoDB Atlas cluster).

```bash
# 1. API
cd server
cp .env.example .env        # then set MONGODB_URI
npm install
npm test                    # tribute maths unit tests
npm run create-admin        # first admin + archdeaconries + Cathedral (run once)
npm run dev                 # http://localhost:4000

# 2. Web app (second terminal)
cd client
npm install
npm run dev                 # open http://localhost:5173
```

### Production
```bash
cd client && npm install && npm run build     # creates client/dist
cd ../server && npm install --omit=dev
NODE_ENV=production npm start                 # serves the API and the built app on one port
```
In production:
- **Serve over HTTPS.** The session cookie is `Secure` and won't work over plain HTTP.
- Set `APP_ORIGIN` to the public address, e.g. `https://stagnes.anglicanmasvingo.org`
- Behind Nginx or a hosting platform's proxy, set `TRUST_PROXY=1`
- Use a MongoDB user that only has `readWrite` on this one database, and turn on Atlas backups

## Security measures
| Threat | Protection |
|---|---|
| Stolen database | Passwords hashed with bcrypt (cost 12); session tokens stored only as SHA-256 hashes |
| Password guessing | 5 wrong passwords lock the account for 15 min; 20 sign-in attempts per IP per 15 min; same error message and timing whether the username exists or not |
| Weak passwords | At least 10 characters with letters and numbers, no username inside, common passwords rejected, last 5 can't be reused |
| Shared or lost phones | Sessions expire after 12 h and after 60 min idle; password change, reset or handover signs out all other devices |
| Stolen session via script (XSS) | Cookie is `HttpOnly`; strict Content-Security-Policy allows only the app's own scripts; React escapes all text |
| Cross-site request forgery | `SameSite=Strict` cookie + required `X-Requested-With` header + Origin check |
| NoSQL injection | Every input validated by Zod (unknown fields stripped); Express 5 simple query parser; search text regex-escaped |
| Treasurer seeing other churches | Every member/payment/report query is scoped on the server; other churches' records return 404 |
| Minors' personal data | Only the fields the guild needs; treasurers see only their own churches' girls; every register export is written to the activity log; edit logs record which fields changed, not the personal values |
| Excel formula injection in exports | Cells starting with `= + - @` are neutralised |
| Tampering with money records | Amounts in integer cents; receipts only voided (with reason), never edited; optimistic locking stops two people double-paying the same year |
| Other | Helmet security headers, HSTS, no-framing, 20 KB body limit, no stack traces sent to browsers, full audit log |

## Project layout
```
server/src
  index.js            Express app, security headers, routes
  config.js           validated environment variables
  lib/tribute.js      yearly arrears + allocation maths (unit tested)
  lib/passwords.js    hashing, policy, one-time passwords
  middleware/         auth/sessions, CSRF, rate limits, validation, errors
  models/             User, Session, Church, Member, Payment, Settings, AuditLog
  routes/             auth, users, settings, churches, members, register, reports, audit
  scripts/createAdmin.js
client/src
  App.jsx             sign-in gate, header, routing
  pages/              Login, ChangePassword, Overview, Church, Member, Register, Setup
  components/ui.jsx   buttons, fields, sheets, toasts
  lib/                api client, formatting, hooks
```
