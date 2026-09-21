-- GastroMetrics — pedido explícito del dueño del proyecto: implementar los 3 documentos
-- legales reales (Términos de Uso, Política de Privacidad, Aviso de Responsabilidad,
-- versión 1.2) y hacer que el comportamiento real del proyecto sea acorde a ellos.
-- Ver docs/118.
--
-- 1) Consentimiento de términos, para exigirlo en el registro de cuentas nuevas y para
--    detectar cuentas existentes que aceptaron una versión anterior (banner de aviso).
-- 2) deletion_requested_at, para convertir el borrado de cuenta autoservicio en un
--    borrado suave con 30 días de gracia para reactivar (promesa explícita de la
--    sección 5 de los nuevos Términos) en vez del borrado inmediato/irreversible actual.
-- 3) Nuevo valor de email_type en activation_emails_sent, para el aviso por correo a
--    usuarios existentes sobre estos documentos (máximo un envío por cuenta, mismo
--    mecanismo que ya usan los otros 4 correos de activación).
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists deletion_requested_at timestamptz;

-- El trigger de creación de perfil (0003, extendido en 0022) necesita leer también
-- estos dos campos desde raw_user_meta_data — se mandan en options.data de
-- admin.generateLink({type:"signup", ...}) igual que los demás, ver
-- app/api/auth/signup/route.ts y lib/legal.ts (CURRENT_LEGAL_VERSION).
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
  return new;
end;
$$;

alter table public.activation_emails_sent drop constraint if exists activation_emails_sent_email_type_check;
alter table public.activation_emails_sent add constraint activation_emails_sent_email_type_check
  check (email_type in (
    'first_recipe_reminder',
    'day7_margin_checkin',
    'first_sale_reinforcement',
    'four_hour_experience',
    'legal_update_notice'
  ));
