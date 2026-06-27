-- ─────────────────────────────────────────────────────────────────────────
-- RLS helper functions.
--
-- SECURITY DEFINER so they read public.users without triggering that table's
-- own RLS (which would otherwise recurse). They resolve the current request's
-- app role and active flag from the users profile, keyed by auth.uid().
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.current_app_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_active from public.users where id = auth.uid()), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'super_admin' from public.users where id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_active_user() from public;
revoke all on function public.is_super_admin() from public;

grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
