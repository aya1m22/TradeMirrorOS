# TradeMirror OS — Project Audit & Progress Report
_Date: 2026-06-28 · Read-only audit against PRD v2.0. No code modified._

**Method:** five parallel read-only audits (routing/nav, auth/invite, DB/schema, contract+trade flow, dashboards/visibility), each grounded in real `file:line` evidence and cross-checked. The engine + mirror test suites were run live (13/13 pass). Findings below are verified against actual code, not the build log in `PLAN.md`.

**Headline:** The product is **feature-complete in code** and the core Phase-1 contract pipeline genuinely works end to end. The gaps that block a clean delivery are **operational** (un-deployed Edge Functions, un-applied migrations, unconfigured email) and a **handful of real correctness/security issues** — chiefly a non-transactional save, role-mismatched in-page links, and financial data that is hidden only in the UI (no column-level RLS).

---

## 1. Completed features (working — verified)

| Feature | Evidence |
|---|---|
| Phase-1 contract pipeline: upload → parse → review → edit → preview → download | data flows step-to-step with no dead buttons; `useContractExtraction` → `ContractExtractionPage` → `NewTradeWorkflow` → `CompanyContractEditor` → `buildMirroredContract` → `generateOverlayContractPdf` |
| Overlay PDF engine (contract 701-2026) | `generateOverlay.test.ts` injects new values **and** preserves pure-mirror content; empty fields white-blocked. 13/13 tests pass |
| Save to Trade Folder (storage + `trades` + `documents`) | works for a signed-in **super_admin** with a real session |
| Client CMS (CRUD, search, sort) | `ClientListPage.tsx`, `clientService` |
| Contact Library (CRUD + single default enforced) | `contactService.setDefault` clears prior default |
| Entity & Banking management + acting-entity toggle | `EntitiesPage`, `entityService`, `bankProfileService`; editor selectors load live with catalog fallback |
| Trade list + search + status filters + badges | `TradeListPage.tsx`, `tradeStatus.ts` |
| Trade Folder detail + document upload + BOL-date → `shipped` | `TradeFolderPage.tsx:110-113` |
| Milestone math (deadline = signing/BOL + 7 days) | `milestones.ts` (computation correct) |
| Audit Trail ZIP (dependency-free STORE writer, valid CRC-32) | `exports/zip.ts` (unit-tested) |
| Tax Readiness export (CSV + paginated landscape PDF) | `taxReadiness.ts`, `TaxReadinessPage.tsx` |
| Production login (real Supabase session, persisted) | `LoginPage` → `signInWithPassword`, not DEV-gated |
| Financial/Lifecycle/Audit-ZIP gates in Trade Folder | gated to `super_admin`; correct role strings (`TradeFolderPage.tsx:45-47`) |
| Client mutations hidden for internal **and** enforced by RLS | correct UI-hides-+-DB-enforces pattern |
| Role plumbing: single source of truth, no string typos | `useAuth().role` from `users.role`; `UserRole` union prevents typos |
| No secrets leaked to the client bundle | anon key only; `env.ts` warns if a service-role key is present |
| Edge Function authorizes caller (super_admin + active) | `invite-user/index.ts:78-88`, `verify_jwt = true` |

---

## 2. Partially completed features

| Feature | What works | What's missing |
|---|---|---|
| **User invites** | Full code path (modal → `userService.invite` → Edge Function → auth-admin create + profile upsert); graceful UI error if unreachable | Edge Function **deploy unconfirmed** (no deploy artifact); email delivery **off** (`INVITE_FROM_EMAIL` unset) → returns an invite link the admin must hand over manually |
| **Milestone alerts / overdue** | Architecture complete; overdue computed live & surfaced in-app (list badge, folder, partner metric) | `overdue` is **never persisted**; depends on the `milestone-alerts` Edge Function + daily cron, neither deployed |
| **Forgot-password** | Real code path (`resetPasswordForEmail`) | Depends on Supabase Auth SMTP → Resend, **not configured**; default mailer is rate-limited/unreliable |
| **Partner Dashboard** | Portfolio metrics, filterable list, per-trade modal, doc downloads; loading/error/empty states | Client names show **"—"** until `20260627120000_partner_read_clients.sql` is applied; **not owner-scoped** (see §6) |
| **Audit Trail ZIP "chain of title"** | ZIP assembles real signed-URL documents | The **supplier original is never recorded** as a `frigo_contract` document → the bundle is missing its first link (`01-supplier-contract` prefix is dead code) |
| **Overview dashboard** | Renders shortcut cards + CTA | **Static placeholder** — no live metrics/trade list; doesn't adapt to role (shows super_admin-only links to internal) |
| **Status transitions** | Each milestone flag persists with timestamps | No **state-machine ordering**; `trade_status` can skip or regress (see §4) |

