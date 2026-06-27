# TradeMirror OS — Implementation Plan

_Date: 2026-06-26 · Overlay engine + Phase-1 auth decoupling DONE. One blocker left: provision the live Supabase backend so SAVE works._

## Phase-2+ Build Execution Log (PRD v2.0 — full build, one task at a time)
_Roadmap order: Client CMS → Contact Library → Entity/Banking CRUD+toggle → Auth/roles/visibility →
Trade lifecycle/milestones → Folder doc upload+BOL → Milestone alerts → Partner Dashboard → Audit ZIP
→ Tax export. Permanent PRD §16 exclusions are out of scope. Phase-1 flow kept intact._

### ✅ Task: Client CMS (PRD §5)
- **Status:** Done.
- **Files modified:** `frontend/src/features/clients/components/AddClientModal.tsx` (extended to full §5.1
  field set incl. Tax ID/RUC required + Notes; added edit mode via optional `client` prop — same modal
  reused by the editor's create flow, no duplication), `frontend/src/features/clients/components/ClientListPage.tsx`
  (new: list, search by company/country/contact, sortable by company & country per §5.2, add/edit/delete),
  `frontend/src/app/router.tsx` (`/clients` → ClientListPage, replaced placeholder).
- **Reason:** PRD §5 Client CMS (CRUD, search/sort). Completes the previously-partial clients module.
- **Verification:** `npm run typecheck` clean · `npm test` 38/38 · `npm run build` ok · live probe:
  client create→update→delete round-trip under RLS ✓.
- **Notes:** Editor's "+ Add Client" now collects the full §5.1 fields (Tax ID/RUC is a required client
  field per the brief) — brief-aligned completion, not a behavior regression; overlay does not inject
  client tax_id, so the generated PDF is unaffected. Phase-1 upload→…→save untouched.

### ✅ Task: Contact Library (PRD §6)
- **Status:** Done.
- **Files modified:** `frontend/src/features/contacts/services/contactService.ts` (new — CRUD +
  `setDefault` that clears the prior default to respect the single-default unique index),
  `frontend/src/features/contacts/components/ContactFormModal.tsx` (new — create/edit, §6.1 fields,
  default toggle), `frontend/src/features/contacts/components/ContactListPage.tsx` (new — list, search,
  set-default, edit/delete), `frontend/src/app/router.tsx` (`/contacts` → ContactListPage).
- **Reason:** PRD §6 Contact Library (CRUD + one default contact).
- **Verification:** typecheck clean · test 38/38 · build ok · live probe: create → setDefault (exactly
  one default enforced) → restore seed default → delete ✓.
- **Notes:** Editor's contact selector still reads the Phase-1 catalog; repointing it to live contacts is
  bundled with the Phase-3 selector-repoint decision (see roadmap). Phase-1 flow untouched.

### ✅ Task: Entity & Banking management + Acting-Entity toggle (PRD §4)
- **Status:** Done (3a management page + 3b editor repoint).
- **Files modified:** `frontend/src/features/entities/services/entityService.ts` (new CRUD),
  `frontend/src/features/entities/services/bankProfileService.ts` (new CRUD + `setDefault` per the
  one-default-per-entity index), `frontend/src/features/entities/components/{EntityFormModal,BankProfileFormModal,EntitiesPage}.tsx`
  (new — §4.1/§4.2 fields, per-entity bank profiles, set-default, edit/delete),
  `frontend/src/app/router.tsx` (`/settings/entities` → EntitiesPage),
  `frontend/src/features/contract-editor/components/CompanyContractEditor.tsx` (**3b**: Acting Entity /
  Banking / Contact selectors now load from live `entities`/`bank_profiles`/`contacts` via react-query,
  **falling back to the Phase-1 catalogs** when the DB is empty/offline; added mapEntity/mapBank/mapContact;
  "PENDING" RUC/address/city map to blank to preserve current contract appearance).
- **Reason:** PRD §4 Entity & Banking management + the Acting-Entity toggle cascading managed data into
  the contract.
- **Verification:** typecheck clean · test 38/38 · build ok · live probe: entities(2)/banks(1)/contacts(1)
  load; EAS + its default bank + default contact resolve; catalog fallback preserves offline preview/download.
