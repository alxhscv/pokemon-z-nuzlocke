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
