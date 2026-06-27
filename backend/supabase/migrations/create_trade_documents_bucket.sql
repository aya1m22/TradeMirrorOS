-- Ensure the storage bucket the app uploads to actually exists.
-- The live project was missing it (Storage API returned "Bucket not found"),
-- which is the 400 on /storage/v1/object/trade-documents/...
-- Idempotent: safe to run repeatedly.
insert into storage.buckets (id, name, public)
values ('trade-documents', 'trade-documents', false)
on conflict do nothing;