- **Notes:** Phase-1 upload→…→save preserved — selectors keep the same shapes and seed ids, so the save
  context FKs and overlay inputs are unchanged when running on the seed; offline still works via fallback.

### ✅ Task: Authentication & Access Control (PRD §2/§3)
- **Status:** Done (credential-dependent email parts scaffolded with placeholders).
- **Files modified:**
  - Auth UI/guards: `frontend/src/features/auth/components/{LoginPage,ForgotPasswordPage,ProtectedRoute}.tsx`
    (RequireAuth + RequireRole). `frontend/src/app/router.tsx` (public /login, /forgot-password; everything
    else behind RequireAuth; Partner → /partner only; super_admin+internal → app shell; SuperAdmin-only:
    /trades/new, /contacts, /settings/entities, /settings/users).
  - Roles/nav: `frontend/src/config/nav.ts` (+roles, `navItemsForRole`), `Sidebar.tsx` (role-filtered),
    `Topbar.tsx` (signed-in user + role + sign-out), `frontend/src/config/routes.ts` (+partner/login/forgot).
  - Visibility (§3.4): `ClientListPage.tsx` (Internal view-only — Add/Edit/Delete hidden),
    `TradeFolderPage.tsx` (Financials card SuperAdmin-only).
  - User Management: `frontend/src/features/users/services/userService.ts` (list/updateRole/setActive +
    invite via Edge Function), `frontend/src/features/users/components/{UsersPage,InviteUserModal}.tsx`
    (self cannot change own role / deactivate self, §2.4).
  - Partner: `frontend/src/features/partner/components/PartnerDashboard.tsx` (role-gated landing shell;
    full content in the Partner Dashboard task).
  - **Scaffold (credential-dependent):** `backend/supabase/functions/invite-user/index.ts` (service-role
    auth-admin invite + profile upsert; authorizes caller as super_admin) and `backend/.env.example`
    (RESEND_API_KEY / ALERT_* placeholders + TODOs). No secrets in the client.
- **Reason:** PRD §2 (auth, invite-only, login, forgot-password) + §3 (roles, permission matrix, role landing).
- **Verification:** typecheck clean · test 38/38 · build ok · dev server boots (HTTP 200; dev auto-login
  passes the guard → app shell, no redirect loop).
- **Notes (scaffolded blockers):** Forgot-password uses Supabase Auth's mailer (point Supabase SMTP at
  Resend for `@chipafarm.com` delivery — TODO in `ForgotPasswordPage`); user invites call the `invite-user`
  Edge Function which needs the service-role key (auto-injected on deploy) + Resend. Until deployed/secreted,
  invites surface a clear inline error; all other auth + role gating works now.
  **Phase-1 flow preserved:** dev auto-login establishes the super_admin session up-front, so
  upload→…→save is unchanged in dev; the PRD-required login now gates the app for real (per §2).

### ✅ Task: Trade lifecycle / milestone tracking + status (PRD §9.2/§10.3)
- **Status:** Done.
- **Files modified:** `frontend/src/features/trades/milestones.ts` (new — deadline = signing/BOL + 7 days,
  phase = pending/received/overdue, badges/labels), `frontend/src/features/trades/components/detail/TradeFolderPage.tsx`
  (new SuperAdmin-only "Lifecycle & milestones" card: signing-date input, "Mark as sent" (draft→active),
  "Mark received" for advance/balance → sets `*_status`+`*_received_at`+`trade_status`; live overdue display).
- **Reason:** PRD §9.2 payment milestone tracking + §10.3 status states.
- **Verification:** typecheck clean · test 38/38 · build ok · live probe: draft→active→advance_received→
  balance_received with timestamps persisted under RLS ✓.
- **Notes:** Milestone logging gated to SuperAdmin (§3.4). "shipped" status + BOL-date capture are part of
  the next task (Folder document management). Persisting "overdue" to the row is the alerts cron's job
  (Task: Milestone alerts); the folder computes the overdue display live. Phase-1 flow untouched.

