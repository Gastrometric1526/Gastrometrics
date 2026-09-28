-- GastroMetrics — dos piezas pedidas juntas por el dueño del proyecto (ver docs/131):
--
-- 1. recipe_drafts: borrador automático de la Ficha Técnica (receta NUEVA, sin
--    guardar todavía). Si la persona se sale de /ficha-tecnica por cualquier motivo
--    (cerró la pestaña, se le fue el internet, navegó a otro módulo), al volver dentro
--    de las siguientes 24 horas la receta en la que estaba trabajando se restaura sola.
--    El navegador guarda una copia en localStorage (instantáneo, funciona sin red); esta
--    tabla es la copia del servidor, que sirve para dos cosas que localStorage no puede:
--      a) continuar desde OTRO dispositivo (empezó en la compu, sigue en el celular), y
--      b) que el cron de recordatorios sepa que hay una receta a medias y pueda mandar
--         el correo "tu receta X te espera" (ver lib/services/notify-reengagement.ts).
--    Una fila por persona + negocio (business_key = id del negocio, o 'main' para el
--    espacio por defecto — acá SÍ se guarda 'main' como texto porque esta columna no es
--    foreign key a businesses, justamente para no tener que normalizarlo a null).
--    La imagen de la receta NO viaja al servidor (base64 pesado) — solo en localStorage.
--    Filas con más de 48 horas las borra el cron diario (el cliente ya ignora > 24h).
--
-- 2. reengagement_emails_sent: log de los correos de recordatorio / re-enganche que
--    manda el cron (inventario, reportes, receta sin terminar, precios, "te extrañamos").
--    A diferencia de activation_emails_sent (0020), acá un mismo tipo SÍ se puede volver
--    a mandar (después de un periodo de enfriamiento), así que no hay unique — el cron
--    lee este log para respetar: máximo 1 recordatorio cada 4 días por cuenta, y el mismo
--    tipo no se repite antes de 21 días. Sin políticas RLS: solo el service role (cron).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL Editor
-- de Supabase y correr. Re-corrible. Si todavía no se corrió, la app lo tolera: el
-- borrador sigue funcionando solo con localStorage y el cron salta los recordatorios.

create table if not exists public.recipe_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  business_key text not null,
  recipe_name text not null default '',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, business_key)
);

create index if not exists idx_recipe_drafts_updated_at on public.recipe_drafts(updated_at);

alter table public.recipe_drafts enable row level security;

drop policy if exists "recipe_drafts_self_all" on public.recipe_drafts;
create policy "recipe_drafts_self_all" on public.recipe_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.reengagement_emails_sent (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in (
    'unfinished_recipe',
    'inventory_count',
    'review_reports',
    'update_prices',
    'we_miss_you'
  )),
  sent_at timestamptz not null default now()
);

create index if not exists idx_reengagement_emails_account on public.reengagement_emails_sent(account_id, sent_at desc);

alter table public.reengagement_emails_sent enable row level security;
-- Sin políticas para usuarios autenticados — mismo criterio que activation_emails_sent.
