-- GastroMetrics — pedido explícito del dueño del proyecto: cuando un admin asigna un
-- plan con vencimiento (0008_plan_expiry.sql) a una cuenta, que le lleguen recordatorios
-- por correo cuando falten 3 días, con la opción de agregar un método de pago real
-- (pasar a un plan pagado de verdad antes de que expire) o cancelar y volver al plan
-- gratis de una vez.
--
-- Por qué una sola columna y no una tabla de log aparte (a diferencia de
-- activation_emails_sent, 0020_activation_emails.sql): account_plans ya es una fila
-- por cuenta (account_id primary key) — guardar EN esa misma fila para qué valor de
-- plan_expires_at ya se mandó el recordatorio es suficiente para garantizar como
-- máximo un correo por vencimiento, y además se "auto-resetea" solo: si un admin
-- extiende o cambia la fecha de vencimiento más adelante, expiry_reminder_sent_for ya
-- no coincide con el nuevo plan_expires_at, así que el cron vuelve a considerar
-- elegible a esa cuenta sin que nadie tenga que limpiar nada a mano.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.account_plans
  add column if not exists expiry_reminder_sent_for timestamptz;
