-- GastroMetrics — casilla de "quiero recibir novedades del producto por correo",
-- pedida en la creación de cuenta (ver app/signup/page.tsx paso 4). Columna aparte
-- de `preferred_language` (0007): esa decide EN QUÉ IDIOMA sale cualquier correo
-- transaccional que ya se manda igual (confirmación, recuperación, etc.); esta decide
-- SI la cuenta quiere además el correo no transaccional de "novedades" cuando el
-- dueño del proyecto publique una nueva versión — dos preguntas distintas.
--
-- Default false a propósito (pedido explícito: "para que no sea tan molesto") — sin
-- marcar la casilla al registrarse, la cuenta nunca recibe estos correos; nunca se
-- asume que sí por omisión.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.profiles
  add column if not exists product_updates_opt_in boolean not null default false;

-- El trigger de creación de perfil necesita leer también este campo desde
-- raw_user_meta_data — se manda en options.data de admin.generateLink({type:"signup",
-- ...}) igual que full_name/preferred_language/etc. (ver app/api/auth/signup/route.ts).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, nationality, currency, business_type, business_size,
    industry_experience, onboarding_completed, preferred_language, product_updates_opt_in
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
    coalesce((new.raw_user_meta_data->>'product_updates_opt_in')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