### ✅ Task: Trade Folder document management (PRD §10.1–10.2)
- **Status:** Done.
- **Files modified:** `frontend/src/services/storage/storageService.ts` (+`uploadDocument` generic file
  upload), `frontend/src/features/trades/components/detail/TradeFolderPage.tsx` (upload form: document
  type = signed_contract/bol/other, file picker; BOL upload prompts for BOL date → records `bol_date` +
  advances `trade_status` to `shipped`; uploads gated to super_admin + internal per §3.4).
- **Reason:** PRD §10 Trade Folder — upload signed contract / BOL / additional docs; BOL date handling.
- **Verification:** typecheck clean · test 38/38 · build ok · live probe: upload to storage + `documents`
  row (type bol) + BOL date → `shipped` ✓; cleaned up.
- **Notes:** Original supplier PDF + generated sales contract are already auto-saved (Phase-1). Download
  available to all who can see the folder; uploads for staff (super_admin/internal). Phase-1 flow untouched.

### ✅ Task: Audit Trail ZIP (PRD §12.1)
- **Status:** Done.
- **Files modified:** `frontend/src/features/exports/zip.ts` (new — dependency-free STORE-method ZIP
  writer + CRC-32; PDFs are already compressed so no deflate needed), `frontend/src/features/exports/zip.test.ts`
  (new — CRC-32 + container structure), `frontend/src/features/exports/auditTrail.ts` (new — fetches each
  document via signed URL and bundles, with stable numeric prefixes), `TradeFolderPage.tsx` (SuperAdmin-only
  "Audit ZIP" action in the Documents header → downloads `audit-<ref>.zip`).
- **Reason:** PRD §12.1 one-click per-trade "chain of title" document bundle.
- **Verification:** typecheck clean · test 40/40 (2 new) · build ok. (Bundling fetches signed URLs at
  runtime in the browser; the zip writer is unit-tested.)
- **Notes:** No new dependency added (npm install avoided) — pure-JS ZIP. SuperAdmin-only per §3.4.

