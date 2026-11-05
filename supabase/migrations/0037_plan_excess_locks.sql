-- 0037 — Lo que supera el plan queda bloqueado (pedido del dueño, docs/243).
--
-- Si una cuenta baja de plan o su plan vence y tiene más negocios o invitados de los que
-- incluye su plan:
-- - Siguen activos los negocios más antiguos, hasta el tope; los demás solo se pueden leer
--   (para descargarlos) y borrar. Tampoco entran los invitados a esos negocios.
-- - Siguen activos los invitados más antiguos, hasta el tope; los demás pierden el acceso.
-- No se borra nada: al volver a un plan que los incluya, todo vuelve solo.
--
-- Misma regla que lib/plan-locks.ts y los topes de lib/plans.ts.
-- Los procesos del servidor (auth.uid() nulo: restaurar, tareas diarias) no se bloquean.
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

create or replace function public.owner_business_limit(target_owner_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select case
      when ap.plan_expires_at is not null and ap.plan_expires_at <= now() then 1
      when ap.plan_slug = 'chef-ejecutivo' then 5
      when ap.plan_slug = 'sous-chef' then 2
      else 1
    end + coalesce(ap.extra_businesses, 0)
  from (select 1) one
  left join account_plans ap on ap.account_id = target_owner_id;
$$;

create or replace function public.owner_seat_limit(target_owner_id uuid)
returns integer
language sql
security definer
stable
set search_path = public
as $$
  select case
      when ap.plan_expires_at is not null and ap.plan_expires_at <= now() then 0
      when ap.plan_slug = 'chef-ejecutivo' then 4
      when ap.plan_slug = 'sous-chef' then 1
      else 0
    end + coalesce(ap.extra_team_seats, 0)
  from (select 1) one
  left join account_plans ap on ap.account_id = target_owner_id;
$$;

create or replace function public.business_is_locked(target_business_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select ranked.position > owner_business_limit(ranked.owner_id)
    from (
      select id, owner_id, row_number() over (partition by owner_id order by created_at, id) as position
      from businesses
      where owner_id = (select owner_id from businesses where id = target_business_id)
    ) ranked
    where ranked.id = target_business_id
  ), false);
$$;

create or replace function public.member_has_seat(target_owner_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((
    select ranked.position <= owner_seat_limit(target_owner_id)
    from (
      select invited_user_id, row_number() over (order by invited_at, id) as position
      from team_members
      where owner_id = target_owner_id
    ) ranked
    where ranked.invited_user_id = target_user_id
    limit 1
  ), false);
$$;

create or replace function public.is_business_member(target_business_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from business_members bm
    join businesses b on b.id = bm.business_id
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and owner_team_active(b.owner_id)
      and member_has_seat(b.owner_id, auth.uid())
      and not business_is_locked(b.id)
  );
$$;

create or replace function public.has_feature_access(target_business_id text, feature_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from team_members tm
    join businesses b on b.id = target_business_id
    where tm.invited_user_id = auth.uid()
      and tm.owner_id = b.owner_id
      and tm.allowed_features @> to_jsonb(feature_key::text)
      and owner_team_active(b.owner_id)
      and member_has_seat(b.owner_id, auth.uid())
      and not business_is_locked(b.id)
  );
$$;

-- El dueño sigue leyendo y borrando para poder descargar o liberar un lugar; no puede
-- crear ni cambiar contenido dentro de un negocio bloqueado.
create or replace function public.block_locked_business_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.business_id is not null and business_is_locked(new.business_id) then
    raise exception 'Este negocio está bloqueado por el plan de la cuenta.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'ingredients', 'recipes', 'recipes_trash', 'inventory_items', 'inventory_snapshots',
    'menus', 'purchase_orders', 'invoices', 'sales_imports'
  ]
  loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists block_locked_business_write on public.%I', table_name);
      execute format(
        'create trigger block_locked_business_write before insert or update on public.%I
         for each row execute function public.block_locked_business_write()',
        table_name
      );
    end if;
  end loop;
end;
$$;
