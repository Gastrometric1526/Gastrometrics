-- GastroMetrics — Facturas a clientes, pedido explícito del dueño del proyecto tras
-- una pregunta real de un usuario ("how do I make an invoice, is that external?").
-- Documento de cara al CLIENTE del negocio, a diferencia de Orden de Compra (hacia un
-- proveedor) — reusa el nombre y el logo del negocio que ya existen en `businesses`.
--
-- Mismo patrón exacto que el resto de tablas de negocio (ver 0005_ids_as_text.sql +
-- 0011_team_write_access.sql para el porqué de cada pieza): id/business_id como texto,
-- un blob `data` jsonb con el resto de los campos (cliente, items, subtotal/impuesto/
-- total, notas), RLS dueño + miembro de negocio con la función "invoices" habilitada
-- (has_feature_access ya existe desde 0011, no hace falta redefinirla). `number` vive
-- como columna propia (no dentro de `data`) para poder ordenar/filtrar por número sin
-- tener que indexar dentro del jsonb.
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

create table if not exists public.invoices (
  id text primary key,
  business_id text references public.businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  number text not null,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}' -- status, issueDate, clientName, clientTaxId,
                                    -- clientEmail, clientAddress, items[], taxPercent,
                                    -- notes, subtotal, taxAmount, total, metadata
);

create index if not exists idx_invoices_business on public.invoices(business_id);

alter table public.invoices enable row level security;

-- Dueño real del negocio: acceso total, sin importar quién haya escrito la fila
-- (mismo criterio ya corregido para el resto de tablas en 0011, aplicado acá desde el
-- primer día porque esta tabla es nueva).
drop policy if exists "invoices_owner_all" on public.invoices;
create policy "invoices_owner_all" on public.invoices
  for all
  using (auth.uid() = owner_id or is_business_owner(invoices.business_id))
  with check (auth.uid() = owner_id or is_business_owner(invoices.business_id));

-- Miembro de equipo: lectura si es miembro del negocio, escritura solo si además tiene
-- la función "invoices" habilitada en su allowed_features (ver app/equipo/page.tsx).
drop policy if exists "invoices_member_select" on public.invoices;
create policy "invoices_member_select" on public.invoices
  for select using (is_business_member(invoices.business_id));

drop policy if exists "invoices_member_write" on public.invoices;
create policy "invoices_member_write" on public.invoices
  for insert with check (
    is_business_member(invoices.business_id) and has_feature_access(invoices.business_id, 'invoices')
  );

drop policy if exists "invoices_member_update" on public.invoices;
create policy "invoices_member_update" on public.invoices
  for update
  using (is_business_member(invoices.business_id) and has_feature_access(invoices.business_id, 'invoices'))
  with check (is_business_member(invoices.business_id) and has_feature_access(invoices.business_id, 'invoices'));

drop policy if exists "invoices_member_delete" on public.invoices;
create policy "invoices_member_delete" on public.invoices
  for delete using (is_business_member(invoices.business_id) and has_feature_access(invoices.business_id, 'invoices'));
