-- GastroMetrics — Equipo real: la lista de invitados sale de localStorage, y aceptar
-- una invitación otorga acceso de LECTURA real (no solo "vista previa" del dueño) vía
-- las políticas is_business_member(...) que ya existían desde 0001_init.sql/
-- 0005_ids_as_text.sql sin ningún código que las activara. Ver docs/60 para el alcance
-- exacto y, sobre todo, sus límites — léanse antes de asumir que esto es
-- colaboración completa.
--
-- Alcance real de este cambio (importante, no es "Fase 4 completa"):
--   - La LISTA de a quién se invitó, con qué alcance/herramientas/PDFs, ya no vive en
--     localStorage — vive aquí, por cuenta (owner_id), sincronizada entre dispositivos.
--   - Aceptar una invitación (o simplemente que el dueño la mande — ver
--     app/api/team/invite/route.ts) inserta una fila real en business_members, lo que
--     activa la LECTURA real (RLS) del negocio/ingredientes/recetas/inventario/menús/
--     órdenes de ese negocio para la persona invitada, en su propia sesión real.
--   - LO QUE NO HACE: no restringe esa lectura por allowed_features/pdf_access — eso
--     sigue siendo un filtro solo de la interfaz (qué pantallas se muestran), no de la
--     base de datos. Una persona invitada con `allowedFeatures: ["inventory"]` técnicamente
--     puede leer también ingredientes/recetas (con costos) si consulta la API directo,
--     aunque la UI no le muestre esas pantallas. Tampoco da permiso de ESCRITURA —
--     is_business_member solo aparece en políticas `for select`; guardar/editar sigue
--     siendo exclusivo del dueño (auth.uid() = owner_id) en cada tabla. Restringir
--     lectura por feature y habilitar escritura real por miembro requeriría políticas
--     RLS nuevas, por tabla y por feature — deliberadamente fuera de este cambio, por
--     el riesgo de diseñarlas mal y abrir un hueco de seguridad real.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

create table if not exists public.team_members (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  name text,
  status text not null default 'invitado', -- 'invitado' | 'activo'
  scope text not null default 'dashboard', -- 'dashboard' (todos los negocios) o un business_id real
  allowed_features jsonb not null default '[]',
  pdf_access text not null default 'ninguno',
  -- Se conoce de inmediato al invitar (admin.generateLink crea/vincula la cuenta real
  -- en el momento, no hace falta esperar a que la persona confirme/entre) — ver
  -- app/api/team/invite/route.ts.
  invited_user_id uuid references auth.users(id),
  activity jsonb not null default '[]', -- array de {id, description, timestamp}
  invited_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_team_members_owner on public.team_members(owner_id);
create index if not exists idx_team_members_invited_user on public.team_members(invited_user_id);

alter table public.team_members enable row level security;

drop policy if exists "team_members_owner_all" on public.team_members;
create policy "team_members_owner_all" on public.team_members
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- La persona invitada puede ver su propia fila (para saber a qué la invitaron) —
-- benigno, no expone nada de otras filas ni de otras cuentas.
drop policy if exists "team_members_self_select" on public.team_members;
create policy "team_members_self_select" on public.team_members
  for select using (invited_user_id = auth.uid());
