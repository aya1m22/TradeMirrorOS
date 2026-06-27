-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security — enforces the PRD §3.4 permission matrix at the database.
--
-- Table grants give the `authenticated` Postgres role the privilege; the
-- policies below decide which rows each app role may touch. Column-level
-- financial visibility (hiding Frigo price / financials from Internal) is a
-- column concern handled by the trades feature's queries, not row policies.
-- ─────────────────────────────────────────────────────────────────────────

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.users, public.entities, public.bank_profiles, public.clients,
  public.contacts, public.trades, public.documents
to authenticated;

alter table public.users         enable row level security;
alter table public.entities      enable row level security;
alter table public.bank_profiles enable row level security;
alter table public.clients       enable row level security;
alter table public.contacts      enable row level security;
alter table public.trades        enable row level security;
alter table public.documents     enable row level security;

-- ── users: read own profile; only SuperAdmin manages users (PRD §2.4) ────
create policy "users: read self or admin" on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());
create policy "users: admin insert" on public.users
  for insert to authenticated with check (public.is_super_admin());
create policy "users: admin update" on public.users
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "users: admin delete" on public.users
  for delete to authenticated using (public.is_super_admin());

-- ── entities: readable by any active user (for trade display); admin writes ─
create policy "entities: read active" on public.entities
  for select to authenticated using (public.is_active_user());
create policy "entities: admin write" on public.entities
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── bank_profiles: SuperAdmin only — they hold beneficiary account data ──
create policy "bank_profiles: admin only" on public.bank_profiles
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── clients: SuperAdmin full, Internal view-only, Partner none (PRD §3.4) ─
create policy "clients: read staff" on public.clients
  for select to authenticated
  using (public.current_app_role() in ('super_admin', 'internal'));
create policy "clients: admin write" on public.clients
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── contacts: SuperAdmin only (PRD §3.4) ────────────────────────────────
create policy "contacts: admin only" on public.contacts
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── trades: all active users read; only SuperAdmin writes (PRD §3.4) ─────
create policy "trades: read active" on public.trades
  for select to authenticated using (public.is_active_user());
create policy "trades: admin write" on public.trades
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ── documents: all read; staff upload; admin modify (PRD §3.4) ──────────
create policy "documents: read active" on public.documents
  for select to authenticated using (public.is_active_user());
create policy "documents: staff insert" on public.documents
  for insert to authenticated
  with check (
    public.is_active_user()
    and public.current_app_role() in ('super_admin', 'internal')
  );
create policy "documents: admin update" on public.documents
  for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy "documents: admin delete" on public.documents
  for delete to authenticated using (public.is_super_admin());
