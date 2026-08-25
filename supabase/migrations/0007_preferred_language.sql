-- GastroMetrics — idioma preferido de la cuenta, para correos transaccionales en el
-- idioma real del destinatario (ver docs/58 y lib/i18n/email-labels.ts).
--
-- Por qué hace falta una columna nueva y no basta con el idioma actual de la UI
-- (localStorage, lib/i18n/translations.ts): los correos se generan en rutas de
-- servidor (signup, recuperación de contraseña, cambios de plan vía webhook de
-- Stripe) que no tienen forma de leer el localStorage del navegador — algunos ni
-- siquiera corren en el momento en que la persona está mirando la pantalla (el
-- webhook de Stripe puede llegar minutos después). Se necesita un valor persistido
-- del lado del servidor.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.profiles
  add column if not exists preferred_language text not null default 'es';

-- El trigger de creación de perfil (0003_profile_signup_trigger.sql) necesita leer
-- también este campo desde raw_user_meta_data — se manda en options.data de
-- admin.generateLink({type:"signup", ...}) igual que full_name/nationality/etc.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, nationality, currency, business_type, business_size,
    industry_experience, onboarding_completed, preferred_language
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
    coalesce(new.raw_user_meta_data->>'preferred_language', 'es')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Feedback (/contacto) puede venir de un visitante sin cuenta — necesita su propio
-- campo, no puede depender de profiles.
alter table public.feedback
  add column if not exists preferred_language text not null default 'es';
