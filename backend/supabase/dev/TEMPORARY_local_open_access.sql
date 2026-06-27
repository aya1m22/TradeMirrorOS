-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  TEMPORARY — LOCAL DEVELOPMENT ONLY.  DO NOT APPLY IN PRODUCTION.       ║
-- ║                                                                        ║
-- ║  Lets the app upload/save WITHOUT signing in, by creating the storage  ║
-- ║  bucket and opening RLS to the anon role. This deliberately weakens     ║
-- ║  security so you can test the PDF flow before seeding real users.       ║
-- ║                                                                        ║
-- ║  Prereq: apply the four migrations in supabase/migrations/ first (they  ║
-- ║  create the tables + real policies). Run this in the Supabase SQL       ║
-- ║  editor. REVERT with supabase/dev/REVERT_local_open_access.sql before   ║
-- ║  going anywhere near production.                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Ensure the bucket exists (the storage migration also does this).
insert into storage.buckets (id, name, public)
values ('trade-documents', 'trade-documents', false)
on conflict (id) do nothing;

-- TEMP: allow anon full access to the trade-documents bucket.
create policy "TEMP_dev_storage_open" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'trade-documents')
  with check (bucket_id = 'trade-documents');

-- TEMP: allow anon full access to the app tables (requires migrations applied).
create policy "TEMP_dev_users_open"         on public.users         for all to anon, authenticated using (true) with check (true);
create policy "TEMP_dev_entities_open"      on public.entities      for all to anon, authenticated using (true) with check (true);
create policy "TEMP_dev_bank_profiles_open" on public.bank_profiles for all to anon, authenticated using (true) with check (true);
create policy "TEMP_dev_clients_open"       on public.clients       for all to anon, authenticated using (true) with check (true);
create policy "TEMP_dev_contacts_open"      on public.contacts      for all to anon, authenticated using (true) with check (true);
create policy "TEMP_dev_trades_open"        on public.trades        for all to anon, authenticated using (true) with check (true);
create policy "TEMP_dev_documents_open"     on public.documents     for all to anon, authenticated using (true) with check (true);

-- NOTE: documents.uploaded_by and trades.* FKs still require the seeded rows to
-- exist (run supabase/seed.sql). With anon access the app has no auth.uid(), so
-- the persist path's session check will still gate it — this bypass is mainly
-- for the Step-4 storage upload of the original PDF.
