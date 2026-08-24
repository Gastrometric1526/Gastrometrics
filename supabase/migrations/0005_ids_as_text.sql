-- GastroMetrics — ids como texto + columna `data` jsonb para el resto de cada objeto
-- Fase 3 de la migración a Supabase real (ver docs/52).
--
-- Dos cambios de diseño sobre 0001_init.sql, los dos motivados por el mismo hecho: el
-- modelo de datos de esta app vivió siempre en TypeScript/localStorage, con interfaces
-- que crecieron con muchos campos opcionales a lo largo de muchas sesiones (ver
-- types/ingredient.ts, types/recipe.ts, etc.) — 0001_init.sql modeló solo un subconjunto
-- de esos campos como columnas reales, así que insertar un objeto real de hoy contra
-- ese esquema perdería datos (merma completo, recipeData de sub-recetas, logo de
-- negocio, isActive, etc. no tienen columna).
--
-- 1) id / business_id / recipe_id pasan de `uuid` a `text`: la app SIEMPRE generó sus
--    propios ids en el cliente como texto arbitrario (ver
--    components/add-business-dialog.tsx, app/ingredientes/page.tsx generateUniqueId()),
--    nunca como uuid real.
-- 2) cada tabla gana una columna `data jsonb` que guarda el objeto COMPLETO tal como lo
--    usa la app (Ingredient, Recipe, Business, etc.) — las columnas reales que se
--    mantienen (id, business_id, owner_id, name, fechas) son solo las que hacen falta
--    para RLS, índices, y ordenar/filtrar; todo lo demás vive en `data`, sin arriesgarse
--    a que un campo opcional que hoy no tiene columna se pierda al guardar. Es el mismo
--    patrón que ya usaba localStorage (un blob por registro), solo que ahora relacional
--    por fila en vez de un array completo por negocio.
--
-- Seguro de correr: ninguna de estas tablas tiene datos reales todavía (confirmado por
-- API antes de escribir esta migración — 0 filas). Por eso se recrean directo
-- (drop + create) en vez de un ALTER fila por fila.
--
-- Cómo aplicar: igual que las anteriores — pegar completo en el SQL Editor de Supabase
-- y correr. Requiere que 0001_init.sql ya se haya corrido antes (reemplaza sus tablas
-- de negocio; deja intactas profiles/account_plans de 0002-0004).

drop table if exists purchase_orders cascade;
drop table if exists menus cascade;
drop table if exists inventory_snapshots cascade;
drop table if exists inventory_items cascade;
drop table if exists recipes_trash cascade;
drop table if exists recipes cascade;
drop table if exists ingredients cascade;
drop table if exists business_invites cascade;
drop table if exists business_members cascade;
drop table if exists businesses cascade;

-- ============================================================
-- NEGOCIOS
-- ============================================================

create table businesses (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}' -- description, type, hasCustomizedCosts, hasFinancialData,
                                    -- logo, expenses, estimatedMonthlyPlates, netProfitPercentage,
                                    -- isActive, pricingMethod, targetFoodCostPercent (ver types/business.ts)
);

create table business_members (
  business_id text references businesses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member',
  invited_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table business_invites (
  token uuid primary key default gen_random_uuid(),
  business_id text references businesses(id) on delete cascade not null,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

-- ============================================================
-- INGREDIENTES
-- ============================================================

create table ingredients (
  id text primary key,
  business_id text references businesses(id) on delete cascade, -- null = espacio "main" del usuario
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}' -- unit, pricing, presentation, supplier, merma, metadata, notes,
                                    -- recipeId, recipeData, unitLocked, etc. (ver types/ingredient.ts)
);

-- ============================================================
-- RECETAS
-- ============================================================

create table recipes (
  id text primary key,
  business_id text references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  classification text not null,
  is_sub_recipe boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}' -- ingredients[], procedure[], costos, pricing, metadata,
                                    -- originalSnapshot, etc. (ver types/recipe.ts)
);

create table recipes_trash (
  id text primary key,
  recipe_id text not null,
  business_id text references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  deleted_at timestamptz not null default now(),
  data jsonb not null default '{}' -- snapshot completo de la receta al momento de borrar
);

-- ============================================================
-- INVENTARIO
-- ============================================================

create table inventory_items (
  id text primary key,
  business_id text references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}' -- name, category, currentStock, minStock, unit, price,
                                    -- netContent, presentation, location, supplier, status
);

create table inventory_snapshots (
  id text primary key,
  business_id text references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  date timestamptz not null default now(),
  data jsonb not null default '{}' -- type, periodicity, division, notes, inventoryMode,
                                    -- modifiedItems, totalValue, items[]
);

