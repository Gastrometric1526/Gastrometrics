-- GastroMetrics — vencimiento opcional de un plan asignado a mano desde /admin.
--
-- Por qué: hasta ahora, "Cuentas y planes" (app/api/admin/account-plan/route.ts) solo
-- podía asignar un plan a una cuenta de forma permanente — útil para el dueño mismo o
-- testers de largo plazo, pero no había forma de dar acceso temporal (p. ej. "Chef
-- Ejecutivo por 30 días a este tester nuevo") sin acordarse de volver a mano a
-- revertirlo. NULL = sin vencimiento (comportamiento de siempre, no cambia nada para
-- ninguna cuenta ya asignada). No aplica a planes reales pagados por Stripe — esos ya
-- se manejan solos vía el webhook (customer.subscription.deleted).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.account_plans
  add column if not exists plan_expires_at timestamptz;
