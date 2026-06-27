-- ─────────────────────────────────────────────────────────────────────────
-- Partner read access to clients (PRD §13 Partner Dashboard).
--
-- The Partner Dashboard trade list shows the client name per trade. Partners
-- still have NO Client CMS access (no insert/update/delete) — this grants
-- read-only SELECT so the dashboard can resolve client names. Idempotent-ish:
-- drop-if-exists then create.
--
-- NOTE: This is a new migration. Apply it to the live project (Supabase SQL
-- editor or `supabase db push`) for the Partner Dashboard's Client column to
-- populate; until applied, partners see "—" for client names.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "clients: read partner" on public.clients;
create policy "clients: read partner" on public.clients
  for select to authenticated
  using (public.current_app_role() = 'partner');
