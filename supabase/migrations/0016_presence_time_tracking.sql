-- GastroMetrics — tiempo total acumulado por cuenta, pedido explícito del dueño del
-- proyecto: en /admin > Cuentas quería ver, además de si alguien está en línea ahora
-- (ver 0014_user_presence.sql), cuáles cuentas pasan más tiempo dentro de la app en
-- total. Ver docs/78.
--
-- `total_active_seconds` se acumula en cada heartbeat del navegador (cada ~60s, ver
-- components/presence-tracker.tsx) sumando el tiempo transcurrido desde el heartbeat
-- anterior. Se hace con una función security definer en vez de un upsert directo desde
-- el cliente para que el cálculo (leer el last_seen_at anterior, sumar la diferencia)
-- sea atómico — un upsert de solo escritura no puede leer su propio valor previo de
-- forma segura desde el navegador sin exponer una carrera entre pestañas.
--
-- auth.uid() se usa DENTRO de la función en vez de recibir un user_id por parámetro —
-- así ningún usuario autenticado puede llamar la función pasando el id de otra cuenta
-- para inflar (o resetear, si hubiera un UPDATE con SET en vez de suma) su tiempo.

alter table public.user_presence
  add column if not exists total_active_seconds bigint not null default 0;

create or replace function public.bump_presence()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_last_seen timestamptz;
  v_elapsed_seconds numeric;
begin
  if v_user_id is null then
    return;
  end if;

  select last_seen_at into v_last_seen from public.user_presence where user_id = v_user_id;

  if v_last_seen is null then
    insert into public.user_presence (user_id, last_seen_at, total_active_seconds)
    values (v_user_id, now(), 0);
    return;
  end if;

  v_elapsed_seconds := extract(epoch from (now() - v_last_seen));

  -- El heartbeat manda cada ~60s. Si pasaron más de 90s desde el anterior (pestaña en
  -- segundo plano, laptop dormida, red caída), no se suma nada ese tick — evita que una
  -- pestaña olvidada abierta toda la noche infle el total con horas que no fueron uso
  -- real.
  if v_elapsed_seconds > 90 then
    v_elapsed_seconds := 0;
  end if;

  update public.user_presence
  set last_seen_at = now(),
      total_active_seconds = total_active_seconds + greatest(v_elapsed_seconds, 0)
  where user_id = v_user_id;
end;
$$;

grant execute on function public.bump_presence() to authenticated;
