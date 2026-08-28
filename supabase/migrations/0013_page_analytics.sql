-- GastroMetrics — analíticas propias de tráfico, guardadas en Supabase (no dependen de
-- Vercel Web Analytics, que no tiene API de lectura en el plan Hobby actual). Pedido
-- explícito: poder ver analíticas reales desde /admin. Ver docs/67.
--
-- Deliberadamente NO guarda nada identificable: sin cuenta de usuario, sin IP, sin
-- identificador persistente entre sesiones — solo la ruta, cuándo, en qué idioma, y de
-- dónde vino (referrer). Ver app/api/track/route.ts (escribe) y
-- app/api/admin/analytics/route.ts (lee).

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null,
  created_at timestamptz not null default now(),
  language text,
  referrer text
);

create index if not exists idx_page_views_created_at on public.page_views(created_at);
create index if not exists idx_page_views_path on public.page_views(path);

alter table public.page_views enable row level security;
-- Sin ninguna política a propósito: nadie lee ni escribe esta tabla con la clave anon.
-- El único acceso es del lado del servidor, con el cliente de service role
-- (getSupabaseAdminClient), desde POST /api/track (escribe, público pero con rate
-- limit) y GET /api/admin/analytics (lee, solo con sesión admin).
