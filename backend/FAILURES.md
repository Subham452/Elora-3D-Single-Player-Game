# Backend verification notes

Nothing failed to verify — runtime tests all passed. Two environment
deviations to be aware of, neither of them a code issue:

1. **MONGODB_URI port is 27018, not 27017.** Port 27017 was already bound by
   `bookverse-mongo` (a different project's `mongo:7` container). The ELORA
   container `elora-mongo` was started as
   `docker run -d --name elora-mongo -p 27018:27017 mongo:7` and
   `backend/.env` uses `MONGODB_URI=mongodb://127.0.0.1:27018/elora`.
   `.env.example` still documents the root default (27017).

2. **PORT is 4100, not 4000.** A proxy configured in the shell environment
   intercepts port 4000 locally (it answers requests with its own JSON, so the
   ELORA server could not be exercised on 4000). Dev tests ran against
   `:4100` and every endpoint was verified there.

## What was verified (2026-10-19)

- `npm run typecheck` — zero errors; `npm run build` emits `dist/`.
- `POST /api/health`, register (201, dirty input trimmed/lowercased),
  invalid input (422 Zod), duplicate displayName (409), login (200),
  wrong password (401, non-enumerating).
- `GET /api/me` with access token (200), unauthenticated/bad token (401).
- `PATCH /api/me/appearance` (200) and bad hex color (422).
- `POST`/`GET /api/me/checkpoint` round-trip (200).
- `POST /api/me/discover` first time (201) and duplicate (200, no dup entry);
  `GET /api/me/discoveries`.
- Refresh cookie flags: HttpOnly, SameSite=Strict, Path=/ (secure only in prod).
- `POST /api/auth/refresh` via cookie **and** via body token; rotation issues a
  new token; replaying a rotated token revokes the family
  (`TOKEN_REUSE`, 401).
- `POST /api/auth/logout` (204, cookie cleared); revoked token then rejected.
- Auth rate limiter engages at 20 auth requests / 15 min / IP (429 JSON).
- JSON 404 for unknown `/api/*`, plain-text 404 elsewhere.
