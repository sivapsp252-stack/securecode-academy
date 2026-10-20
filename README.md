# SecureCode Academy

Interactive secure-coding platform: learners **break** vulnerable code in a safe sandbox, **patch** it, and prove the fix with a hidden test-suite. Includes XP, levels, streaks, badges, and a manager team dashboard.

**Stack:** React + Vite · Monaco Editor · React-Markdown · Node.js / Express · SQLite (better-sqlite3) · JWT auth · Docker sandbox (Python)

## Run it locally

Prerequisites: **Node.js 20+** and either **Docker** (recommended) *or* **Python 3** (dev fallback).

```bash
npm install            # root tooling (concurrently)
npm run setup          # server + client dependencies
docker pull python:3.12-alpine      # only if you use Docker mode
npm run dev            # API on :4000, web app on http://localhost:5173
```

Open **http://localhost:5173**.

Demo accounts (created on first start): 
- Developer: `dev@securecode.dev` / `Developer@123`
- Manager: `manager@securecode.dev` / `Manager@123` (team invite code `DEMO2026`)

Verify the sandbox and challenge logic: `npm test`

### Production build

```bash
npm run build
npm start              # Express serves the API and the built React app on :4000
```

Set environment variables from `.env.example` (at least `JWT_SECRET`). A `Dockerfile` is included for Render / Railway / Fly.io.

## What is built (project requirements)

| Requirement | Where |
|---|---|
| Track → Module → Lesson, markdown lessons stored in DB | `server/src/db.js`, `server/src/seed.js`, `content/` |
| Course player UI + markdown rendering | `client/src/pages/Lesson.jsx` (React-Markdown) |
| Monaco editor integration | `client/src/components/CodeChallenge.jsx`, `XssChallenge.jsx` |
| Option A - browser sandbox for JS/XSS (sandboxed iframe) | `client/public/xss-sandbox.html`, `XssChallenge.jsx` |
| Option B - backend sandbox for Python (ephemeral Docker, one container per run) | `server/src/sandbox.js` |
| SQL injection challenge: exploit `' OR 1=1 --`, patch with parameterized queries, test-suite validation | `challenges/sqli-login/` |
| XSS challenge | `challenges/xss-comment/` |
| IDOR challenge | `challenges/idor-invoice/` |
| XP, levels, streaks | `server/src/gamification.js` |
| Badges incl. **SQL Slayer** | `content/curriculum.json`, `gamification.js` |
| Team dashboard: manager invites developers, sees completion rates | `server/src/routes/teams.js`, `client/src/pages/Team.jsx` |
| Sandbox Design Doc | `docs/SANDBOX_DESIGN.md` |

## Folder layout

```
challenges/   vulnerable mini-apps: vulnerable.* (starter), solution.* (reference), exploit.py, tests.py, fixtures.py
client/       React app (Vite)
content/      curriculum.json + markdown lessons (seeded into the DB on start)
docs/         Sandbox design document
server/       Express API, SQLite schema, sandbox service, tests
```

## Adding a new lesson / module

1. Write `content/lessons/<name>.md`.
2. Add it to `content/curriculum.json` (restart the server - content is upserted).
3. For a Python challenge, create `challenges/<slug>/` with `meta.json`, `vulnerable.py`, `solution.py`, `exploit.py`, `tests.py` (copy `sqli-login` as a template).

## Security notes

- Passwords hashed with bcrypt; JWT sessions (7 days); login/register rate-limited; same error for unknown user and wrong password.
- All SQL in the platform itself uses parameterized statements. Only the *challenge* code is intentionally vulnerable, and it only ever runs inside the sandbox against a throw-away in-memory database.
- Lessons render through React-Markdown (no raw HTML).
- Read `docs/SANDBOX_DESIGN.md` for the sandbox threat model and its limits.
