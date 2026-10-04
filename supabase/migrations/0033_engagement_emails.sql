-- GastroMetrics — correos de valor (docs/144): resumen semanal, stock bajo, platos que
-- pierden margen, funciones del plan sin usar, logros, invitación sin aceptar y negocio
-- vacío. Registra cada envío para respetar las pausas entre correos y no repetir un
-- logro, una invitación o un negocio ya avisados.
--
-- `ref` identifica lo avisado cuando importa no repetirlo (ej. "recipes_10", el id de
-- una invitación o de un negocio); para los correos periódicos guarda una marca simple.
-- Sin check de email_type a propósito: agregar un tipo nuevo no debe requerir otra
-- migración.
--
-- Solo lo usa el cron con la service role key (lib/services/notify-engagement.ts):
-- RLS activado y sin políticas, igual que reengagement_emails_sent (0032).
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.
-- Mientras no se corra, el cron simplemente no manda estos correos (no falla).

create table if not exists public.engagement_emails_sent (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null,
  ref text not null default '',
  sent_at timestamptz not null default now()
);

create index if not exists idx_engagement_emails_account on public.engagement_emails_sent(account_id, sent_at desc);

alter table public.engagement_emails_sent enable row level security;
