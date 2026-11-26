-- ============================================================
--  Gacha + ranking de combates + frase de perfil
--  Ejecutar en Supabase -> SQL Editor. Re-ejecutable (no borra datos). Requiere admin.sql (is_admin).
-- ============================================================

alter table public.profiles add column if not exists motto text;
alter table public.profiles drop constraint if exists profiles_motto_chk;
alter table public.profiles add constraint profiles_motto_chk check (motto is null or char_length(motto) <= 40);

create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins   int not null default 0 check (coins >= 0)
);
create table if not exists public.gacha_pulls (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  pokemon_id int  not null check (pokemon_id between 1 and 1025),
  rarity     text not null check (rarity in ('comun','raro','epico','legendario')),
  created_at timestamptz not null default now()
);
create table if not exists public.battles (
  id         bigint generated always as identity primary key,
  winner_id  uuid not null references public.profiles(id) on delete cascade,
  loser_id   uuid not null references public.profiles(id) on delete cascade,
  note       text check (note is null or char_length(note) <= 80),
  created_at timestamptz not null default now(),
  check (winner_id <> loser_id)
);
create index if not exists gacha_pulls_user_idx on public.gacha_pulls(user_id, created_at desc);

alter table public.wallets     enable row level security;
alter table public.gacha_pulls enable row level security;
alter table public.battles     enable row level security;

drop policy if exists wallets_read on public.wallets;
drop policy if exists pulls_read on public.gacha_pulls;
drop policy if exists battles_read on public.battles;
drop policy if exists battles_insert on public.battles;
drop policy if exists battles_delete on public.battles;
create policy wallets_read on public.wallets     for select to authenticated using ((select auth.uid()) is not null);
create policy pulls_read   on public.gacha_pulls for select to authenticated using ((select auth.uid()) is not null);
create policy battles_read on public.battles     for select to authenticated using ((select auth.uid()) is not null);

-- wallets y gacha_pulls: solo lectura directa; se escribe unicamente por RPC security definer
revoke all on public.wallets, public.gacha_pulls, public.battles from anon, authenticated;
grant select on public.wallets, public.gacha_pulls to authenticated;
grant select on public.battles to authenticated;

create or replace function public.gacha_pull(n int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  bal int; r float; rar text; pid int; res jsonb := '[]'::jsonb;
  leg int[] := array[144,145,146,150,151,243,244,245,249,250,251,377,378,379,380,381,382,383,384,385,386,
    480,481,482,483,484,485,486,487,488,489,490,491,492,493,494,638,639,640,641,642,643,644,645,646,647,648,649,
    716,717,718,719,720,721,785,786,787,788,789,790,791,792,793,794,795,796,797,798,799,800,801,802,807,808,809,
    888,889,890,891,892,893,894,895,896,897,898,905,1001,1002,1003,1004,1007,1008,1014,1015,1016,1017,1024,1025];
  epi int[] := array[3,6,9,149,248,373,376,445,448,461,462,466,467,468,470,471,473,474,475,477,479,
    635,637,700,706,745,784,812,815,818,823,826,830,839,849,887,934,998,1000];
  rare int[]; comm int[];
begin
  if uid is null or not exists (select 1 from players where user_id = uid) then raise exception 'solo los jugadores pueden tirar'; end if;
  if n is null or n < 1 or n > 10 then raise exception 'tiradas invalidas (1-10)'; end if;
  insert into wallets(user_id) values (uid) on conflict do nothing;
  select coins into bal from wallets where user_id = uid for update;
  if bal < n * 100 then raise exception 'monedas insuficientes'; end if;
  update wallets set coins = coins - n * 100 where user_id = uid;
  select array_agg(g) into rare from generate_series(5,1025,5) g where g <> all(leg) and g <> all(epi);
  select array_agg(g) into comm from generate_series(1,1025) g where g <> all(leg) and g <> all(epi) and g % 5 <> 0;
  for i in 1..n loop
    r := random();
    if r < 0.01 then rar := 'legendario'; pid := leg[1 + floor(random() * array_length(leg,1))::int];
    elsif r < 0.08 then rar := 'epico'; pid := epi[1 + floor(random() * array_length(epi,1))::int];
    elsif r < 0.30 then rar := 'raro'; pid := rare[1 + floor(random() * array_length(rare,1))::int];
    else rar := 'comun'; pid := comm[1 + floor(random() * array_length(comm,1))::int]; end if;
    insert into gacha_pulls(user_id, pokemon_id, rarity) values (uid, pid, rar);
    res := res || jsonb_build_object('pokemon_id', pid, 'rarity', rar);
  end loop;
  return res;
end $$;

create or replace function public.admin_give_coins(uid uuid, amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo el admin'; end if;
  if amount = 0 or not exists (select 1 from players where user_id = uid) then raise exception 'jugador o cantidad no validos'; end if;
  insert into wallets(user_id, coins) values (uid, greatest(0, amount))
  on conflict (user_id) do update set coins = greatest(0, wallets.coins + amount);
end $$;

create or replace function public.admin_record_battle(winner uuid, loser uuid, note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo el admin'; end if;
  if winner = loser or not exists (select 1 from players where user_id = winner) or not exists (select 1 from players where user_id = loser) then raise exception 'ganador y perdedor deben ser jugadores distintos'; end if;
  insert into battles(winner_id, loser_id, note) values (winner, loser, nullif(left(trim(note), 80), ''));
  insert into wallets(user_id, coins) values (winner, 50) on conflict (user_id) do update set coins = wallets.coins + 50;
  insert into wallets(user_id, coins) values (loser, 20)  on conflict (user_id) do update set coins = wallets.coins + 20;
end $$;

create or replace function public.admin_delete_battle(bid bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'solo el admin'; end if;
  delete from battles where id = bid;   -- no devuelve monedas
end $$;

revoke all on function public.gacha_pull(int), public.admin_give_coins(uuid,int),
  public.admin_record_battle(uuid,uuid,text), public.admin_delete_battle(bigint) from public, anon;
grant execute on function public.gacha_pull(int), public.admin_give_coins(uuid,int),
  public.admin_record_battle(uuid,uuid,text), public.admin_delete_battle(bigint) to authenticated;

do $$ begin alter publication supabase_realtime add table public.battles;     exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.wallets;     exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.gacha_pulls; exception when duplicate_object then null; end $$;
