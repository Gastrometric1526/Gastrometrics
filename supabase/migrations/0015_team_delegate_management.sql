-- GastroMetrics — permite delegar la gestión del equipo a un miembro invitado.
-- Pedido explícito del dueño del proyecto: que "team" (invitar/editar/quitar
-- personas) sea una función más, asignable como cualquier otra, en vez de quedar
-- reservada al dueño de la cuenta sin excepción.
--
-- Por qué esto no era tan simple como agregar una casilla más en /equipo:
-- team_members.owner_id se comparaba SIEMPRE contra auth.uid() (política
-- "team_members_owner_all", desde 0010_team_real.sql) — un miembro delegado tiene su
-- propio auth.uid(), nunca igual al owner_id de la cuenta que lo invitó, así que
-- cualquier intento de invitar/editar/quitar en nombre de esa cuenta habría chocado
-- con RLS sin importar qué dijera la interfaz. Mismo problema en
-- business_members_owner_manage (0001_init.sql) — otorgar/revocar el acceso real al
-- negocio de la persona recién invitada/removida también pasa por ahí.
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

-- 1. Helper: ¿puede el usuario actual administrar el equipo de esta cuenta? Sí, si es
-- el dueño real, O si es un miembro invitado con la función 'team' habilitada para
-- ESA cuenta específica (mismo patrón security definer que is_business_member/
-- has_feature_access, para evitar el ciclo de RLS ya documentado en 0001_init.sql).
create or replace function public.can_manage_team(target_owner_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select auth.uid() = target_owner_id
    or exists (
      select 1 from team_members tm
      where tm.invited_user_id = auth.uid()
        and tm.owner_id = target_owner_id
        and tm.allowed_features @> to_jsonb('team'::text)
    );
$$;

-- 2. team_members: el dueño real sigue pudiendo todo; un delegado también, pero solo
-- sobre las filas de la cuenta que lo delegó (nunca las de otra cuenta distinta).
drop policy if exists "team_members_owner_all" on public.team_members;
create policy "team_members_owner_all" on public.team_members
  for all using (can_manage_team(owner_id)) with check (can_manage_team(owner_id));

-- 3. business_members: otorgar/revocar acceso real al negocio (lo que pasa al
-- invitar o quitar a alguien) necesita el mismo permiso, resuelto contra el dueño
-- real del negocio en cuestión (no contra quien hace la llamada).
drop policy if exists "business_members_owner_manage" on business_members;
create policy "business_members_owner_manage" on business_members
  for all using (
    is_business_owner(business_members.business_id)
    or can_manage_team((select owner_id from businesses where businesses.id = business_members.business_id))
  )
  with check (
    is_business_owner(business_members.business_id)
    or can_manage_team((select owner_id from businesses where businesses.id = business_members.business_id))
  );
