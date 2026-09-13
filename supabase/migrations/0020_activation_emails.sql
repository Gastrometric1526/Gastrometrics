-- GastroMetrics — bookkeeping de correos de activación por comportamiento, pedido
-- derivado de la crítica externa (ver docs/98, Parte 4.1 punto 7: "primera receta,
-- recordatorio, margen a los 7 días, refuerzo tras primera venta").
--
-- Tabla propia y separada de activity_log a propósito: activity_log alimenta
-- "Actividad reciente"/"Notificaciones" del dashboard (ver 0017_activity_log.sql) —
-- mezclar ahí un registro interno de "le mandamos este correo automático" haría que
-- el propio sistema apareciera como si fuera una acción del usuario en su feed. Esta
-- tabla es de solo lectura/escritura para el cron (service role), sin políticas RLS
-- para cuentas normales — nadie más necesita leerla.
--
-- unique(account_id, email_type) es la garantía real de que cada correo se manda como
-- máximo una vez por cuenta: app/api/cron/activation-emails/route.ts hace
-- insert ... on conflict do nothing y solo manda el correo si el insert de verdad
-- agregó una fila nueva.

create table if not exists public.activation_emails_sent (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('first_recipe_reminder', 'day7_margin_checkin', 'first_sale_reinforcement')),
  sent_at timestamptz not null default now(),
  unique (account_id, email_type)
);

alter table public.activation_emails_sent enable row level security;
-- Sin políticas de select/insert para usuarios autenticados normales — solo el
-- service role (cron) lee y escribe esta tabla, mismo criterio que page_views.