-- ============================================================
-- MENÚS
-- ============================================================

create table menus (
  id text primary key,
  business_id text references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}' -- menuType, serviceDate, plannedServings, steps[], items[]
);

-- ============================================================
-- ÓRDENES DE COMPRA
-- ============================================================

create table purchase_orders (
  id text primary key,
  business_id text references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}' -- name, number, date, recipes[], items[], total, status, supplier
);

-- ============================================================
-- ÍNDICES
-- ============================================================

create index idx_ingredients_business on ingredients(business_id);
create index idx_recipes_business on recipes(business_id);
create index idx_recipes_trash_business on recipes_trash(business_id);
create index idx_inventory_items_business on inventory_items(business_id);
create index idx_inventory_snapshots_business on inventory_snapshots(business_id);
create index idx_menus_business on menus(business_id);
create index idx_purchase_orders_business on purchase_orders(business_id);
create index idx_business_members_user on business_members(user_id);

-- ============================================================
-- ROW LEVEL SECURITY — idéntico a 0001, solo con el tipo de parámetro de las
-- funciones security definer actualizado de uuid a text.
-- ============================================================

alter table businesses enable row level security;
alter table business_members enable row level security;
alter table business_invites enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipes_trash enable row level security;
alter table inventory_items enable row level security;
alter table inventory_snapshots enable row level security;
alter table menus enable row level security;
alter table purchase_orders enable row level security;

create or replace function public.is_business_member(target_business_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from business_members
    where business_members.business_id = target_business_id
    and business_members.user_id = auth.uid()
  );
$$;

create or replace function public.is_business_owner(target_business_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from businesses
    where businesses.id = target_business_id
    and businesses.owner_id = auth.uid()
  );
$$;

drop policy if exists "businesses_owner_all" on businesses;
create policy "businesses_owner_all" on businesses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "businesses_member_select" on businesses;
create policy "businesses_member_select" on businesses
  for select using (is_business_member(businesses.id));

drop policy if exists "business_members_owner_manage" on business_members;
create policy "business_members_owner_manage" on business_members
  for all using (is_business_owner(business_members.business_id))
  with check (is_business_owner(business_members.business_id));

drop policy if exists "business_members_self_select" on business_members;
create policy "business_members_self_select" on business_members
  for select using (user_id = auth.uid());

drop policy if exists "business_invites_owner_manage" on business_invites;
create policy "business_invites_owner_manage" on business_invites
  for all using (is_business_owner(business_invites.business_id))
  with check (is_business_owner(business_invites.business_id));

drop policy if exists "business_invites_authenticated_select" on business_invites;
create policy "business_invites_authenticated_select" on business_invites
  for select using (auth.role() = 'authenticated');

drop policy if exists "ingredients_owner_all" on ingredients;
create policy "ingredients_owner_all" on ingredients
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "ingredients_member_select" on ingredients;
create policy "ingredients_member_select" on ingredients
  for select using (is_business_member(ingredients.business_id));

drop policy if exists "recipes_owner_all" on recipes;
create policy "recipes_owner_all" on recipes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "recipes_member_select" on recipes;
create policy "recipes_member_select" on recipes
  for select using (is_business_member(recipes.business_id));

drop policy if exists "recipes_trash_owner_all" on recipes_trash;
create policy "recipes_trash_owner_all" on recipes_trash
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "inventory_items_owner_all" on inventory_items;
create policy "inventory_items_owner_all" on inventory_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "inventory_items_member_select" on inventory_items;
create policy "inventory_items_member_select" on inventory_items
  for select using (is_business_member(inventory_items.business_id));

drop policy if exists "inventory_snapshots_owner_all" on inventory_snapshots;
create policy "inventory_snapshots_owner_all" on inventory_snapshots
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "inventory_snapshots_member_select" on inventory_snapshots;
create policy "inventory_snapshots_member_select" on inventory_snapshots
  for select using (is_business_member(inventory_snapshots.business_id));

drop policy if exists "menus_owner_all" on menus;
create policy "menus_owner_all" on menus
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "menus_member_select" on menus;
create policy "menus_member_select" on menus
  for select using (is_business_member(menus.business_id));

drop policy if exists "purchase_orders_owner_all" on purchase_orders;
create policy "purchase_orders_owner_all" on purchase_orders
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "purchase_orders_member_select" on purchase_orders;
create policy "purchase_orders_member_select" on purchase_orders
  for select using (is_business_member(purchase_orders.business_id));
