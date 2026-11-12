-- Personas con acceso a /admin (docs/282). Cada una entra con su propia cuenta de la app
-- en vez de un código compartido. El código de acceso queda solo como llave de emergencia.
--
-- No se siembra ningún correo aquí (el repositorio es público): la primera persona que
-- entra con el código estando con su cuenta abierta queda como dueña («owner»), y desde el
-- panel da acceso a otras. Un acceso puede guardarse sin enviar («pending») y el dueño
-- decide cuándo mandar la invitación («invited»); al entrar por primera vez pasa a «active».
create table if not exists public.admin_members (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  role text not null default 'admin' check (role in ('owner', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'invited', 'active')),
  invited_at timestamptz,
  invited_by text,
  accepted_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text
);

-- Sin políticas: nadie la lee ni la escribe desde el navegador. Solo las rutas de /admin,
-- con la llave de servicio y después de comprobar la sesión del panel.
alter table public.admin_members enable row level security;
