# TradeMirror OS — Final Pre-Delivery Report
_Date: 2026-06-28 · Scope: critical & high-priority fixes only (no refactor, no rebuild). PDF/contract engine left untouched._

## ⛔ ONE BLOCKER YOU MUST DO BEFORE THE DEMO
**Apply the database migration `backend/supabase/migrations/20260628120000_delivery_hardening.sql` to the live Supabase project.**
The frontend now reads trades through a server-side masking view (`v_trades`) that **does not exist on the live DB yet** (verified by probe). Until the migration is applied, the Trades list, Trade Folder, and Partner portal will return a 404. This is DDL — it needs the Supabase dashboard SQL editor (or service-role/DB creds), which I don't have. **See the Deployment Checklist (step 1).** Everything else is code-complete and verified.

---

## 1. Fixed items

### ✅ 1. Financial access — now enforced at the database, not just hidden in the UI
**Decision applied:** Super Admin → everything · Internal → no money figures · Partner → net profit on their own trades only.
- New migration `20260628120000_delivery_hardening.sql`:
  - Base `public.trades` SELECT **locked to super_admin** (`trades: read admin`), so financial columns are unreachable through the auto-generated REST API for anyone else. Writes were already super_admin-only.
  - New **`v_trades` view** (SECURITY DEFINER) is the read path for Internal & Partner: it **masks** `frigo_*`, `sale_*`, `shipping_cost`, `insurance_cost`, `bank_fees`, `total_costs` to `NULL` for non-super-admins, and exposes `net_profit` only to super_admin and the **assigned** partner. Row scoping and column masking both live in the view's `WHERE`/`CASE`, so it is real enforcement, not cosmetic.
- Frontend repointed to the view: [tradeListService.ts](frontend/src/features/trades/services/tradeListService.ts), [partnerData.ts](frontend/src/features/partner/partnerData.ts). Internal users physically cannot fetch financial values anymore.
- Side benefit: the view joins `clients`/`entities` as owner, so the partner "client names show —" issue is gone without needing the older `partner_read_clients` migration.

### ✅ 2. Partner trade scoping — partners only see their assigned trades
- Added nullable `trades.partner_id` (FK → `users.id`) — additive, no change to existing columns.
- `v_trades` returns a partner **only** the rows where `partner_id = auth.uid()`; document reads are scoped the same way (`documents: read scoped` + `user_owns_trade()` helper), so a partner can't enumerate other trades' files either.
- Super-Admin assignment UI: a **"Partner assignment"** selector on the Trade Folder ([TradeFolderPage.tsx](frontend/src/features/trades/components/detail/TradeFolderPage.tsx)) lists active partner users and sets `partner_id`. Unassigned = no partner sees it.

### ✅ 3. Transactional save — no orphan files or dangling trades
[contractPersistence.ts](frontend/src/features/trades/services/contractPersistence.ts) now runs **trade row → storage upload → document row** with **compensation**: if the upload fails it deletes the trade row; if the document insert fails it deletes the storage object **and** the trade row (reverse order). Added `storageService.remove()` for the rollback. Net effect: a save either fully succeeds or leaves nothing behind.

### ✅ 4. Supabase storage — bucket & policies guaranteed
- Live probe confirmed the `trade-documents` bucket **already exists** on the project (HTTP 200, not "Bucket not found").
- The delivery migration now also (idempotently) **re-creates the bucket and all four `storage.objects` policies** (read = active user, upload = staff, modify/delete = admin), so a single run guarantees uploads work even on a DB that was provisioned before the storage migration landed.

### ✅ 5. Navigation — no dead links; links match role permissions
- [OverviewPage.tsx](frontend/src/app/routes/OverviewPage.tsx): the **Contacts** shortcut and the **New trade** CTA now render for super_admin only (they route to super_admin-only pages).
- [TradeListPage.tsx](frontend/src/features/trades/components/list/TradeListPage.tsx): the **New trade** button (header + empty state) is gated to super_admin.
- Sidebar nav (`nav.ts`) was already correctly role-filtered. Internal users now see **zero** links they can't open.

### ✅ 6. Authentication — always starts at /login, never auto-signs-in
- Confirmed (by code + grep) there is **no auto-login** anywhere — the dev shortcut was already removed; the app relies solely on a real Supabase session and redirects unauthenticated users to `/login`. Fixed the last stale comment in [ProtectedRoute.tsx](frontend/src/features/auth/components/ProtectedRoute.tsx).
- Sign-out clears the session and returns to `/login` (verified in `AuthContext.signOut`).
- **Invite + role assignment verified:** `InviteUserModal` passes the chosen role → `userService.invite` → `invite-user` Edge Function, which creates the auth account and upserts the profile **with that role**. Code-complete (deploy/email are operational steps below).

### ✅ 7. Admin flow — verified to compile, bundle, and pass tests
Admin dashboard, user management, trade creation, and contract generation routes are all reachable for super_admin (router + nav consistent). Programmatic verification all green (see §7 below).

---

## 2. Verification performed

| Check | Result |
|---|---|
| Frontend `tsc -b --noEmit` (typecheck) | ✅ clean |
| Frontend `vitest run` | ✅ **44/44** pass (incl. updated partner test; PDF-engine tests untouched & green) |
| Frontend `vite build` | ✅ built in ~9.6s (pre-existing chunk-size warning only) |
| Backend `check-migrations` (PGlite) | ✅ all migrations + seed apply cleanly, **including the new `20260628120000_delivery_hardening.sql`** |
| Live project reachability (anon probe) | ✅ project up, base schema present, `trade-documents` bucket present |
| Live migration state | ⚠️ `v_trades` / `partner_id` **not yet on live** → must apply the migration (blocker above) |

