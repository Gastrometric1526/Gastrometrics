-- GastroMetrics — plan de suscripción real por cuenta
-- Fase 2 de la migración a Supabase real (ver docs/52). Reemplaza a
-- lib/plan-access.ts guardando el slug del plan solo en localStorage (cualquiera
-- podía "comprar" cualquier plan solo llamando a una función de JS en su consola).

create table if not exists account_plans (
  account_id uuid primary key references auth.users(id) on delete cascade,
  plan_slug text not null default 'foodie',
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table account_plans enable row level security;

-- Cada quien solo puede LEER su propio plan. A propósito, no hay política de
-- insert/update/delete para "authenticated" ni "anon" — el plan de una cuenta solo lo
-- cambia el servidor (rutas de API que usan la service role key, verificadas contra
-- Stripe o contra la sesión real, ver lib/supabase/admin.ts), nunca un PATCH directo
-- del cliente contra esta tabla. Sin este candado, cualquiera con su propio anon key
-- podría auto-otorgarse el plan más caro gratis.
drop policy if exists "account_plans_self_select" on account_plans;
create policy "account_plans_self_select" on account_plans
  for select using (auth.uid() = account_id);

-- Actualiza el trigger de registro (0003_profile_signup_trigger.sql) para que también
-- cree la fila de plan por defecto ("foodie", gratis) al crear la cuenta. Re-corrible
-- (create or replace function).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, nationality, currency, business_type, business_size,
    industry_experience, onboarding_completed
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'nationality', ''),
    coalesce(new.raw_user_meta_data->>'currency', ''),
    coalesce(new.raw_user_meta_data->>'business_type', ''),
    coalesce(new.raw_user_meta_data->>'business_size', ''),
    coalesce(new.raw_user_meta_data->>'industry_experience', ''),
    true
  )
  on conflict (id) do nothing;

  insert into public.account_plans (account_id, plan_slug)
  values (new.id, 'foodie')
  on conflict (account_id) do nothing;

  return new;
end;
$$;
