-- ─────────────────────────────────────────────────────────────────────────
-- TradeMirror OS — schema foundation (PRD §14)
-- Enums, the seven tables, relationships, indexes, and the updated_at trigger.
-- No business logic: the only computed values are the two columns the PRD
-- marks "-- computed" (total_costs, net_profit), implemented as generated
-- columns so the database enforces the invariant.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Enums (PRD §3, §9.2, §10.1, §10.3) ──────────────────────────────────
create type public.user_role as enum ('super_admin', 'internal', 'partner');
create type public.milestone_status as enum ('pending', 'received', 'overdue');
create type public.document_type as enum (
  'frigo_contract', 'sales_contract', 'signed_contract', 'bol', 'other'
);
create type public.trade_status as enum (
  'draft', 'active', 'advance_received', 'shipped', 'balance_received', 'overdue'
);

-- ── users (id matches Supabase Auth user id) ────────────────────────────
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  full_name     text not null,
  role          public.user_role not null,
  is_active     boolean not null default true,
  invited_at    timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- ── entities (the EAS / LLC operational toggle) ─────────────────────────
create table public.entities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  country    text not null,
  ruc_ein    text not null,
  address    text not null,
  city       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── bank_profiles (one or more per entity) ──────────────────────────────
create table public.bank_profiles (
  id                      uuid primary key default gen_random_uuid(),
  entity_id               uuid not null references public.entities (id) on delete cascade,
  profile_name            text not null,
  beneficiary_name        text not null,
  beneficiary_address     text not null,
  intermediary_bank_name  text not null,
  intermediary_bank_swift text not null,
  bank_name               text not null,
  bank_swift              text not null,
  account_number          text not null,
  ara_number              text,
  field_71a               text not null default 'OUR',
  is_default              boolean not null default false,
  created_at              timestamptz not null default now()
);

-- ── clients (buyers) ────────────────────────────────────────────────────
create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  company_name  text not null,
  address       text not null,
  city          text not null,
  country       text not null,
  tax_id        text not null,
  contact_name  text not null,
  contact_email text not null,
  contact_phone text not null,
  notes         text,
  created_at    timestamptz not null default now()
);

-- ── contacts (internal address book) ────────────────────────────────────
create table public.contacts (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  phone      text not null,
  email      text not null,
  role       text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── trades ──────────────────────────────────────────────────────────────
create table public.trades (
  id                  uuid primary key default gen_random_uuid(),
  trade_reference     text not null unique,
  entity_id           uuid not null references public.entities (id),
  bank_profile_id     uuid not null references public.bank_profiles (id),
  client_id           uuid not null references public.clients (id),
  contact_id          uuid not null references public.contacts (id),
  contract_date       date not null,
  signing_date        date,
  bol_date            date,
  frigo_contract_ref  text not null,
  quantity_tons       numeric(14, 3) not null,
  product_description text not null,
  frigo_unit_price    numeric(14, 4) not null,
  frigo_total         numeric(14, 2) not null,
  sale_unit_price     numeric(14, 4) not null,
  sale_total          numeric(14, 2) not null,
  shipping_cost       numeric(14, 2) not null default 0,
  insurance_cost      numeric(14, 2) not null default 0,
  bank_fees           numeric(14, 2) not null default 0,
  -- PRD §9.1 "-- computed": enforced by the database, not the app.
  total_costs numeric(14, 2)
    generated always as (frigo_total + shipping_cost + insurance_cost + bank_fees) stored,
  net_profit numeric(14, 2)
    generated always as (sale_total - (frigo_total + shipping_cost + insurance_cost + bank_fees)) stored,
  advance_status      public.milestone_status not null default 'pending',
  advance_received_at timestamptz,
  balance_status      public.milestone_status not null default 'pending',
  balance_received_at timestamptz,
  trade_status        public.trade_status not null default 'draft',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── documents (Trade Folder metadata; files live in Storage) ────────────
create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  trade_id      uuid not null references public.trades (id) on delete cascade,
  document_type public.document_type not null,
  file_name     text not null,
  storage_path  text not null,
  uploaded_by   uuid not null references public.users (id),
  uploaded_at   timestamptz not null default now()
);

-- ── Indexes on foreign keys and common lookups ──────────────────────────
create index idx_bank_profiles_entity_id on public.bank_profiles (entity_id);
create index idx_trades_entity_id        on public.trades (entity_id);
create index idx_trades_bank_profile_id  on public.trades (bank_profile_id);
create index idx_trades_client_id        on public.trades (client_id);
create index idx_trades_contact_id       on public.trades (contact_id);
create index idx_trades_trade_status     on public.trades (trade_status);
create index idx_documents_trade_id      on public.documents (trade_id);
create index idx_documents_uploaded_by   on public.documents (uploaded_by);

-- At most one default contact, and one default bank profile per entity
-- (PRD §4.2 / §6.1). Pure schema integrity, no application logic.
create unique index uq_contacts_single_default
  on public.contacts (is_default) where is_default;
create unique index uq_bank_profiles_default_per_entity
  on public.bank_profiles (entity_id) where is_default;

-- ── updated_at maintenance for trades ───────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();
