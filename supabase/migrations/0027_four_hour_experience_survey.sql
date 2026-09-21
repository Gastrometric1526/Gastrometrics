-- GastroMetrics — pedido explícito del dueño del proyecto: cuando una cuenta cumple
-- 4 horas de uso REAL dentro de la app (no 4 horas desde el registro — tiempo activo
-- real, ver supabase/migrations/0016_presence_time_tracking.sql), que le llegue un
-- correo preguntando qué tal ha sido la experiencia, con un link para dejar un
-- comentario (visible en /admin, ver 0026_feedback_experiencia_type.sql) y un link a
-- Trustpilot. Ver docs/117.
--
-- Se agrega "four_hour_experience" como quinto valor válido de email_type en
-- activation_emails_sent (0020_activation_emails.sql) — mismo mecanismo de
-- idempotencia que ya usan los otros 3 correos de activación (unique
-- account_id+email_type: como máximo un envío por cuenta, para siempre).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.activation_emails_sent drop constraint if exists activation_emails_sent_email_type_check;
alter table public.activation_emails_sent add constraint activation_emails_sent_email_type_check
  check (email_type in ('first_recipe_reminder', 'day7_margin_checkin', 'first_sale_reinforcement', 'four_hour_experience'));
