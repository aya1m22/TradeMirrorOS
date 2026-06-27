-- ─────────────────────────────────────────────────────────────────────────
-- Delivery hardening (2026-06-28)
-- Server-side enforcement of the financial-visibility matrix + partner trade
-- scoping. Idempotent: safe to run on a DB already provisioned from
-- setup_phase1.sql, and ordered after the base migrations for the PGlite check.
--
-- Visibility matrix (enforced at the DATABASE, not just the UI):
--   • Super Admin → every trade, every column (incl. all financials).
--   • Internal    → every trade, but NO financial figures at all.
--   • Partner     → only trades assigned to them; net_profit only (no cost
--                   breakdown, no buy/sale prices).
--
-- Mechanism: the base `trades` table SELECT is locked to super_admin, so the
-- financial columns are unreachable through the auto-generated REST API for
-- anyone else. Internal and Partner read through the `v_trades` view, which
-- masks columns and scopes rows by role. The view is SECURITY DEFINER (the
-- default for views): it runs as its owner, bypassing the base-table RLS, and
-- its own WHERE clause is the access gate — masking is therefore real, not
-- cosmetic.
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. Partner → trade assignment link (additive, nullable) ───────────────
alter table public.trades
  add column if not exists partner_id uuid references public.users (id);
create index if not exists idx_trades_partner_id on public.trades (partner_id);

comment on column public.trades.partner_id is
  'Partner (users.role = partner) this trade is assigned to. NULL = unassigned. '
  'Drives the Partner Dashboard row scoping in v_trades.';

-- ── 2. Helper: does the current user own (is assigned to) this trade? ──────
-- SECURITY DEFINER so the lookup is not blocked by the (now super_admin-only)
-- trades SELECT policy; used by the documents read policy below.
create or replace function public.user_owns_trade(p_trade uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trades t
    where t.id = p_trade and t.partner_id = auth.uid()
  );
$$;
revoke all on function public.user_owns_trade(uuid) from public;
grant execute on function public.user_owns_trade(uuid) to authenticated;

-- ── 3. Lock the base trades table: only Super Admin may SELECT raw rows ────
-- (Writes are already super_admin-only via "trades: admin write".) Internal and
-- Partner now read exclusively through v_trades, so financial columns can never
-- be pulled directly from /rest/v1/trades.
drop policy if exists "trades: read active" on public.trades;
drop policy if exists "trades: read admin" on public.trades;
create policy "trades: read admin" on public.trades
  for select to authenticated using (public.is_super_admin());

-- ── 4. Masking + scoping view used by Internal and Partner (and Super Admin) ─
drop view if exists public.v_trades;
create view public.v_trades as
  select
    t.id,
    t.trade_reference,
    t.entity_id,
    t.bank_profile_id,
    t.client_id,
    t.contact_id,
    t.partner_id,
    t.contract_date,
    t.signing_date,
    t.bol_date,
    t.frigo_contract_ref,
    t.quantity_tons,
    t.product_description,
    -- Financial columns: Super Admin only; NULL for everyone else.
    case when public.is_super_admin() then t.frigo_unit_price end as frigo_unit_price,
    case when public.is_super_admin() then t.frigo_total      end as frigo_total,
    case when public.is_super_admin() then t.sale_unit_price  end as sale_unit_price,
    case when public.is_super_admin() then t.sale_total       end as sale_total,
    case when public.is_super_admin() then t.shipping_cost    end as shipping_cost,
    case when public.is_super_admin() then t.insurance_cost   end as insurance_cost,
    case when public.is_super_admin() then t.bank_fees        end as bank_fees,
    case when public.is_super_admin() then t.total_costs      end as total_costs,
    -- net_profit: Super Admin always; the assigned Partner for their own trades.
    case
      when public.is_super_admin() then t.net_profit
      when public.current_app_role() = 'partner' then t.net_profit
    end as net_profit,
    t.advance_status,
    t.advance_received_at,
    t.balance_status,
    t.balance_received_at,
    t.trade_status,
    t.created_at,
    t.updated_at,
    c.company_name as client_company_name,
    e.name         as entity_name
  from public.trades t
  left join public.clients  c on c.id = t.client_id
  left join public.entities e on e.id = t.entity_id
  where public.is_active_user()
    and (
      public.is_super_admin()
      or public.current_app_role() = 'internal'
      or (public.current_app_role() = 'partner' and t.partner_id = auth.uid())
    );

comment on view public.v_trades is
  'Role-masked, row-scoped read model over public.trades. Super Admin: all '
  'rows+columns. Internal: all rows, financial columns NULL. Partner: own '
  'assigned rows only, net_profit visible but cost breakdown NULL. SECURITY '
  'DEFINER by design — the WHERE clause is the access gate.';

revoke all on public.v_trades from anon;
grant select on public.v_trades to authenticated;

-- ── 5. Scope document reads so Partners only see their assigned trades' docs ─
drop policy if exists "documents: read active" on public.documents;
drop policy if exists "documents: read scoped" on public.documents;
create policy "documents: read scoped" on public.documents
  for select to authenticated using (
    public.current_app_role() in ('super_admin', 'internal')
    or (
      public.current_app_role() = 'partner'
      and public.user_owns_trade(trade_id)
    )
  );

-- ── 6. Ensure the Storage bucket + object policies exist (idempotent) ──────
-- Consolidated here so a single run of this file guarantees uploads work, even
-- if the live project was provisioned before the storage migration landed.
insert into storage.buckets (id, name, public)
values ('trade-documents', 'trade-documents', false)
on conflict (id) do nothing;

drop policy if exists "trade docs: read for active users" on storage.objects;
create policy "trade docs: read for active users"
  on storage.objects for select to authenticated
  using (bucket_id = 'trade-documents' and public.is_active_user());

drop policy if exists "trade docs: upload for staff" on storage.objects;
create policy "trade docs: upload for staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trade-documents'
    and public.is_active_user()
    and public.current_app_role() in ('super_admin', 'internal')
  );

drop policy if exists "trade docs: update for admin" on storage.objects;
create policy "trade docs: update for admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'trade-documents' and public.is_super_admin())
  with check (bucket_id = 'trade-documents' and public.is_super_admin());

drop policy if exists "trade docs: delete for admin" on storage.objects;
create policy "trade docs: delete for admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trade-documents' and public.is_super_admin());
