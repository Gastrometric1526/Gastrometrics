-- GastroMetrics — presencia real de usuarios (online/offline), pedido explícito del
-- dueño del proyecto: quería ver en /admin > Cuentas quién está conectado ahora mismo,
-- no solo cuándo inició sesión por última vez. Ver docs/70.
--
-- Un heartbeat del navegador (cada ~60s, mientras haya sesión real y NO esté en
-- /admin, mismo criterio de exclusión que ya usa components/analytics-tracker.tsx)
-- hace un upsert autenticado directo de su propia fila — sin pasar por una ruta de
-- servidor, mismo patrón ya usado por syncPreferredLanguage/updateUserProfile contra
-- `profiles` (ver política profiles_self_all de 0002_profiles.sql). El umbral de
-- "en línea" (activo en los últimos ~3 minutos) se calcula del lado del servidor en
-- app/api/admin/presence/route.ts — esta tabla solo guarda el timestamp crudo.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_user_presence_last_seen_at on public.user_presence(last_seen_at);

alter table public.user_presence enable row level security;

-- Cada quien solo puede leer/escribir su propia fila (mismo patrón que
-- profiles_self_all). El admin lee TODAS las filas del lado del servidor con el
-- cliente de service role (getSupabaseAdminClient), que bypassa esta política igual
-- que ya hace con page_views.
drop policy if exists "user_presence_self_all" on public.user_presence;
create policy "user_presence_self_all" on public.user_presence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
