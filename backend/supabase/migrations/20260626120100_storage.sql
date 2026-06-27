-- ─────────────────────────────────────────────────────────────────────────
-- Storage: the single private bucket that backs every Trade Folder.
-- Object access mirrors the documents table policies (PRD §3.4):
--   read   → any active user (download)
--   upload → super_admin or internal
--   modify → super_admin only
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('trade-documents', 'trade-documents', false)
on conflict (id) do nothing;

create policy "trade docs: read for active users"
  on storage.objects for select to authenticated
  using (bucket_id = 'trade-documents' and public.is_active_user());

create policy "trade docs: upload for staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trade-documents'
    and public.is_active_user()
    and public.current_app_role() in ('super_admin', 'internal')
  );

create policy "trade docs: update for admin"
  on storage.objects for update to authenticated
  using (bucket_id = 'trade-documents' and public.is_super_admin())
  with check (bucket_id = 'trade-documents' and public.is_super_admin());

create policy "trade docs: delete for admin"
  on storage.objects for delete to authenticated
  using (bucket_id = 'trade-documents' and public.is_super_admin());
