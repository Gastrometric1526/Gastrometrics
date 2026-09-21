-- GastroMetrics — repara un bug real encontrado al investigar por qué una cuenta
-- nueva mostraba "Plan: Chef Ejecutivo" sin haber pagado nada.
--
-- Causa real: 0004_account_plans.sql SÍ dejaba el trigger public.handle_new_user()
-- creando la fila de account_plans ('foodie') al registrarse — pero
-- 0007_preferred_language.sql, la primera migración siguiente que tuvo que tocar ese
-- mismo trigger (para agregar preferred_language a la fila de profiles), hizo
-- `create or replace function` con el cuerpo COMPLETO reescrito, y se le olvidó
-- incluir el insert a account_plans. Cada `create or replace function` posterior
-- (0022, 0028) heredó ese mismo cuerpo incompleto sin que nadie lo notara — ninguna
-- de esas migraciones tocaba account_plans, así que no había motivo para sospechar.
--
-- Por qué no se notó en producción hasta ahora: lib/plan-access.ts#getCurrentPlanSlug
-- ya cae a "foodie" cuando el caché local (localStorage) está vacío — así que en un
-- navegador realmente nuevo, una cuenta sin fila de account_plans igual SE VEÍA como
-- Foodie por casualidad. El síntoma real solo aparece si ese mismo navegador ya tenía
-- cacheado el plan de OTRA cuenta (por ejemplo, una cuenta de prueba en Chef
-- Ejecutivo vía TESTER_ALLOWLIST_EMAILS) — contexts/auth-context.tsx tenía además su
-- propio bug relacionado (ya corregido en el mismo commit que esta migración): si no
-- encontraba fila de account_plans, simplemente no tocaba ese caché, dejando el plan
-- de la cuenta anterior "pegado" a la cuenta nueva en vez de resetearlo a foodie.
--
-- Esta migración: 1) repara el trigger para que vuelva a crear la fila de
-- account_plans al registrarse (mismo cuerpo que ya trae 0028, solo se le agrega esa
-- única línea que faltaba), y 2) rellena con 'foodie' la fila que le falta a
-- cualquier cuenta real ya existente que se haya registrado desde 0007 hasta ahora sin
-- haber pasado nunca por un checkout de Stripe ni por una asignación manual desde
-- /admin (los únicos otros caminos que sí crean la fila por su cuenta).
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, nationality, currency, business_type, business_size,
    industry_experience, onboarding_completed, preferred_language, product_updates_opt_in,
    terms_accepted_at, terms_version
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'nationality', ''),
    coalesce(new.raw_user_meta_data->>'currency', ''),
    coalesce(new.raw_user_meta_data->>'business_type', ''),
    coalesce(new.raw_user_meta_data->>'business_size', ''),
    coalesce(new.raw_user_meta_data->>'industry_experience', ''),
    true,
    coalesce(new.raw_user_meta_data->>'preferred_language', 'es'),
    coalesce((new.raw_user_meta_data->>'product_updates_opt_in')::boolean, false),
    coalesce((new.raw_user_meta_data->>'terms_accepted_at')::timestamptz, now()),
    new.raw_user_meta_data->>'terms_version'
  )
  on conflict (id) do nothing;

  insert into public.account_plans (account_id, plan_slug)
  values (new.id, 'foodie')
  on conflict (account_id) do nothing;

  return new;
end;
$$;

-- Backfill: cuentas reales ya existentes sin fila de account_plans (confirmado en
-- producción: 4 cuentas, todas de prueba/typo de esta misma sesión, ninguna con un
-- plan pagado real que se pudiera estar perdiendo).
insert into public.account_plans (account_id, plan_slug)
select id, 'foodie' from auth.users
where id not in (select account_id from public.account_plans)
on conflict (account_id) do nothing;
