-- GastroMetrics — importación de ventas del POS, migrada de localStorage a Supabase
-- real (ver docs/60). Mismo patrón exacto que 0005_ids_as_text.sql (id/business_id
-- como texto, un blob `data jsonb` por fila, RLS dueño + miembro de negocio via
-- is_business_member — ya definida ahí, no se repite acá).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

create table if not exists public.sales_imports (
  id text primary key,
  business_id text references public.businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}' -- fileName, importedAt, periodStart/End, totalRevenue,
                                    -- totalTheoreticalCost, lineCount, unmatchedDishNames[], lines[]
);

-- Una fila por negocio (el mapeo se re-usa entera cada vez, no se acumula histórico) —
-- id = businessId real, o "main" para el espacio por defecto.
create table if not exists public.pos_column_mappings (
  id text primary key,
  business_id text references public.businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}' -- dateColumn, dishColumn, quantityColumn, priceColumn
);

-- Una fila por (negocio, nombre de plato normalizado) — id compuesto para que guardar
-- el mismo plato dos veces actualice en vez de duplicar, igual que hacía
-- saveDishNameMapping() en localStorage (filter + push).
create table if not exists public.dish_name_mappings (
  id text primary key, -- `${businessId||'main'}::${normalizedPosName}`
  business_id text references public.businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}' -- normalizedPosName, recipeId
);

create index if not exists idx_sales_imports_business on public.sales_imports(business_id);
create index if not exists idx_pos_column_mappings_business on public.pos_column_mappings(business_id);
create index if not exists idx_dish_name_mappings_business on public.dish_name_mappings(business_id);

alter table public.sales_imports enable row level security;
alter table public.pos_column_mappings enable row level security;
alter table public.dish_name_mappings enable row level security;

drop policy if exists "sales_imports_owner_all" on public.sales_imports;
create policy "sales_imports_owner_all" on public.sales_imports
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "sales_imports_member_select" on public.sales_imports;
create policy "sales_imports_member_select" on public.sales_imports
  for select using (is_business_member(sales_imports.business_id));

drop policy if exists "pos_column_mappings_owner_all" on public.pos_column_mappings;
create policy "pos_column_mappings_owner_all" on public.pos_column_mappings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "pos_column_mappings_member_select" on public.pos_column_mappings;
create policy "pos_column_mappings_member_select" on public.pos_column_mappings
  for select using (is_business_member(pos_column_mappings.business_id));

drop policy if exists "dish_name_mappings_owner_all" on public.dish_name_mappings;
create policy "dish_name_mappings_owner_all" on public.dish_name_mappings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "dish_name_mappings_member_select" on public.dish_name_mappings;
create policy "dish_name_mappings_member_select" on public.dish_name_mappings
  for select using (is_business_member(dish_name_mappings.business_id));
