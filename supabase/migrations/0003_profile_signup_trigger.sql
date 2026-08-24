-- GastroMetrics — creación automática de fila en profiles al registrarse
-- Fase 1 de la migración a Supabase real (ver docs/51 y contexts/auth-context.tsx).
--
-- Por qué un trigger y no un insert desde el cliente justo después de signUp():
-- Supabase, por defecto, exige confirmar el correo antes de crear una sesión real.
-- Eso significa que, justo después de `supabase.auth.signUp(...)`, todavía NO hay
-- sesión activa (auth.uid() es null) — un insert a `profiles` hecho desde el
-- cliente en ese momento chocaría con la política RLS `profiles_self_all`
-- (auth.uid() = id) y fallaría siempre, confirme el usuario su correo o no.
--
-- La solución estándar de Supabase es un trigger sobre `auth.users` que corre
-- con privilegios de definer (bypassa RLS) en el mismo insert que crea la cuenta,
-- sin depender de que haya sesión. Los datos del perfil (nombre, país, moneda...)
-- se mandan en `options.data` de signUp() y llegan aquí vía `raw_user_meta_data`.
--
-- Cómo aplicar: igual que 0001/0002 — pegar completo en el SQL Editor de Supabase
-- y correr. Re-corrible (create or replace function, drop trigger if exists).

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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
