-- ─────────────────────────────────────────────────────────────────────────
-- Auth infrastructure (2026-06-28): invitation + password-reset token store.
--
-- Backs the custom invite and forgot-password flows. Tokens are NEVER stored
-- raw: the email carries a 256-bit random token, and only its SHA-256 hash is
-- written here, so a database leak can't be replayed against the live flow.
-- Expiry + single-use (accepted_at / used_at) are enforced by the Edge
-- Functions that own these tables; credential storage and sessions stay in
-- Supabase Auth (GoTrue) — we never hash passwords ourselves.
--
-- Both tables are locked: RLS is enabled with NO anon/authenticated policies
-- and direct grants are revoked, so the only reader/writer is the service role
-- (used by the Edge Functions, which bypasses RLS). Super Admins get read-only
-- visibility of pending invites through the masked `v_pending_invitations`
-- view, which never exposes token_hash.
--
-- Idempotent: safe to run on a DB already provisioned from setup_phase1.sql, or
-- to paste straight into the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. invitations ────────────────────────────────────────────────────────
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  full_name   text not null,
  role        public.user_role not null,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  invited_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.invitations is
  'Pending/accepted user invitations. token_hash = sha256(raw token); the raw '
  'token lives only in the emailed link. Owned exclusively by the invite-user / '
  'accept-invitation Edge Functions (service role).';

create index if not exists idx_invitations_email
  on public.invitations (lower(email));
create index if not exists idx_invitations_pending
  on public.invitations (lower(email)) where accepted_at is null;

-- ── 2. password_resets ────────────────────────────────────────────────────
create table if not exists public.password_resets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.password_resets is
  'Single-use password-reset tokens. token_hash = sha256(raw token). created_at '
  'drives per-user rate limiting. Owned exclusively by the request-password-reset '
  '/ reset-password Edge Functions (service role).';

create index if not exists idx_password_resets_user
  on public.password_resets (user_id);
create index if not exists idx_password_resets_created
  on public.password_resets (created_at);

-- ── 3. updated_at maintenance for invitations ─────────────────────────────
drop trigger if exists trg_invitations_set_updated_at on public.invitations;
create trigger trg_invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- ── 4. Lock both tables ───────────────────────────────────────────────────
-- RLS on + zero policies = default deny for anon/authenticated. Revoke the
-- Supabase default-privilege grants too, so the tables stay inaccessible to the
-- browser even if RLS were ever toggled off. The service role bypasses both.
alter table public.invitations    enable row level security;
alter table public.password_resets enable row level security;
revoke all on public.invitations    from anon, authenticated;
revoke all on public.password_resets from anon, authenticated;

-- ── 5. Admin-only pending-invitations read model (no token_hash) ──────────
drop view if exists public.v_pending_invitations;
create view public.v_pending_invitations as
  select
    i.id,
    i.email,
    i.full_name,
    i.role,
    i.expires_at,
    i.created_at,
    (i.expires_at < now()) as is_expired,
    i.invited_by
  from public.invitations i
  where i.accepted_at is null
    and public.is_super_admin();

comment on view public.v_pending_invitations is
  'Super-Admin-only list of unaccepted invitations for the Users page. '
  'SECURITY DEFINER by design — the is_super_admin() WHERE clause is the gate. '
  'Deliberately omits token_hash.';

revoke all on public.v_pending_invitations from anon;
grant select on public.v_pending_invitations to authenticated;

-- ── 6. Resolve an existing auth user id by email (service role only) ───────
-- accept-invitation uses this to make account creation idempotent: if an auth
-- user already exists for the email (e.g. a re-invite), it updates that user's
-- password instead of trying to create a duplicate. SECURITY DEFINER so it can
-- read auth.users; locked to the service role so it can never be used as an
-- email-enumeration oracle from the browser.
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;
revoke all on function public.auth_user_id_by_email(text) from public;
grant execute on function public.auth_user_id_by_email(text) to service_role;
