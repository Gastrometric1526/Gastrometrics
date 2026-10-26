-- GastroMetrics — chat de soporte dentro de la app (docs/204).
--
-- Pedido del dueño: un chat no intrusivo donde la persona escribe desde cualquier módulo, un bot
-- pregunta de qué se trata (Ficha Técnica, Ingredientes, Inventario…) y sugiere el manual, la
-- atención es por orden de llegada (la persona ve cuántas personas tiene adelante) y el dueño
-- responde desde /admin en una bandeja tipo Messenger, con fotos y documentos.
--
-- Igual que `feedback` (0006): RLS activado y SIN políticas para el cliente. Todo pasa por rutas
-- de servidor con la service role key (app/api/support/*, app/api/admin/support/*): la persona
-- solo ve sus conversaciones (lo filtra la ruta con su sesión) y el dueño ve todas.
--
-- Adjuntos: en `attachments` (jsonb) como data URL, con tope de tamaño en la ruta (imágenes
-- comprimidas en el navegador; PDF, Excel y CSV de hasta 3 MB). Volumen bajo por ahora; si
-- crece, se pasa a Storage sin cambiar la interfaz.
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.
-- Mientras no se corra, el botón de ayuda manda el mensaje al buzón de siempre (/contacto).

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'otro',
  subject text not null default '',
  -- waiting = le toca al dueño responder; answered = respondió el dueño; closed = resuelta.
  status text not null default 'waiting' check (status in ('waiting', 'answered', 'closed')),
  -- Orden de llegada: desde cuándo espera respuesta (se fija al pasar a «waiting»).
  waiting_since timestamptz default now(),
  page text,
  language text not null default 'es',
  user_unread integer not null default 0,
  admin_unread integer not null default 0,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_conv_account on public.support_conversations(account_id, last_message_at desc);
create index if not exists idx_support_conv_status on public.support_conversations(status, waiting_since);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'admin', 'bot')),
  body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_msg_conv on public.support_messages(conversation_id, created_at);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
-- Sin políticas para anon/authenticated: acceso solo por rutas de servidor (ver arriba).