---

## 3. Missing features / not built

- **Column-level financial RLS** — the `trades` RLS comment says financial hiding is "a column concern handled by the queries," but it is **not implemented**; financial confidentiality for `internal` rests entirely on UI render guards.
- **Per-partner ownership scoping** — there is no `partner_id`/ownership column, so a partner reads the **whole** trade book.
- **`frigo_contract` (supplier original) persistence** — uploaded to storage but never written to `documents`.
- **Server-side self-protection** — "can't demote/deactivate self" exists only in the UI; no RLS guard (`id <> auth.uid()`).
- **`is_active` check in `is_super_admin()`** — a deactivated super_admin still passes all admin policies.
- **Overdue persistence cron** — function exists in code; not deployed/scheduled.
- **`last_login_at` writing** — column is displayed but never updated → always "—".
- **Multi-template support** — only contract 701-2026 is handled (Phase-1 scoped).
- **Mobile nav drawer** — sidebar is `hidden md:flex` with no `<768px` rail (documented limitation, PRD "web only").

---

## 4. Broken features / bugs

| # | Severity | Bug | Evidence |
|---|---|---|---|
| B1 | **Critical** | **Non-transactional save**: storage upload → `trades` insert → `documents` insert with no rollback. If the `documents` insert fails, you get an orphaned storage object + a `trades` row with no document → contract unreachable from the folder | `contractPersistence.ts:67-84` |
| B2 | **High** | **Internal "New trade" buttons are dead** — shown on Overview + Trade list, but `/trades/new` is super_admin-only → silent redirect to `/` | `TradeListPage.tsx:54,108`, `OverviewPage.tsx:55-60` vs `router.tsx:48-49` |
| B3 | **High** | **Internal "Contacts" shortcut is dead** — Overview card links to `/contacts` (super_admin-only) for all roles | `OverviewPage.tsx:39-44` vs `router.tsx:48-50` |
| B4 | Medium | **Auth user with no `public.users` row is silently locked out of ALL data** — RLS gates on a profile that may not exist (dashboard "Add user", self-signup) | `auth_helpers.sql:15-19`, `AuthContext.tsx:36` |
| B5 | Medium | **Quality / Delivery-terms overrides never reach the PDF or the trade row** — only `commodity`/`quantity`/`incoterm` are applied; UI shows a small "recorded only" warning that's easy to miss | `CompanyContractEditor.tsx:240-261` |
| B6 | Medium | **Status can skip/regress** — marking the balance milestone sets `trade_status: balance_received` regardless of advance/BOL; marking advance afterward regresses it | `TradeFolderPage.tsx:250-289` |
| B7 | Low | **Successful invite shows no confirmation** — when email actually sends, `actionNotice` and `inviteLink` are both `""`, so the modal closes with zero feedback | `UsersPage.tsx:172-173` |
| B8 | Low | **Object URL revoked on the same tick after `.click()`** — can cancel large downloads on some browsers | `TradeFolderPage.tsx:133-139`, `CompanyContractEditor.tsx:287-291`, `TaxReadinessPage.tsx:15-22` |
| B9 | Low | **Trade-reference generation is race/gap-prone** — `CF-${year}-${list().length+1}` collides on concurrent saves or after a delete (unique-constraint failure) | `contractPersistence.ts:61-64` |
| B10 | Low | **Timezone off-by-one** in date-only milestone math (`new Date("YYYY-MM-DD")` = UTC midnight) | `milestones.ts:13-16` |
| B11 | Low | **`formatLatinNumber(negative)` mis-groups** the leading `-` (net profit can be negative) | `finance.ts:38-43` |
| B12 | Low | **Stale comments** still claim a dev auto-login that was removed | `ProtectedRoute.tsx:9-13` |

---

## 5. Pages that exist but are unreachable from navigation

**No page is fully orphaned** — every route has at least one in-app entry point. The real problem is **role-mismatched links** and **swallowed 404s**:

