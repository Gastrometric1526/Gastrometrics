-- GastroMetrics — negocios extra y cupos de equipo extra, por cuenta, desde /admin.
--
-- Por qué: "Cuentas y planes" (app/api/admin/account-plan/route.ts) solo podía
-- otorgar un plan completo o una fecha de vencimiento — no había forma de darle a
-- una cuenta puntual, p. ej., "1 negocio más" o "2 cupos de equipo más" sin subirle
-- el plan entero (con todas las demás funciones que eso desbloquea de más).
-- 0 = sin cambio para cualquier cuenta ya existente (comportamiento de siempre).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.account_plans
  add column if not exists extra_businesses integer not null default 0,
  add column if not exists extra_team_seats integer not null default 0;
