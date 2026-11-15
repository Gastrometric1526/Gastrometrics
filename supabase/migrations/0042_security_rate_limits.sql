-- docs/312: límite de intentos que se guarda en la base (no en la memoria de cada función).
-- El límite en memoria (lib/rate-limit.ts) se pierde en cada instancia nueva de Vercel, así que
-- alguien que reparte sus intentos podía seguir probando el código de /admin o contraseñas.
-- Solo el servidor (service role) la usa: RLS activo y sin políticas = nadie más la lee ni escribe.
-- Las llaves se guardan como hash (sin correos ni IP en claro).

create table if not exists public.security_rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.security_rate_limits enable row level security;

-- Registra un intento fallido (p_count = true) o solo consulta (false).
-- Devuelve los segundos que la llave sigue bloqueada (0 = libre).
create or replace function public.security_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer,
  p_lock_seconds integer,
  p_count boolean
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.security_rate_limits%rowtype;
  now_ts timestamptz := now();
begin
  select * into r from public.security_rate_limits where key = p_key for update;

  if found and r.locked_until is not null and r.locked_until > now_ts then
    return ceil(extract(epoch from (r.locked_until - now_ts)))::integer;
  end if;

  if not p_count then
    return 0;
  end if;

  if not found or r.window_start < now_ts - make_interval(secs => p_window_seconds) then
    insert into public.security_rate_limits (key, count, window_start, locked_until)
      values (p_key, 1, now_ts, null)
      on conflict (key) do update set count = 1, window_start = now_ts, locked_until = null;
    return 0;
  end if;

  if r.count + 1 > p_max then
    update public.security_rate_limits
      set count = r.count + 1, locked_until = now_ts + make_interval(secs => p_lock_seconds)
      where key = p_key;
    return p_lock_seconds;
  end if;

  update public.security_rate_limits set count = r.count + 1 where key = p_key;
  return 0;
end;
$$;

revoke all on function public.security_rate_limit(text, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.security_rate_limit(text, integer, integer, integer, boolean) to service_role;

-- Limpieza: filas viejas sin bloqueo vigente (la llama la tarea diaria).
create or replace function public.security_rate_limits_prune() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.security_rate_limits
  where window_start < now() - interval '2 days'
    and (locked_until is null or locked_until < now());
$$;

revoke all on function public.security_rate_limits_prune() from public, anon, authenticated;
grant execute on function public.security_rate_limits_prune() to service_role;
