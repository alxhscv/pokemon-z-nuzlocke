-- ============================================================
--  Pokémon Z Nuzlocke Tracker — esquema Supabase
--  Pégalo entero en:  Supabase → SQL Editor → New query → Run
-- ============================================================

-- Partidas (una por grupo de amigos; se entra con un código)
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  mode        text not null default 'nuzlocke',   -- nuzlocke | random | monotype
  created_at  timestamptz not null default now()
);

-- Jugadores dentro de una partida
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id) on delete cascade,
  name        text not null,
  color       text not null default '#ef4444',
  badges      int  not null default 0,            -- medallas (0-12)
  created_at  timestamptz not null default now(),
  unique (run_id, name)
);

-- Pokémon registrados por cada jugador
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs(id) on delete cascade,
  player_id   uuid not null references public.players(id) on delete cascade,
  pokemon_id  int  not null,                       -- id nacional (ver data/pokemon.json)
  nickname    text,
  location    text,                                -- zona de captura
  level       int,
  status      text not null default 'team',        -- team | box | dead
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists entries_run_idx on public.entries(run_id);
create index if not exists players_run_idx on public.players(run_id);

-- ----- Seguridad (app privada entre amigos: acceso abierto con la anon key) -----
alter table public.runs    enable row level security;
alter table public.players enable row level security;
alter table public.entries enable row level security;

-- Políticas permisivas: cualquiera con la URL + anon key puede leer/escribir.
do $$
begin
  if not exists (select 1 from pg_policies where tablename='runs'    and policyname='anon_all') then
    create policy anon_all on public.runs    for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='players' and policyname='anon_all') then
    create policy anon_all on public.players for all using (true) with check (true); end if;
  if not exists (select 1 from pg_policies where tablename='entries' and policyname='anon_all') then
    create policy anon_all on public.entries for all using (true) with check (true); end if;
end $$;

-- ----- Tiempo real (para ver el progreso de los amigos al instante) -----
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.entries;
