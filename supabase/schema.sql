-- ============================================================
--  Pokémon Z Nuzlocke Tracker — esquema Supabase (v2, con cuentas)
--  Pégalo entero en:  Supabase → SQL Editor → New query → Run
--  Requiere Auth email/contraseña con auto-confirmación activada.
-- ============================================================

-- Seguro de re-ejecutar: NO borra tablas ni datos.

-- ---------- TABLAS ----------

-- Perfil público de cada cuenta (identidad global: nombre visible + color)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  color         text not null default '#2BB673',       -- (en desuso: ahora todos usan rojo de la marca)
  avatar        text,                                   -- id del Pokémon-avatar O una URL de imagen (opcional)
  created_at    timestamptz not null default now()
);

-- Partida (el grupo usa UNA sola run compartida; la siembra el admin al final de este script)
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  mode        text not null default 'nuzlocke',      -- nuzlocke | random | monotype
  owner_id    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Pertenencia: qué usuario está en qué partida (+ sus medallas en esa partida)
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id)     on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  badges      int  not null default 0,                 -- máscara de bits: bit i-1 = medalla i (12 medallas)
  created_at  timestamptz not null default now(),
  unique (run_id, user_id),
  check (badges between 0 and 4095)
);

-- Pokémon registrados (user_id = dueño, para permisos)
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id)     on delete cascade,
  player_id   uuid not null references public.players(id)  on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  pokemon_id  int  not null,                            -- id nacional (data/pokemon.json)
  nickname    text,
  location    text,                                     -- zona de captura
  level       int check (level between 1 and 100),
  status      text not null default 'team' check (status in ('team','box','dead')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entries_run_idx    on public.entries(run_id);
create index if not exists entries_user_idx   on public.entries(user_id);
create index if not exists entries_player_idx on public.entries(player_id);
create index if not exists players_user_idx   on public.players(user_id);
-- players.run_id ya lo cubre unique(run_id, user_id)

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
drop policy if exists profiles_read on public.profiles;
create policy profiles_read   on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid()));

-- runs: la run es única y fija; los usuarios solo la leen (nadie crea/borra runs desde la web)
drop policy if exists runs_read on public.runs;
create policy runs_read on public.runs for select to authenticated using (true);

-- players: te unes añadiéndote a TI mismo; ves a los miembros de tus partidas; editas tu fila
drop policy if exists players_read on public.players;
create policy players_read   on public.players for select to authenticated using (public.is_member(run_id));
drop policy if exists players_insert on public.players;
create policy players_insert on public.players for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists players_update on public.players;
create policy players_update on public.players for update to authenticated using (user_id = (select auth.uid()));
drop policy if exists players_delete on public.players;
create policy players_delete on public.players for delete to authenticated using (user_id = (select auth.uid()));

-- entries: ves las de tus partidas; creas/editas/borras SOLO las tuyas
drop policy if exists entries_read on public.entries;
create policy entries_read   on public.entries for select to authenticated using (public.is_member(run_id));
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries for insert to authenticated with check (user_id = (select auth.uid()) and public.is_member(run_id));
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update to authenticated using (user_id = (select auth.uid()));
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete
  on public.profiles, public.runs, public.players, public.entries
  to authenticated;

-- ---------- TIEMPO REAL ----------
do $$ begin
  alter publication supabase_realtime add table public.players;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null; end $$;

-- ---------- RUN ÚNICA ----------
-- El grupo comparte una sola partida. Se crea aquí si aún no hay ninguna.
insert into public.runs (code, name, mode, owner_id)
select 'MAIN', 'Nuzlocke de Pokémon Z', 'nuzlocke', null
where not exists (select 1 from public.runs);
