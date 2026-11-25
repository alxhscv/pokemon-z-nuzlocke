-- ============================================================
--  Fichaje: conectado/desconectado + horas jugadas
--  Ejecutar UNA vez en Supabase → SQL Editor. Seguro re-ejecutarlo (no borra datos).
--  NO sustituye a schema.sql. La web hace latido (clock_ping) cada 30 s;
--  si pasan 90 s sin latido el usuario cuenta como desconectado.
--  Una sola sesión abierta por usuario: varias pestañas no duplican horas.
-- ============================================================

create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  ended_at   timestamptz
);
create unique index if not exists sessions_one_open on public.sessions (user_id) where ended_at is null;

grant select on public.sessions to authenticated;   -- sin este grant la web no puede leer el fichaje
alter table public.sessions enable row level security;
drop policy if exists sessions_select on public.sessions;
create policy sessions_select on public.sessions for select to authenticated using (true);
-- sin políticas de escritura: solo se escribe con las funciones de abajo

-- fichaje MANUAL: clock_in abre (o renueva) tu sesión; clock_ping solo renueva y dice si sigue abierta
drop function if exists public.clock_ping();
create or replace function public.clock_in()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then return; end if;
  update sessions set ended_at = last_seen
   where user_id = auth.uid() and ended_at is null and last_seen <= now() - interval '90 seconds';
  update sessions set last_seen = now() where user_id = auth.uid() and ended_at is null;
  if not found then
    insert into sessions (user_id) values (auth.uid()) on conflict (user_id) where ended_at is null do nothing;
  end if;
end;
$$;

create or replace function public.clock_ping()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update sessions set last_seen = now()
   where user_id = auth.uid() and ended_at is null and last_seen > now() - interval '90 seconds';
  return found;
end;
$$;

revoke all on function public.clock_in(), public.clock_ping() from public, anon;
grant execute on function public.clock_in(), public.clock_ping() to authenticated;

-- salida limpia (cerrar sesión)
create or replace function public.clock_out()
returns void language sql security definer set search_path = public as $$
  update sessions set ended_at = now(), last_seen = now() where user_id = auth.uid() and ended_at is null;
$$;

-- resumen por usuario: segundos totales, si está conectado y desde cuándo
create or replace function public.presence_summary()
returns table (user_id uuid, total_seconds bigint, online boolean, session_start timestamptz)
language sql stable set search_path = public as $$
  select s.user_id,
         sum(extract(epoch from s.last_seen - s.started_at))::bigint,
         coalesce(bool_or(s.ended_at is null and s.last_seen > now() - interval '90 seconds'), false),
         max(s.started_at) filter (where s.ended_at is null and s.last_seen > now() - interval '90 seconds')
    from sessions s group by s.user_id;
$$;

revoke all on function public.clock_out(), public.presence_summary() from public, anon;
grant execute on function public.clock_out(), public.presence_summary() to authenticated;
