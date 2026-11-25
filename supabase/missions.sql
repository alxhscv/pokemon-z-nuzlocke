-- ============================================================
--  Misiones. Ejecutar UNA vez en Supabase → SQL Editor, DESPUÉS de schema.sql y admin.sql
--  (usa is_admin()). Seguro de re-ejecutar (no borra datos).
-- ============================================================

-- MISIONES: la recompensa vive en otra tabla y SOLO se puede leer al completar la misión (o siendo admin)
create table if not exists public.missions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 80),
  description text check (char_length(description) <= 300),
  created_at  timestamptz not null default now()
);
create table if not exists public.mission_rewards (
  mission_id  uuid primary key references public.missions(id) on delete cascade,
  reward_text text not null check (char_length(reward_text) between 1 and 80),
  reward_item text check (reward_item ~ '^[a-z0-9-]+$')          -- sprite de objeto de PokéAPI (opcional)
);
create table if not exists public.mission_completions (
  mission_id   uuid not null references public.missions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (mission_id, user_id)
);
create index if not exists mission_completions_user_idx on public.mission_completions(user_id);

alter table public.missions            enable row level security;
alter table public.mission_rewards     enable row level security;
alter table public.mission_completions enable row level security;

drop policy if exists missions_read   on public.missions;
drop policy if exists missions_admin  on public.missions;
create policy missions_read  on public.missions for select to authenticated using (true);
create policy missions_admin on public.missions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists rewards_read  on public.mission_rewards;
drop policy if exists rewards_admin on public.mission_rewards;
create policy rewards_read on public.mission_rewards for select to authenticated using (
  public.is_admin() or exists (select 1 from public.mission_completions c
                               where c.mission_id = mission_rewards.mission_id and c.user_id = (select auth.uid())));
create policy rewards_admin on public.mission_rewards for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists completions_read   on public.mission_completions;
drop policy if exists completions_insert on public.mission_completions;
drop policy if exists completions_admin  on public.mission_completions;
create policy completions_read   on public.mission_completions for select to authenticated using (true);
create policy completions_insert on public.mission_completions for insert to authenticated with check (user_id = (select auth.uid()));
create policy completions_admin  on public.mission_completions for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.missions, public.mission_rewards, public.mission_completions to authenticated;
