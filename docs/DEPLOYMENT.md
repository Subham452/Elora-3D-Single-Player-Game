# ELORA — Deployment Plan

## Targets

- **Frontend**: Vercel (static + SPA rewrites) or any CDN.
- **Backend**: Render / Railway / Fly (Node hosting **with WebSocket support
  and no scale-to-zero during play**; verify provider details — sleeping
  backends break instant reconnects and realtime play).
- **MongoDB**: Atlas (free M0 tier is fine for dev; use clustered backups for prod).
- **Assets**: for production, vendored assets served via static CDN;
  large GLBs should move to object storage + CDN (`docs/ASSET_PIPELINE.md`).

## Build & run

| Service | Build | Start |
|---|---|---|
| backend | `npm run build && npm run prisma:gen` (n/a) → `tsc` | `node dist/index.js` |
| frontend | `npm run build` (Vite) | static `dist/` |

## Environment variables (backend)

See `.env.example` in repo root — including:
`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_ORIGIN`,
`PORT`, `NODE_ENV`, `WORLD_DAY_SECONDS`.

Never commit real `.env`; secrets are documented as placeholders only.
Change both JWT secrets to ≥ 32-char randoms in production.

## Production checklist (verify, don't assume)

- [ ] CORS restricted to real frontend origin(s).
- [ ] WebSocket upgrade uses HTTPS/WSS; proxy (Nginx/Render) allows
      `Upgrade`/`Connection` headers and doesn't buffer.
- [ ] Access-token TTL short (15 min), refresh rotated; cookie `Secure`,
      `SameSite=strict` on https.
- [ ] Atlas backups / point-in-time recovery scheduled.
- [ ] Health endpoint (`/api/health`) used by platform health checks.
- [ ] Structured logs to stdout; error monitoring hooked (Phase 7).
- [ ] Socket.IO path (`/socket.io`) not blocked by CDN/layers.
- [ ] Rate limits tuned against abuse.
- [ ] Smoke tests after deploy: auth round trip + world join + move echo.

## Atlas notes

- Local dev verified against Atlas (`mongodb+srv://…/elora`): registration,
  login, appearance update, checkpoint save/read, and discovery persistence
  round-tripped successfully (2026-10-19).
- Atlas URI must include the database name (`…/elora`).
- IP allowlisting: add your current IP (or deployment platform egress) in
  Atlas Network Access; `0.0.0.0/0` is OK for local dev only, never production.
- Credentials live only in `backend/.env` (git-ignored). Rotate any password
  that was shared in plaintext (chat, tickets, etc.).
