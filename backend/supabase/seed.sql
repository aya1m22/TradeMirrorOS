-- ─────────────────────────────────────────────────────────────────────────
-- Seed data (idempotent). Covers entities, a sample banking profile, a sample
-- client, and a sample contact. The three platform users (SuperAdmin /
-- Internal / Partner) are created by scripts/seed-auth-users.mjs, because auth
-- users must be provisioned through Supabase Auth, not raw SQL.
--
-- Values marked PENDING are admin-input fields in the PRD (§4.1) with no value
-- in the source documents; they are placeholders to keep NOT NULL satisfied.
-- ─────────────────────────────────────────────────────────────────────────

-- ── Entities: the EAS → LLC operational toggle (PRD §4.1) ───────────────
insert into public.entities (id, name, country, ruc_ein, address, city, is_active)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Chipa Tech E.A.S.', 'Paraguay', 'PENDING',
    'Calle Dr. Eusebio Lilio y Bernardino Caballero #2880', 'Asuncion', true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Chipa Farm LLC', 'USA (Wyoming)', 'PENDING',
    'PENDING', 'PENDING', true
  )
on conflict (id) do nothing;

-- ── Sample banking profile for the EAS entity (mirrors 701-2026 routing) ─
insert into public.bank_profiles (
  id, entity_id, profile_name, beneficiary_name, beneficiary_address,
  intermediary_bank_name, intermediary_bank_swift, bank_name, bank_swift,
  account_number, ara_number, field_71a, is_default
)
values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'EAS — Banco Nacional de Fomento',
  'Chipa Tech E.A.S.', 'Asuncion, Paraguay',
  'CITIBANK NA', 'CITIUS33',
  'BANCO NACIONAL DE FOMENTO', 'BNFAPYPAXXX',
  '000000000000', null, 'OUR', true
)
on conflict (id) do nothing;

-- ── Sample client / buyer (701-2026 destination: Alexandria, Egypt) ─────
insert into public.clients (
  id, company_name, address, city, country, tax_id,
  contact_name, contact_email, contact_phone, notes
)
values (
  '44444444-4444-4444-4444-444444444444',
  'Al Manara Trading LLC', '14 Corniche Road', 'Alexandria', 'Egypt', 'EG-000000000',
  'Mohamed Said', 'buyer@almanara.example', '+20 100 000 0000',
  'Sample buyer record for development.'
)
on conflict (id) do nothing;

-- ── Sample contact (the trade-desk contact from the source contract) ────
insert into public.contacts (id, full_name, phone, email, role, is_default)
values (
  '55555555-5555-5555-5555-555555555555',
  'Ali Kanso', '+20 1017299515', 'ali@chipafarm.com', 'Trade Desk', true
)
on conflict (id) do nothing;
