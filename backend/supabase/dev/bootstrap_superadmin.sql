-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ONE-TIME BOOTSTRAP — run ONCE in the Supabase SQL editor.             ║
-- ║                                                                        ║
-- ║  Makes the dev super-admin account usable so the app can sign in and   ║
-- ║  RLS lets it upload/save. This runs as the postgres role (normal admin ║
-- ║  provisioning) — it does NOT weaken RLS or add anonymous access.       ║
-- ║                                                                        ║
-- ║  Prereq: the app already created the auth user via sign-up             ║
-- ║  (superadmin@chipafarm.com / TradeMirror!2026). If it doesn't exist,   ║
-- ║  create it in Authentication → Add user (mark email confirmed).        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- 1) Confirm the email so the account can sign in.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email = 'superadmin@chipafarm.com';

-- 2) Create its staff profile — RLS reads role + is_active from public.users.
insert into public.users (id, email, full_name, role, is_active)
select id, 'superadmin@chipafarm.com', 'Chipa Owner', 'super_admin', true
from auth.users
where email = 'superadmin@chipafarm.com'
on conflict (id) do update
  set role = 'super_admin', is_active = true, email = excluded.email;
