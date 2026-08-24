-- GastroMetrics — buzón de /contacto (sugerencias, quejas, reportes de bug) real,
-- ya no solo en el localStorage del dispositivo de quien esté viendo /admin.
--
-- Por qué esta tabla no tiene políticas de RLS para "anon"/"authenticated" (a
-- propósito, deny-all para el cliente): cualquiera puede mandar un mensaje desde
-- /contacto, con o sin sesión iniciada — no hay un owner_id confiable de quien lo
-- manda. Y del otro lado, solo el dueño del proyecto (candado de /admin, ver
-- app/api/admin/verify/route.ts) debe poder LEER los mensajes de todo el mundo, lo
-- cual tampoco es algo que RLS por fila pueda expresar bien. Por eso toda la
-- lectura/escritura pasa por rutas de servidor con la service role key
-- (app/api/feedback/submit, app/api/admin/feedback/*), nunca directo desde el
-- cliente con el anon key.

create table if not exists feedback (
  id text primary key,
  type text not null check (type in ('sugerencia', 'queja', 'bug')),
  message text not null,
  user_name text,
  user_email text,
  page text,
  image_data_url text,
  status text not null default 'nuevo' check (status in ('nuevo', 'revisado', 'resuelto')),
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_created_at on feedback(created_at desc);

alter table feedback enable row level security;
-- Sin políticas para anon/authenticated: el acceso es 100% por rutas de servidor
-- con la service role key (ver el comentario de arriba).
