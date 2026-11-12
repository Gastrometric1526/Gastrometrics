-- Solicitudes para recuperar una cuenta (docs/285): quien no recuerda con qué correo se
-- registró, quien ya no tiene acceso a su correo, o quien borró su contenido por error y
-- pide un respaldo. Llegan a /admin → Mensajes → «Recuperar cuentas»; el dueño verifica y
-- resuelve desde la ficha de la cuenta (cambiar correo, enlace de contraseña o Respaldos).
create table if not exists public.account_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('forgot_email', 'lost_email', 'restore_content')),
  full_name text,
  business_name text,
  -- Cómo contestarle: un correo al que sí tiene acceso o un teléfono / WhatsApp.
  contact text not null,
  -- Correos que cree haber usado (puede no recordarlo).
  possible_emails text,
  details text,
  -- Si la pidió con la sesión abierta (restaurar contenido), su cuenta.
  user_id uuid references auth.users (id) on delete set null,
  user_email text,
  language text,
  status text not null default 'nuevo' check (status in ('nuevo', 'resuelto')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_recovery_requests_created_idx on public.account_recovery_requests (created_at desc);

-- Sin políticas: nadie la lee ni la escribe desde el navegador. La escriben
-- /api/account/recovery (con límite por IP) y la leen las rutas de /admin, con la llave de servicio.
alter table public.account_recovery_requests enable row level security;
