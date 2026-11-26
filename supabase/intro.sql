-- ============================================================
--  Interruptor de la intro (pantalla de carga). Ejecutar UNA vez en Supabase → SQL Editor.
--  Seguro de re-ejecutar. Lectura pública (la intro sale antes del login); solo el admin escribe.
-- ============================================================

create table if not exists public.app_settings (key text primary key, value boolean not null);
insert into public.app_settings (key, value) values ('intro_enabled', true) on conflict do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_read  on public.app_settings;
drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_read  on public.app_settings for select to anon, authenticated using (true);
create policy app_settings_admin on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
