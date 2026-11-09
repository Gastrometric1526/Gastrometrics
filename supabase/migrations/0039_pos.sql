-- GastroMetrics — POS propio (docs/268): plano del salón, extras y pedidos abiertos.
-- Mismo patrón que 0009_sales_imports.sql: id/business_id como texto y un blob `data jsonb`.
--   id = '<negocio>::floor'  → plano del salón
--   id = '<negocio>::config' → extras y platos ocultos
--   id = <uuid>              → pedido abierto (se borra al cobrarlo; la venta queda en sales_imports)
-- Escriben el dueño y las personas del equipo con la función 'pos'. Respeta los negocios
-- bloqueados por el plan (0037).
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

create table if not exists public.pos_data (
  id text primary key,
  business_id text references public.businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  kind text not null check (kind in ('floor', 'config', 'order')),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'
);

create index if not exists idx_pos_data_business on public.pos_data(business_id);

alter table public.pos_data enable row level security;

-- Dueño: igual que 0012 (en el espacio principal manda owner_id; en un negocio, ser su dueño).
drop policy if exists "pos_data_owner_all" on public.pos_data;
create policy "pos_data_owner_all" on public.pos_data
  for all
  using ((pos_data.business_id is null and auth.uid() = owner_id) or is_business_owner(pos_data.business_id))
  with check ((pos_data.business_id is null and auth.uid() = owner_id) or is_business_owner(pos_data.business_id));

-- Equipo: leer siendo miembro; escribir con la función 'pos'.
drop policy if exists "pos_data_member_select" on public.pos_data;
create policy "pos_data_member_select" on public.pos_data
  for select using (is_business_member(pos_data.business_id));

drop policy if exists "pos_data_member_write" on public.pos_data;
create policy "pos_data_member_write" on public.pos_data
  for insert with check (is_business_member(pos_data.business_id) and has_feature_access(pos_data.business_id, 'pos'));

drop policy if exists "pos_data_member_update" on public.pos_data;
create policy "pos_data_member_update" on public.pos_data
  for update
  using (is_business_member(pos_data.business_id) and has_feature_access(pos_data.business_id, 'pos'))
  with check (is_business_member(pos_data.business_id) and has_feature_access(pos_data.business_id, 'pos'));

drop policy if exists "pos_data_member_delete" on public.pos_data;
create policy "pos_data_member_delete" on public.pos_data
  for delete using (is_business_member(pos_data.business_id) and has_feature_access(pos_data.business_id, 'pos'));

-- Negocio bloqueado por el plan (0037): no se crea ni cambia nada.
drop trigger if exists block_locked_business_write on public.pos_data;
create trigger block_locked_business_write before insert or update on public.pos_data
  for each row execute function public.block_locked_business_write();
