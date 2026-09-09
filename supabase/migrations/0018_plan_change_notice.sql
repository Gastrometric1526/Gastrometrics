-- Aviso de cambio de plan pendiente de mostrar como popup en el dashboard (ver
-- docs/89). Un solo "casillero" por cuenta, no un historial completo — cada cambio
-- real de plan sobreescribe estas columnas y prende last_change_acknowledged=false;
-- el popup del dashboard lo apaga en cuanto el usuario lo cierra. Alimenta también el
-- correo de cambio de plan (lib/services/notify-billing.ts), que ya existía pero
-- ahora también se dispara desde /admin cuando el plan se asigna a mano.
--
-- default true en last_change_acknowledged: sin esto, TODAS las cuentas existentes
-- verían el popup aparecer de la nada al correr esta migración, para un "cambio" que
-- nunca ocurrió de verdad.
alter table account_plans add column if not exists last_change_from_plan text;
alter table account_plans add column if not exists last_change_to_plan text;
alter table account_plans add column if not exists last_change_amount_cents integer;
alter table account_plans add column if not exists last_change_next_charge_at timestamptz;
alter table account_plans add column if not exists last_change_expires_at timestamptz;
-- 'stripe' (pago real, con cobro) | 'admin' (asignado a mano desde /admin, sin cobro)
alter table account_plans add column if not exists last_change_source text;
alter table account_plans add column if not exists last_change_at timestamptz;
alter table account_plans add column if not exists last_change_acknowledged boolean not null default true;
