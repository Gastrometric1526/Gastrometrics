-- 0036 — Los invitados solo tienen acceso mientras el plan del dueño incluya Equipo (docs/236).
--
-- Antes, el acceso de un invitado dependía solo de su fila en business_members/team_members:
-- si el dueño cancelaba o su plan vencía y quedaba en Foodie, su equipo seguía leyendo y
-- escribiendo en sus negocios. Ahora is_business_member, has_feature_access y can_manage_team
-- exigen además que el plan vigente del dueño incluya Equipo. No se borra nada: las filas de
-- business_members y team_members se quedan, y si el dueño vuelve a un plan con Equipo, el
-- acceso vuelve solo, con los mismos permisos.
--
-- Misma regla que lib/team-owner-access.ts (y getTeamInviteLimit): Equipo está activo si el
-- plan no venció y es Sous Chef o Chef Ejecutivo, o si /admin le cedió asientos extra.
-- El dueño no se ve afectado (sus políticas usan is_business_owner / owner_id = auth.uid()).
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

create or replace function public.owner_team_active(target_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from account_plans ap
    where ap.account_id = target_owner_id
      and (
        coalesce(ap.extra_team_seats, 0) > 0
        or (
          ap.plan_slug in ('sous-chef', 'chef-ejecutivo')
          and (ap.plan_expires_at is null or ap.plan_expires_at > now())
        )
      )
  );
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
  );
$$;

create or replace function public.can_manage_team(target_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() = target_owner_id
    or (
      owner_team_active(target_owner_id)
      and exists (
        select 1 from team_members tm
        where tm.invited_user_id = auth.uid()
          and tm.owner_id = target_owner_id
          and tm.allowed_features @> to_jsonb('team'::text)
      )
    );
$$;
