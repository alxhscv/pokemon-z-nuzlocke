-- ============================================================
--  Pokémon Z Nuzlocke Tracker — esquema Supabase (v2, con cuentas)
--  Pégalo entero en:  Supabase → SQL Editor → New query → Run
--  Requiere Auth email/contraseña con auto-confirmación activada.
-- ============================================================

-- Reinicio limpio (no hay datos reales que conservar)
drop table if exists public.entries  cascade;
drop table if exists public.players  cascade;
drop table if exists public.runs     cascade;
drop table if exists public.profiles cascade;
drop function if exists public.is_member(uuid);

-- ---------- TABLAS ----------

-- Perfil público de cada cuenta (identidad global: nombre visible + color)
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  color         text not null default '#2BB673',       -- (en desuso: ahora todos usan verde Zygarde)
  avatar        text,                                   -- id del Pokémon-avatar O una URL de imagen (opcional)
  created_at    timestamptz not null default now()
);

-- Partida (el grupo usa UNA sola run compartida; la siembra el admin al final de este script)
create table public.runs (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  mode        text not null default 'nuzlocke',      -- nuzlocke | random | monotype
  owner_id    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Pertenencia: qué usuario está en qué partida (+ sus medallas en esa partida)
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id)     on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badges      int  not null default 0,                 -- medallas 0-12
  created_at  timestamptz not null default now(),
  unique (run_id, user_id)
);

-- Pokémon registrados (user_id = dueño, para permisos)
create table public.entries (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id)     on delete cascade,
  player_id   uuid not null references public.players(id)  on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  pokemon_id  int  not null,                            -- id nacional (data/pokemon.json)
  nickname    text,
  location    text,                                     -- zona de captura
  level       int,
  status      text not null default 'team',             -- team | box | dead
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index entries_run_idx on public.entries(run_id);
create index players_run_idx on public.players(run_id);

-- ---------- SEGURIDAD (RLS) ----------
-- Helper: ¿soy miembro de esta partida? SECURITY DEFINER evita recursión de RLS en players.
create or replace function public.is_member(rid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from players where run_id = rid and user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.runs     enable row level security;
alter table public.players  enable row level security;
alter table public.entries  enable row level security;

-- profiles: cualquiera con cuenta ve los perfiles (nombre/color de los demás); editas el tuyo
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid());

-- runs: la run es única y fija; los usuarios solo la leen (nadie crea/borra runs desde la web)
create policy runs_read on public.runs for select to authenticated using (true);

-- players: te unes añadiéndote a TI mismo; ves a los miembros de tus partidas; editas tu fila
create policy players_read   on public.players for select to authenticated using (public.is_member(run_id));
create policy players_insert on public.players for insert to authenticated with check (user_id = auth.uid());
create policy players_update on public.players for update to authenticated using (user_id = auth.uid());
create policy players_delete on public.players for delete to authenticated using (user_id = auth.uid());

-- entries: ves las de tus partidas; creas/editas/borras SOLO las tuyas
create policy entries_read   on public.entries for select to authenticated using (public.is_member(run_id));
create policy entries_insert on public.entries for insert to authenticated with check (user_id = auth.uid() and public.is_member(run_id));
create policy entries_update on public.entries for update to authenticated using (user_id = auth.uid());
create policy entries_delete on public.entries for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete
  on public.profiles, public.runs, public.players, public.entries
  to authenticated;

-- ---------- TIEMPO REAL ----------
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.entries;

-- ---------- RUN ÚNICA ----------
-- El grupo comparte una sola partida. Se crea aquí si aún no hay ninguna.
insert into public.runs (code, name, mode, owner_id)
select 'MAIN', 'Nuzlocke de Pokémon Z', 'nuzlocke', null
where not exists (select 1 from public.runs);
