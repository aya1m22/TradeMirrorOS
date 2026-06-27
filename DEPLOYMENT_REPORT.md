# TradeMirror OS — Deployment Hardening Report
_Date: 2026-06-28 · Production-hardening pass. No rebuild, no refactor, no new features — only fixes for issues that would break the deployed app or cause incorrect behavior. Verified with a full live run against the real Supabase backend._

## Verdict: ✅ SAFE TO DEPLOY — conditional on the 2 required steps below
The app builds, runs, and passes a full live end-to-end flow. It will **not** crash on deploy. Two provisioning steps are **required** for correct/secure behavior (apply the DB migration + set build-time env vars). Until the migration is applied the app still runs (graceful fallback), but server-side financial enforcement is inactive — so treat the migration as mandatory for production.

---

## Issues found & fixed in this pass

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | **No SPA host config** — deep links / refresh (e.g. `/trades/:id`) would 404 on static hosts | High | Added [frontend/vercel.json](frontend/vercel.json) (rewrite all → `/index.html`) + [frontend/public/_redirects](frontend/public/_redirects) (`/* /index.html 200`). Confirmed `dist/_redirects` ships in the build. |
| 2 | **No error boundary** — any render crash = blank white screen (empty-screen / hidden-crash risk) | High | Added [ErrorBoundary](frontend/src/components/ErrorBoundary.tsx) (inline-styled, recoverable "Reload app" fallback) wrapping the whole app in [App.tsx](frontend/src/app/App.tsx). |
| 3 | **Sign-out not resilient** — if the network sign-out threw, local session wasn't cleared (stale/half-authenticated state) + unhandled promise rejection | Medium | [AuthContext.signOut](frontend/src/features/auth/context/AuthContext.tsx) now uses try/finally — local session **always** clears; logout can't leave the user stuck. |
| 4 | **favicon 404** on every page (console error) | Low | Inline SVG data-URI favicon in [index.html](frontend/index.html) — 404 eliminated (verified in live run). |
| 5 | **`.env.example` inaccurate** — listed an unused var, omitted `VITE_USE_MOCKS`, didn't note build-time requirement | Low | Rewrote [frontend/.env.example](frontend/.env.example) to the actually-required vars + a "baked at build time" warning + service-role caution. |
| 6 | **`.temp/` not gitignored** — Supabase CLI scratch could be committed | Low | Added `**/.temp/` to `.gitignore`. |

## Checks that passed with NO change required
- **No hardcoded localhost / IPs** anywhere in `frontend/src`.
- **No `console.log` debug leftovers** in app source.
- **No secrets in the frontend** — only the anon key is bundled; `config/env.ts` actively warns if a service-role key is ever present; `frontend/.env`/`backend/.env` are gitignored and **not tracked** (verified `git ls-files`).
- **No silent API failures** — the only empty `.catch()`s are the intentional best-effort rollback steps in the transactional save; all user-facing services throw and surface errors.
- **Loading / error / empty states** exist on every data page (Trades, Folder, Clients, Contacts, Entities, Users, Partner).
- **No infinite loading** — react-query is `retry: 1`, `refetchOnWindowFocus: false` → fails fast to an error state.
- **No data-loss on save** — save is transactional with reverse-order compensation (verified earlier; orphan-free).
- **Routes after refresh/direct URL** — handled in dev by Vite; now handled in prod by the SPA fallback (#1).
- **Role gating** — router `RequireRole` + RLS; verified internal in-page links are role-filtered (no dead links).

---

## Final live test (real Chrome → live Supabase, hardened build)
login → dashboard → create trade → upload supplier PDF → generate → edit → **save (`CF-2026-001`)** → trade folder → document open/download → refresh (persists) → logout (session cleared).

| Step | Result |
|---|---|
| Starts at /login, no auto-login | ✅ |
| Login (super_admin) + role load | ✅ |
| Navigate all pages, no dead links | ✅ |
| Create → upload → generate → edit → preview | ✅ (overlay PDF renders correctly) |
| Save → DB persisted | ✅ (`CF-2026-001`, net_profit 4050 computed) |
| Folder → document → download | ✅ |
| Persist after refresh | ✅ |
| Logout clears session | ✅ |
| Runtime crashes / `pageErrors` | ✅ none |
| Console errors | ✅ favicon 404 gone; only benign `v_trades` probe 404s remain (caught → fallback; become 200 once migration applied) |

Programmatic: `tsc` clean · **44/44 tests** · production `vite build` ok. _Test data created during the run was deleted — production DB back to 0 trades / 0 documents._

---

## Deployment risks
1. **Migration not applied = no server-side financial enforcement.** Until `20260628120000_delivery_hardening.sql` is on the live DB, the app falls back to base-table reads (works), but financial masking for Internal/Partner is UI-only (the original baseline) and partner row-scoping is inactive. **Mitigation: apply the migration (required step 1).**
2. **Env vars are baked at build time.** If the host builds without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, `config/env.ts` throws at load → blank screen (the error boundary can't catch a module-eval throw). **Mitigation: set build env vars (required step 2).**
3. **Internal/Partner accounts not provisioned** on live → those roles can't be exercised until created (dashboard or invite).
4. **Invite/forgot-password/alert emails** need the Edge Function deployed + Resend/SMTP configured; until then invites return a copyable link and surface a clear error.
5. **External Google Fonts CDN** at runtime — non-blocking (system-font fallback if blocked).
6. **Pre-existing orphan supplier PDFs** in `storage/originals/` (extraction uploads the original but never records/cleans it) — non-breaking; a cleanup follow-up.

---

## Required deployment steps (in order)
1. **Apply the DB migration** — Supabase Dashboard → SQL Editor → run `backend/supabase/migrations/20260628120000_delivery_hardening.sql` (idempotent). Verify: `GET /rest/v1/v_trades?select=id&limit=1` returns 200/`[]`, not 404.
2. **Set build-time env vars** on the host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only — never the service-role key).
3. **Build & deploy the frontend**: `cd frontend && npm run build` → deploy `frontend/dist`. The SPA fallback (`vercel.json` / `_redirects`) ships with it; on any other host configure "rewrite all routes → index.html".
4. **Confirm a super_admin login** exists and is email-confirmed.
5. **(For full features)** deploy the `invite-user` (and `milestone-alerts`) Edge Functions, set `INVITE_FROM_EMAIL` on a verified Resend domain + point Supabase Auth SMTP at Resend, and provision Internal/Partner accounts.
6. **Smoke-test in prod**: login → create trade → save → folder → download → logout.

---

## Readiness
- **Deployment readiness: ~90%** — deployable now; the two required steps (migration + env vars) are standard provisioning, and the app degrades gracefully without them rather than crashing.
- **Production readiness: ~88%** — remainder: apply migration, provision Internal/Partner accounts, deploy invite Edge Function + email, clean up orphan originals, and the deferred medium hardening (server-side self-lockout protection, `is_active` in `is_super_admin`, status state-machine).

## Explicit statement
**SAFE TO DEPLOY** — provided required steps 1 (apply migration) and 2 (set build-time env vars) are completed. The app does not crash without them, but server-side financial enforcement is only active after the migration is applied.