- `/trades/new` & `/contacts` — reachable for **super_admin** (nav/in-page links), but the links are **shown to `internal`** users who are then blocked by the router → dead links (B2, B3).
- `/trades/:id` — no nav item (correct; it's a detail route), reachable via the Trade list links/Open button for both super_admin and internal. OK.
- `*` catch-all redirects everything to `/`, so **genuine 404s/broken links are invisible** during testing (`router.tsx:59`) — they silently resolve to Overview/Partner instead of erroring.

---

## 6. Role access issues

| # | Severity | Issue | Evidence |
|---|---|---|---|
| R1 | **Critical** | **Financial columns hidden only in the UI.** `getTrade` selects `*` (incl. `net_profit`, all costs) and `trades` RLS lets any active user read every column. Internal users have full financials in-browser; the only barrier is the `role === "super_admin"` render guard | `tradeListService.ts:64-66`, `rls.sql:4-7,61-63`, `TradeFolderPage.tsx:213` |
| R2 | **High** | **Partner reads the entire trade book.** The partner query has no owner filter and RLS grants all active users read on all trades → a partner sees every client/entity/net-profit, not "their" portfolio | `partnerData.ts:34-41`, `rls.sql:61-63` |
| R3 | **High** | In-page links not role-filtered → dead links for internal (B2/B3) | `OverviewPage`, `TradeListPage` |
| R4 | Medium | **Save is super_admin-only at the DB** but the editor is presented broadly; an internal user who reaches save hits an RLS error mid-sequence (after the storage upload) | `rls.sql:64-66`, `contractPersistence.ts:75` |
| R5 | Medium | **Self-protection is UI-only** — `disabled={isSelf}` in `UsersPage`, but RLS lets any super_admin update any user row (incl. self) → can self-lockout | `rls.sql:30-32`, `UsersPage.tsx:128,150` |
| R6 | Medium | **Deactivated super_admin still writes** — `is_super_admin()` checks `role` but not `is_active` | `auth_helpers.sql:21-28` |

**Profit-split question (PRD-critical): DEFINITIVELY SAFE.** There is **no profit-split / partner-share concept anywhere** in the schema, queries, or components — nothing to leak. Partners are *intended* to see per-trade `net_profit` (documented in `partnerData.ts:4-6`). The exposure is the broader financial-column visibility above, not a split.

---

## 7. Database / schema mismatches

**Good news: zero table/column/enum-name mismatches.** The hand-authored type model (`types.generated.ts`) and every Supabase query match the SQL schema exactly; generated columns (`total_costs`, `net_profit`) are correctly omitted from inserts; all `trade_status`/`document_type`/`milestone_status` writes use valid enum members. The risks are **deployment/RLS gaps**, not naming:

| # | Severity | Mismatch | Symptom |
|---|---|---|---|
| D1 | **High** | `20260627120000_partner_read_clients.sql` is **not** in `setup_phase1.sql` → likely un-applied | Partner dashboard & tax export show "—" for client names |
| D2 | **High** | Storage bucket + `storage.objects` policies live in `storage.sql`/`setup_phase1.sql`, but a separate `create_trade_documents_bucket.sql` exists (the live project was missing the bucket). If only one was run, uploads 400 ("Bucket not found") or hit an RLS violation | Save fails before any DB row is written |
| D3 | Medium | No **column-level** financial RLS despite the in-code comment claiming it (see R1) | Internal/partner read full financials at the DB |
| D4 | Medium | RLS gates on a `public.users` profile that may not exist (B4) | Auth user appears logged in but sees no data |
| D5 | Low | `trades` FKs (`entity_id`/`bank_profile_id`/`client_id`/`contact_id`) depend on `seed.sql` defaults (`1111…/3333…/4444…/5555…`) | If seed wasn't applied, save fails with an FK violation |

**The 7 tables** (verified columns): `users`, `entities`, `bank_profiles`, `clients`, `contacts`, `trades`, `documents`. `trade_status` enum = `{draft, active, advance_received, shipped, balance_received, overdue}`. Storage bucket = `trade-documents` (private). Full column reference captured in the schema audit.

---

## 8. Invite / auth flow issues

- **Dev auto-login was removed** in the working tree (intentional hardening) — login now requires a real Supabase session. Stale comments still claim auto-login exists (B12). Demo/delivery now needs a **seeded, confirmed super_admin** to log in as.
- **Invite Edge Function deploy is unconfirmed** — the project is *linked* (`config.toml`, `.temp/linked-project.json`) but there's no deploy artifact; a new `deploy-invite-user.mjs` script + `npm run deploy:invite-user` exist precisely because it isn't deployed. Needs `supabase login` / `SUPABASE_ACCESS_TOKEN`.
- **Invite email is off** — `RESEND_API_KEY` is set but `INVITE_FROM_EMAIL` is unset → `emailEnabled=false` → returns an invite link instead of emailing. Requires a **verified** Resend sender domain.
- **Forgot-password** depends on Supabase Auth → Resend SMTP, not configured.
- **Self-protection is UI-only** (R5); **deactivated super_admin still writes** (R6).
- **Successful invite gives no confirmation** (B7).
- **Clean:** no secrets in the client bundle; the Edge Function correctly authorizes the caller as an active super_admin; error surfacing through `readEdgeFunctionError` is solid.

---

## 9. What still needs to be done before delivery

**A. Operational / credentials (no code change — the architecture is in place):**
1. **Deploy** `invite-user` and `milestone-alerts` Edge Functions; **schedule** the daily alerts cron.
2. **Apply** `20260627120000_partner_read_clients.sql` to the live DB (partner client names).
3. **Verify/apply** the storage bucket **and** its `storage.objects` policies on the live DB (D2).
4. **Configure Resend**: set `INVITE_FROM_EMAIL` to a verified `@chipafarm.com` sender; point Supabase Auth SMTP at Resend (enables invite + forgot-password + alert emails).
5. **Seed/confirm** at least one super_admin and ensure **every** auth user has a `public.users` row (B4/D4).

**B. Code correctness/security to land before handover:**
1. **Make the save transactional/compensating** — DB-first or cleanup-on-failure (B1, Critical).
2. **Role-filter in-page links** (New trade, Contacts) via `useAuth().role` (B2/B3/R3, High).
3. **Decide financial confidentiality model** — add column-level RLS (or a partner/internal-safe view) or formally accept UI-only and document it (R1/R2/D3, Critical decision).
4. **Owner-scope the partner trade query** or explicitly document that a partner sees the whole book (R2).
5. **Persist the supplier original** as a `frigo_contract` document so the audit chain is complete (H2/§2).
6. **Guard contract generation to the recognized template** (or plan multi-template) so a non-701-2026 PDF isn't silently corrupted (§3).
7. **Server-side self-protection** + add `is_active` to `is_super_admin()` (R5/R6).
8. **Status state-machine ordering** so transitions can't skip/regress (B6).
9. Sweep the low bugs (B5, B7–B11) and stale comments (B12).

---

## 10. Priority order

### 🔴 Critical (data integrity / security — fix before any real use)
- **B1** Non-transactional save → orphaned files + dangling trades.
- **R1** Financial columns readable by internal at the DB; UI-only guard.
- **R2** Partner reads the entire trade book (no owner scoping).
- **D2** Storage bucket/policies may be unprovisioned → save fails.

### 🟠 High (blocks core flows / delivery)
- **B2 / B3 / R3** Dead in-page links for internal users.
- **R4** Internal save hits an RLS error mid-sequence.
- **D1** Partner/tax client names show "—" (un-applied migration).
- **Auth ops:** invite Edge Function not deployed; invite/reset email not configured (§8).
- **H2** Supplier original not persisted → broken audit chain.
- **Template guard** — generation silently corrupts a non-701 PDF.

### 🟡 Medium
- **B4 / D4** Profile-less auth users locked out of all data.
- **R5 / R6** Self-protection UI-only; deactivated super_admin still writes.
- **B5** Quality/Delivery overrides don't reach the PDF/trade.
- **B6** Status transitions can skip/regress.
- **Overview** is a static placeholder (no live metrics).
- **Overdue** never persisted (cron not deployed).

### 🟢 Low
- **B7** No invite-success confirmation · **B8** download URL revoke timing · **B9** trade-ref race/gap · **B10** TZ off-by-one · **B11** negative Latin formatting · **B12** stale auto-login comments · `last_login_at` never written · mobile nav drawer absent.

---

_No code was changed. This report supersedes the optimistic "ROADMAP COMPLETE" status in `PLAN.md`: the code is complete, but the items in §9–§10 stand between the current state and a clean delivery._
