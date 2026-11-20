# Rubix Leaderboard

A privacy-focused, community-moderated speedcubing leaderboard for 2x2 through 7x7.

## Requirements

- Node.js 22.5 or newer

## Setup

```bash
npm install
cp .env.example .env
```

Set `ADMIN_PASSWORD` and `SESSION_SECRET` in `.env`. Use strong, independent random values
for `SESSION_SECRET` in production.

## Run

```bash
npm run dev
```

Development runs at `http://localhost:5565`.

```bash
npm run build
```

Production mode runs at `http://localhost:5555`.

## Database and demo data

The SQLite database is stored in `data/rubix.db`. Existing databases are migrated
automatically on startup, and entries created before the event migration remain 3x3.

```bash
npm run seed
npm run seed -- --force
npm test
```

The normal seed command only seeds demo entries when the database is empty. Use `--force`
to add demo entries for all cube events anyway.

## Moderation

Open `http://localhost:5565/admin` (or port 5555 in production) and sign in with
`ADMIN_PASSWORD`. Reports use an anonymous browser cookie for deduplication; no IP
addresses or IP-derived hashes are stored.

An entry moves into review after `REPORT_HIDE_THRESHOLD` distinct browser reports. Moderators
can dismiss reports and restore an entry or permanently delete it.

## Environment variables

- `ADMIN_PASSWORD`: password for `/admin`
- `SESSION_SECRET`: signs the admin session cookie
- `REPORT_HIDE_THRESHOLD`: distinct browser reports required to auto-hide an entry
- `COOKIE_SECURE`: set to `true` behind HTTPS
- `TRUST_PROXY`: set to `true` only behind a trusted reverse proxy
- `RUBIX_DB_PATH`: optional SQLite path; use `:memory:` for in-memory tests

## API

- `GET /api/events`
- `GET /api/leaderboard?event=333`
- `GET /api/stats?event=333`
- `GET /api/entries/:id`
- `POST /api/entries`
- `POST /api/entries/:id/report`
- `GET /api/admin/entries`
- `POST /api/admin/login`
