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