### ✅ Task: Tax Readiness Export (PRD §12.2)
- **Status:** Done.
- **Files modified:** `frontend/src/features/exports/taxReadiness.ts` (new — fetch trades⋈client⋈entity,
  filter by contract year, `toCsv`, `toPdf` via pdf-lib; income classification "Foreign Sourced Income
  (Non-US)"; entity-period flag = the trade's entity), `frontend/src/features/exports/taxReadiness.test.ts`
  (new — CSV/year helpers), `frontend/src/features/exports/components/TaxReadinessPage.tsx` (new — year
  picker, preview table, CSV + PDF export), `routes.ts`/`nav.ts`/`router.tsx` (`/settings/tax-readiness`,
  SuperAdmin-only).
- **Reason:** PRD §12.2 annual CSV/PDF export for the CPA (IRS 5472/1065 prep), SuperAdmin only.
- **Verification:** typecheck clean · test 43/43 (3 new) · build ok.
- **Notes:** Data export only (not a filing), per §16. SuperAdmin-gated (route + nav). Phase-1 untouched.

### ✅ Task: Partner Dashboard (PRD §13)
- **Status:** Done (one backend RLS migration to apply for client names — scaffolded).
- **Files modified:** `frontend/src/features/partner/partnerData.ts` (new — fetch trades⋈client⋈entity +
  `summarize` portfolio; never includes split), `frontend/src/features/partner/partnerData.test.ts` (new),
  `frontend/src/features/partner/components/PartnerDashboard.tsx` (full — portfolio overview: total trades,
  invested capital, net profit, active count, overdue milestones; filterable trade list; per-trade detail
  modal with financial breakdown + milestones + document downloads; no profit split anywhere),
  `backend/supabase/migrations/20260627120000_partner_read_clients.sql` (new — read-only `clients` SELECT
  for the partner role so the dashboard can show client names; partners still have no Client CMS write).
- **Reason:** PRD §13 dedicated read-only partner portal.
- **Verification:** typecheck clean · test 44/44 (1 new) · build ok · backend migration check applies the new
  policy cleanly (PGlite).
- **Notes (scaffolded blocker):** the partner-read-clients policy is a **new migration that must be applied
  to the live DB** (DDL — I can't run it without DB/service-role access); until applied, the partner trade
  list shows "—" for client names (everything else works). Live partner testing also needs a partner user
  (created via the invite Edge Function once Resend + service-role are set). No partner data is leaked to
  other roles; super_admin/internal are redirected away from /partner.

### ✅ Task: Milestone Alerts (PRD §11) — scaffolded (credential/cron-blocked)
- **Status:** Architecture complete; live emails/cron need secrets + scheduling.
- **Files modified:** `backend/supabase/functions/milestone-alerts/index.ts` (new — daily overdue check:
  advance = signing_date+7, balance = bol_date+7; flips milestone+trade to `overdue`; emails SuperAdmin
  via Resend per §11.3; env placeholders + TODOs), `frontend/src/features/trades/tradeStatus.ts`
  (`statusBadge` surfaces "Overdue" distinctly), `TradeListPage.tsx` (overdue badge — §11.2 in-app).
- **Reason:** PRD §11 milestone alerts + in-app surfacing.
- **Verification:** typecheck clean · test 44/44 · build ok · migration check passes.
- **Notes (scaffolded blocker):** deploy `milestone-alerts` + schedule a daily cron, and set
  `RESEND_API_KEY` / `ALERT_TO_EMAIL` (see `backend/.env.example`). Even without email secrets the function
  flips milestones to overdue (surfaced in-app: trade-list badge, folder milestone badges, partner
  "Overdue milestones" metric). In-app overdue is live now.

### ✅ Final QA pass (2026-06-27)
- **Programmatic:** typecheck clean · test 44/44 (9 files) · build ok · backend migration+seed check ok.
- **Code review (3 agents):** routing/nav integrity — no broken links, guards correctly nested, no redirect
  loops; states — every data page has loading/error/empty; runtime — all `.map` keyed, selector fallbacks
  guarantee non-empty; offline fallbacks intact (editor catalogs + bundled template).
- **Fixed:** 2 unguarded async handlers that failed silently — `CompanyContractEditor.handleDownload`
  (now try/catch → surfaces error) and `TaxReadinessPage` CSV/PDF export (now try/catch + inline error
  banner). Re-verified green.
- **Reviewed, intentionally left:** `CardFooter`/`DEFAULT_COMPANY_SELLER`/`MirroredContract.seller` are
  used internally or by tests (removing = redesign risk); 3 small identical `formatDate` helpers (trivial
  duplication, low value to consolidate). No dead code that affects behavior.
- **Known limitation (not fixed — would be new UI/redesign):** the sidebar is `hidden md:flex` with no
  mobile drawer, so on <768px there's no nav rail (content/pages are responsive). Consistent with PRD §16
  "web only"; documented, not built (per "no new features / no redesign").

### ✅ Fix pass: TS deprecation flag + Resend email wiring (2026-06-27)
- **TS deprecation:** added `ignoreDeprecations` to `frontend/tsconfig.app.json`. Requested value `"6.0"`
  is rejected by the pinned TypeScript 5.6.2 (error TS5103) — used the compiler-valid `"5.0"` instead
  (switch to `"6.0"` only after upgrading to a TS version that mandates it). Root `tsconfig.app.json`
  does not exist (it lives in `frontend/` since the monorepo split), so only the frontend copy was edited.
- **Resend env:** `RESEND_API_KEY` was unset everywhere (only an empty value in `backend/.env.example`;
  no `backend/.env`). Created `backend/.env` (gitignored) with placeholders: `RESEND_API_KEY=your_resend_api_key_here`,
  `ALERT_FROM_EMAIL=alerts@chipafarm.com`, `ALERT_TO_EMAIL=ali@chipafarm.com`.
- **invite-user fn:** now reads `RESEND_API_KEY` and sends a branded invite via Resend (from a
  `@chipafarm.com` address) using an admin-generated invite link; falls back to Supabase's invite mailer
  when no key; returns 502 if the email send fails (added error handling).
- **milestone-alerts fn:** treats the placeholder key as unset; wrapped the Resend send in try/catch so one
  failure can't crash the run; reports `emailSkipped`/`emailErrors`; fixed the inaccurate 500 message.
- **Verify:** typecheck PASS · test PASS (44/44) · build PASS.

## ✅ ROADMAP COMPLETE (PRD v2.0)
All build-sequence features are implemented or fully scaffolded; Phase-1 flow preserved throughout;
44 tests · typecheck · build · backend migration check all green.

**Remaining to operationalize (external credentials/DDL only — code complete):**
1. Set `RESEND_API_KEY` (+ verify `@chipafarm.com`) and point Supabase Auth SMTP at Resend →
   forgot-password + invite emails + milestone-alert emails go live.
2. Deploy Edge Functions (`invite-user`, `milestone-alerts`) and schedule the daily alerts cron.
3. Apply migration `20260627120000_partner_read_clients.sql` to the live DB (partner client names).
4. (Optional) set `ALERT_TO_EMAIL` to the owner's address.
None require code changes — the architecture + env placeholders + TODOs are in place.

## Final Phase-1 verification (2026-06-27)
- **Live end-to-end verified**: upload → parse (FROZEN OFFALS, 27,00) → review → mirror (total 60,750)
  → overlay PDF (`%PDF-`) → auth (super_admin) → storage upload → `trades` insert (generated
  `net_profit` 4050) → `documents` insert → rows + storage object confirmed present → cleaned up.
- **Supabase confirmed**: `trades` + `documents` writes succeed under RLS; `trade-documents` bucket
  accepts uploads; `backend` migration+seed check passes (2 entities, 1 bank, 1 client, 1 contact).
- **Cleanup**: removed the superseded fresh-PDF generator (`generateCompanyContractPdf.ts` + its test),
  the unused `OverlayResult` type, and a leftover dev `console.log` in AuthContext. No behavior change.
- **Verification**: `npm run typecheck` clean · `npm test` 35/35 · `npm run build` ok · `backend` dev ok.

## Monorepo structure (frontend / backend split)
The project is now split into two runnable workspaces; dependencies are installed **once** at
the repo root (`node_modules/`) and resolved by both via standard upward Node/npm resolution (no
duplicate install, no per-workspace node_modules required):

```
TradeMirrorOS/
  package.json        ← root: convenience scripts (dev:frontend, dev:backend, build, test, typecheck)
  node_modules/       ← shared install (resolved upward by both workspaces)
  frontend/           ← Vite React app: src/, index.html, vite/vitest/ts/tailwind configs, .env
      cd frontend && npm run dev        (UI, pages, components, PDF rendering, editor, client-side logic)
  backend/            ← Supabase DB layer: supabase/ (migrations, seed, RLS, storage, setup_phase1.sql), scripts/
      cd backend && npm run dev         (validates migrations + seed via PGlite; check:supabase, seed:users)
```

Note on scope: the client-side Supabase service modules (auth/storage/persistence) **stay in
`frontend/src`** because the app calls Supabase directly (anon key + RLS). Extracting them into a
standalone HTTP API would mean rewriting working logic and changing behavior, which this task
explicitly forbids — so `backend/` houses the actual backend assets (schema, migrations, seed,
policies, admin scripts), the correct split for a Supabase app. A future HTTP-API extraction is a
separate, larger redesign (offer, not done).

Verified: `frontend` typecheck + 38 tests + build all pass and the dev server serves on :3000
(HTTP 200); `backend` `npm run dev` applies all migrations + seed cleanly.

## Status
- ✅ Overlay engine built & verified (white-block + inject onto the real 701-2026 PDF).
- ✅ Core flow works with no login/backend: upload → parse → edit → preview → download.
- ✅ Duplicate AuthProvider removed; storage upload made best-effort; debug logging removed.
- ✅ Active entity set to Chipa Tech E.A.S. everywhere; persistence context made consistent.
- ✅ **Field-rule compliance pass** (see below).
- ✅ `npm run typecheck`, `npm test` (36/36), and `npm run build` all green.
- ✅ **SAVE works end-to-end.** Backend provisioned (tables, bucket, confirmed superadmin). Verified
  programmatically against the live project: auto-login → storage upload → trades insert → documents
  insert all succeed (super_admin, RLS passes). `persistGeneratedContract` now establishes the
  hardcoded admin session on demand so a Save clicked before auto-login resolves no longer fails.

## Field-rule compliance (Phase-1 spec)
Review step (`ExtractionReview`): pure-mirror fields — Quantity, Commodity, Incoterm, Unit,
Quality, Delivery terms, Payment terms — are now **read-only** (locked, "mirrored from source"),
and excluded from required-review. They become editable only in manual-entry mode (extraction
failed). Editable in review: supplier name/tax-id, buyer, contract no., issue date, supplier
unit price + total.

Editor (`CompanyContractEditor`):
- **Active Entity** → selector (read-only profile shown). Drives exporter + buyer signature.
- **Banking Profile** → selector (read-only profile shown), filtered by entity.
- **Contact Person** → selector (read-only profile shown).
- **Client (buyer)** → editable (ad-hoc end customer; no client selector requested).
- **Quantity / Commodity / Incoterm / Quality / Delivery** → read-only `LockedField`.
- **Total amount + Grand total** → auto-calculated (qty × sale price), shown read-only.
- **Payment conditions** → auto-generated: prepayment = 50% of total + admin date; balance =
  50% against BL copy (read-only lines; only the prepayment date is an admin input).
- **Admin inputs**: sale unit price (+margin helper), freight cost, insurance cost, bank fees,
  prepayment date.
- Selected entity/bank/contact ids flow into the trades persistence context.

## Locked-field override + Client selector (latest)
- **Unlock-to-override on mirrored cargo** (`LockedField`): Commodity, Quantity, Quality,
  Incoterm, Delivery terms are locked by default ("Mirrored from source"). Each has an
  **Unlock field** action that makes only that field editable, badges it **Modified manually**,
  preserves the original value (shown for reference) and a **Reset** to relock/restore.
  The overlay white-blocks + re-injects overridden Commodity / Quantity / Incoterm so the PDF
  reflects the change (quantity also recalculates the totals). Quality & Delivery terms have no
  single slot on this template → recorded only (clearly labelled).
- **Client selector + Add Client** (`ClientSelector` + `AddClientModal`): the buyer is now
  chosen from the `clients` table (search by company / contact / email), with **+ Add Client**
  saving a new row (`clientService.create`, `tax_id` defaults to "") and auto-selecting it. A
  Phase-1 default client (seed 4444…) keeps the selector populated and preview working offline.
  The selected client id flows into the trades persistence context. Overlay engine, payment
  generation, totals, and active-entity logic unchanged. Tests: 38 pass · typecheck · build green.

## Decisions (from you)
1. **PDF engine = B: real overlay.** White-block the existing fields on the uploaded
   701-2026 PDF and inject new values at hardcoded coordinates. Do **not** generate a fresh PDF.
2. **Active entity = Chipa Tech E.A.S.**
3. **Phase-1 auth must not block the flow.** upload → parse → edit → preview → download must
   work with no login. (Save-to-backend is the only step that needs the database — see below.)

## Remote Supabase — verified live state (probed with the anon key + hardcoded creds)
- Project reachable, anon key accepted.
- **All 7 tables are MISSING** (`PGRST205`) → migrations have **not** been applied.
- **No storage buckets exist** → `trade-documents` not created.
- **`superadmin@chipafarm.com` exists but is _unconfirmed_** → dev auto-login currently can't
  sign in ("Email not confirmed").

**Consequence:** the **save** step (upload PDF to Storage + insert `trades`/`documents`) cannot
succeed until the backend is provisioned. RLS is enforced server-side, so no client trick fixes
this — the schema, seed, bucket, and a confirmed super_admin must exist. Everything *before*
save is 100% client-side and I'm making it backend-independent today.

### What I need from you to make SAVE work end-to-end (pick one)
- **Easiest:** in the Supabase dashboard SQL editor, run, in order:
  `migrations/20260626120000_init_schema.sql`, `…120050_auth_helpers.sql`, `…120100_storage.sql`,
  `…120200_rls.sql`, then `supabase/seed.sql`. Then either confirm the superadmin user in
  Auth → Users, or turn off "Confirm email" for now. _(I'll provide a single combined file.)_
- **Or hand me a Supabase _personal access token_ (`sbp_…`)** — I'll apply all migrations + seed
  via the Management API, create the bucket, and confirm/create the superadmin user myself, then
  verify the full save path.
- **Or the `SUPABASE_SERVICE_ROLE_KEY` + DB password** — same outcome via CLI/admin API.

Until then: the loop runs through **download**; save shows a clear "backend not provisioned" notice.

---

## Phase-1 auth approach (no login screen)
- The app already has **dev auto-login** (a hardcoded admin session) — that IS the Phase-1
  "hardcoded admin session." It signs in automatically; there's no login page. It will start
  working the moment the superadmin user is confirmed and the schema exists.
- I am **decoupling the core flow from auth/storage** so it never blocks:
  - Saving the *original* upload to Storage becomes **best-effort** — on failure the flow proceeds
    straight to extraction with a small warning (no dead-end "couldn't save" screen).
  - **Preview / download** are pure client-side pdf-lib — they never touch auth. (Already true;
    keeping it that way.)
  - **Save to Trade Folder** keeps its session guard but degrades gracefully (download still works;
    a clear message explains the backend is needed).
- Fixing the **duplicate `AuthProvider`** (it's mounted in both `main.tsx` and `providers.tsx`,
  so auto-login + listeners run twice).

## The overlay engine (the main build)
Anchored to the measured 701-2026 layout (A4 595×842, bottom-left origin — matches pdf-lib).
For each **WHITE-BLOCK** field: paint a white rectangle over the source text, then draw the new
value. **PURE-MIRROR** fields are simply left in place (the big win of overlay vs. regenerate —
Brand/Temp/Packing/Validity/Plant No./Incoterm/clauses/QR/Frigo signature all survive untouched,
no parser work needed for them).

White-block fields + data source:
| Field (coords measured) | Injected from |
|---|---|
| Exporter (name/RUC/addr/city/country) | Active entity = Chipa Tech E.A.S. |
| Client (name/addr/city/country) | Selected client (editor buyer) |
| Contact Person (name/phone/email) | Default contact (editable) |
| Payer + payment-origin countries | Mirrors client |
| Unitary Price | Sale unit price (admin) |
| Total U$ + Grand Total | Quantity × sale price |
| Prepayment Condition | 50% of new total + admin date |
| Balance Condition | 50% of new total / BL copy |
| Freight cost, Insurance cost | Admin inputs |
| Beneficiary bank block | Active banking profile |
| Buyer signature | Active entity name |

## Files
- **Create:** `src/core/pdf-engine/coordinate-map/contract701-2026.ts` (coords + `OverlayData` +
  `buildOverlayOps`), `src/core/pdf-engine/generate/generateOverlayContractPdf.ts`,
  `src/core/mirroring/phase1Defaults.ts`, overlay tests, `supabase/all_in_one_setup.sql` (combined).
- **Modify:** `src/core/domain/finance.ts` (+`formatLatinNumber`), `src/core/mirroring/buildMirroredContract.ts`
  (default seller → E.A.S.), the editor (`CompanyContractEditor.tsx` switch to overlay + contact/bank/date UI),
  the workflow wiring to thread the original PDF bytes (`useContractExtraction.ts`,
  `ContractExtractionPage.tsx`, `NewTradeWorkflow.tsx`), `contractPersistence.ts`
  (E.A.S. context + remove debug), `storageService.ts` (remove debug), `main.tsx` (drop dup provider).
- **Keep:** the fresh-PDF generator + its test (not used by the editor anymore; harmless, suite stays green).

## Verification
- `npm run typecheck` + `npm test` green.
- Generate the overlay from the fixture, save the PDF, and **read it back as an image** to visually
  confirm white-blocks land on the right fields and pure-mirror content is intact. Iterate coords.

## Not in Phase 1 (unchanged)
Full auth UI, Partner Dashboard, Resend alerts, Tax Readiness, Audit Trail ZIP, multi-template support.
