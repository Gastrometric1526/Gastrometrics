-- GastroMetrics — log real de actividad y notificaciones, pedido explícito del dueño
-- del proyecto: "Notificaciones" debe mostrar los pop-ups reales de guardado/creado/
-- activado-desactivado merma/importado, y "Actividad" debe mostrar quién entró a cada
-- módulo y toda acción tomada por cualquier usuario del negocio (dueño o invitado de
-- equipo) — no solo lo que hizo la sesión actual del navegador. Ver docs/87.
--
-- Reemplaza lib/activity-tracker.ts (localStorage, aislado por navegador, invisible
-- para el resto del equipo) en las dos tarjetas "Actividad reciente"/"Notificaciones"
-- del Dashboard y de /business/[id].
--
-- Log de solo-inserción (sin políticas de update/delete, mismo criterio que
-- page_views): "is_notification" separa las dos vistas sin necesitar dos tablas —
-- true en todo excepto "entered" (entrar a un módulo es Actividad, no un pop-up de
-- confirmación).

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  business_id text references public.businesses(id) on delete cascade, -- null = acción de cuenta (equipo, negocios, dashboard)
  user_id uuid not null references auth.users(id) on delete cascade,
  user_name text not null,
  module text not null,
  action text not null,
  entity_label text,
  metadata jsonb,
  is_notification boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_business on public.activity_log(business_id, created_at desc);
create index if not exists idx_activity_log_user on public.activity_log(user_id, created_at desc);

alter table public.activity_log enable row level security;

-- Mismo helper is_business_member/is_business_owner que ya usan ingredients, recipes,
-- etc. (definidos en 0001_init.sql / 0005_ids_as_text.sql) — un negocio null solo lo
-- puede ver/escribir quien lo generó (acciones de cuenta, no de negocio).
drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select using (
    (business_id is not null and (is_business_member(business_id) or is_business_owner(business_id)))
    or (business_id is null and user_id = auth.uid())
  );

drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert with check (
    user_id = auth.uid()
    and (business_id is null or is_business_member(business_id) or is_business_owner(business_id))
  );