> The interactive login→navigate→create→generate→save→view→logout walkthrough is logically complete and compiles, but a live click-through requires the migration applied **and** a confirmed super_admin login — do this as the final smoke test (Deployment Checklist step 5).

---

## 3. Remaining issues (NOT fixed — out of the critical/high demo scope)

| Item | Severity | Why deferred |
|---|---|---|
| **Self-lockout protection is UI-only** — a super_admin can still change their own role / deactivate themselves via the API (RLS allows it; needs a DB trigger, not RLS) | Medium | Doesn't expose data; demo admin won't self-deactivate. Trigger is a small follow-up. |
| **Deactivated super_admin can still write** — `is_super_admin()` checks role, not `is_active` | Medium | Edge case; no impact on the demo. |
| **Status transitions have no state-machine guard** — milestones can be marked out of order and `trade_status` can regress | Medium | Cosmetic/logical, not a data leak; engine untouched per instructions. |
| **Invite/forgot-password/alert emails not delivered** — Edge Functions undeployed + Resend `INVITE_FROM_EMAIL`/SMTP unconfigured | Operational | Needs credentials/deploy (checklist). Until then invites return a copyable link. |
| **`overdue` never persisted** — surfaced live in-app, but the daily cron isn't deployed | Operational | In-app overdue works; only the scheduled flip is missing. |
| **Single-template engine** (701-2026 only); supplier original not stored as `frigo_contract`; minor low bugs (download URL revoke timing, trade-ref race, TZ off-by-one) | Low | Per instructions, the working PDF/contract engine was left untouched. |

---

## 4. Risks

1. **Migration-not-applied (highest):** the app now depends on `v_trades` + `trades.partner_id`. If the migration isn't run on the live DB before the demo, Trades/Folder/Partner pages 404. **Mitigation:** Deployment Checklist step 1 + the verification probe in step 2.
2. **Partner portal looks empty until trades are assigned:** with scoping live, a partner sees nothing until a super_admin assigns them via the new selector. **Mitigation:** assign at least one trade to your demo partner beforehand (or demo super_admin/internal only).
3. **No login seed = no demo:** login is now real-only. Ensure a confirmed super_admin exists (per project memory, `superadmin@chipafarm.com` is provisioned). **Mitigation:** verify you can sign in before the demo.
4. **Internal/Partner financials depend on the view, not the table:** correct and enforced — but if anyone regenerates `types.generated.ts` from the live DB **before** the migration is applied, the `v_trades` typing would disappear. **Mitigation:** apply the migration first, regenerate types only after.

---

## 5. Deployment checklist (in order)

1. **[BLOCKER] Apply the hardening migration to the live DB.** Supabase Dashboard → SQL Editor → paste & run `backend/supabase/migrations/20260628120000_delivery_hardening.sql` (idempotent — safe to re-run).
2. **Verify it took** (anon probe — should return 200/`[]`, not 404):
   ```
   curl -s -o /dev/null -w "%{http_code}\n" \
     "$VITE_SUPABASE_URL/rest/v1/v_trades?select=id&limit=1" \
     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
   ```
   (404 = migration not applied.)
3. **Confirm a super_admin login exists** and email is confirmed (Auth → Users). Reset its password if needed.
4. **(If demoing the partner portal)** sign in as super_admin, open a trade, and assign your demo partner in the new **Partner assignment** card.
5. **Smoke-test the walkthrough:** open app → land on `/login` → sign in → Overview → Trades → open a trade → (super_admin) New trade → upload supplier PDF → generate → **Save** → confirm the trade + document appear → download a document → Sign out → back at `/login`.
6. **(Optional, post-demo / for full invites & alerts):** deploy Edge Functions (`npm run deploy:invite-user`, deploy `milestone-alerts`), set `INVITE_FROM_EMAIL` to a verified Resend domain, point Supabase Auth SMTP at Resend, schedule the daily alerts cron.

---

## 6. Files changed

**Backend (1 new migration):**
- `backend/supabase/migrations/20260628120000_delivery_hardening.sql` — partner_id, base-trades read lock, `v_trades` masking view, scoped document reads, idempotent storage bucket+policies.

**Frontend:**
- `services/supabase/types.generated.ts` — `partner_id` on trades + `v_trades` view types.
- `features/trades/services/tradeListService.ts` — read via `v_trades` (masked/scoped).
- `features/trades/services/contractPersistence.ts` — transactional save with compensation.
- `services/storage/storageService.ts` — `remove()` for rollback.
- `features/partner/partnerData.ts` + `components/PartnerDashboard.tsx` + `partnerData.test.ts` — net-profit-only model & UI.
- `features/trades/components/detail/TradeFolderPage.tsx` — Partner assignment selector.
- `features/trades/components/list/TradeListPage.tsx` — role-gated New trade.
- `app/routes/OverviewPage.tsx` — role-gated shortcuts.
- `features/auth/components/ProtectedRoute.tsx` — corrected stale auto-login comment.

---

## 7. Production-readiness

- **Demo readiness (super_admin walkthrough), once the migration is applied: ~95%.** Login, navigation, trade creation, contract generation, transactional save, document view, and logout are all wired, type-checked, tested, and built. The only gap is the live click-through smoke test (checklist step 5).
- **Overall production readiness: ~85%.** The remaining 15% is operational (Edge Function deploys, email/SMTP, alerts cron) plus three medium hardening items (server-side self-protection, `is_active` in `is_super_admin`, status state-machine) — none of which block the demo or expose data.

_All critical and high-priority data-exposure / demo-breaking items from the audit are fixed and verified. The PDF/contract engine and the working schema were left intact, per instructions._
