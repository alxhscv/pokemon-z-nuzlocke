-- ============================================================
--  Cuenta ADMIN (usuario "admin" → email admin@users.pokez)
--  Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de crear la cuenta "admin".
--  Es seguro re-ejecutarlo (no borra datos). NO sustituye a schema.sql.
--  El admin no entra en `players`: por eso no sale en ninguna lista de la web.
-- ============================================================

create or replace function public.is_admin()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'admin@users.pokez';
$$;

-- el admin puede leer/editar/borrar todo (se suman a las políticas normales)
drop policy if exists players_admin  on public.players;
drop policy if exists entries_admin  on public.entries;
drop policy if exists profiles_admin on public.profiles;
create policy players_admin  on public.players  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy entries_admin  on public.entries  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- borrar una cuenta entera (auth + perfil + players + entries en cascada); solo el admin
create or replace function public.admin_delete_user(uid uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'solo el admin'; end if;
  if uid = auth.uid() then raise exception 'no puedes borrarte a ti mismo'; end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
