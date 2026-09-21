-- GastroMetrics — eventos de producto (embudo de activación), para saber en qué paso
-- se pierde la gente entre "vio la landing" y "paga" — pedido explícito del dueño del
-- proyecto tras una auditoría externa de marketing/SaaS ("agregar eventos de
-- analítica... para saber exactamente dónde se pierde el usuario").
--
-- Mismo criterio de privacidad que page_views (0013_page_analytics.sql): sin cuenta de
-- usuario, sin IP, sin identificador persistente entre sesiones — solo el nombre del
-- evento, cuándo, y opcionalmente a qué negocio pertenece (para eventos que ocurren
-- dentro de la app ya logueada, ej. "se creó el primer ingrediente"). No se intenta
-- correlacionar un mismo visitante a través de varios eventos (eso requeriría un
-- identificador de sesión persistente) — esta tabla da conteos agregados por evento
-- ("cuántas veces pasó X"), no un embudo por-persona. Ver app/api/track-event/route.ts
-- (escribe) y app/api/admin/analytics/route.ts (lee, junto con page_views).

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  event_name text not null,
  business_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_events_created_at on public.product_events(created_at);
create index if not exists idx_product_events_event_name on public.product_events(event_name);

alter table public.product_events enable row level security;
-- Sin ninguna política a propósito, mismo criterio que page_views: nadie lee ni escribe
-- esta tabla con la clave anon. El único acceso es del lado del servidor, con el
-- cliente de service role (getSupabaseAdminClient), desde POST /api/track-event
-- (escribe, público pero con rate limit) y GET /api/admin/analytics (lee, solo con
-- sesión admin).
