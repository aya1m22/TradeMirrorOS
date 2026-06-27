-- Revert TEMPORARY_local_open_access.sql — restores the real RLS posture.
-- Run this in the Supabase SQL editor. Drops only the TEMP policies; the real
-- policies from supabase/migrations/ remain in place. The bucket is left as-is.

drop policy if exists "TEMP_dev_storage_open"       on storage.objects;
drop policy if exists "TEMP_dev_users_open"         on public.users;
drop policy if exists "TEMP_dev_entities_open"      on public.entities;
drop policy if exists "TEMP_dev_bank_profiles_open" on public.bank_profiles;
drop policy if exists "TEMP_dev_clients_open"       on public.clients;
drop policy if exists "TEMP_dev_contacts_open"      on public.contacts;
drop policy if exists "TEMP_dev_trades_open"        on public.trades;
drop policy if exists "TEMP_dev_documents_open"     on public.documents;
