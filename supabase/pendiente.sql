-- ============================================================
--  TODO LO PENDIENTE EN UN SOLO ARCHIVO: estados de ruta + banners de perfil
--  Pega entero en Supabase → SQL Editor → Run. Seguro de re-ejecutar. Después se puede borrar.
--  (Es la suma de routes.sql y banners.sql)
-- ============================================================

-- ============================================================
--  Estados de ruta por jugador: «sin encuentro» y «fallido»
--  (capturado = hay un Pokémon en esa ruta; pendiente = no hay fila ni Pokémon)
--  Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de schema.sql y admin.sql.
--  Seguro de re-ejecutar (no borra datos).
-- ============================================================

create table if not exists public.route_status (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  route      text not null check (char_length(route) between 1 and 60),
  status     text not null check (status in ('none','failed')),
  updated_at timestamptz not null default now(),
  primary key (user_id, route)
);

alter table public.route_status enable row level security;
drop policy if exists route_status_read   on public.route_status;
drop policy if exists route_status_insert on public.route_status;
drop policy if exists route_status_update on public.route_status;
drop policy if exists route_status_delete on public.route_status;
drop policy if exists route_status_admin  on public.route_status;
create policy route_status_read   on public.route_status for select to authenticated using (true);
create policy route_status_insert on public.route_status for insert to authenticated with check (user_id = (select auth.uid()));
create policy route_status_update on public.route_status for update to authenticated using (user_id = (select auth.uid()));
create policy route_status_delete on public.route_status for delete to authenticated using (user_id = (select auth.uid()));
create policy route_status_admin  on public.route_status for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.route_status to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.route_status;
exception when duplicate_object then null; end $$;

-- ============================================================
--  Banners de perfil (columna profiles.banner)
--  Ejecutar UNA vez en Supabase → SQL Editor. Seguro de re-ejecutar (no borra datos).
--  NULL = banner por defecto. Cada usuario edita el suyo (política profiles_update); el admin, el de cualquiera.
-- ============================================================

alter table public.profiles add column if not exists banner text;
alter table public.profiles drop constraint if exists profiles_banner_chk;
alter table public.profiles add constraint profiles_banner_chk check (banner is null or banner ~ '^[a-z0-9-]{1,30}$');

-- cambios de perfil en vivo (para que los demás vean el banner nuevo sin recargar)
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
