-- GastroMetrics — esquema inicial de base de datos
-- Ver docs/12-guia-backend.md para el contexto completo y la justificación
-- de cada decisión. Cada tabla corresponde 1 a 1 a un `interface` que ya
-- existe en types/*.ts — no es un rediseño, es la migración directa de la
-- forma de los datos que ya vive en localStorage hoy.
--
-- Cómo aplicar: pegar este archivo completo en el SQL Editor de Supabase
-- (o `supabase db push` si se usa la CLI), en un proyecto nuevo. No se ha
-- corrido contra ningún proyecto real todavía — no hay uno creado (ver
-- docs/12, sección "Qué NO se tocó").

-- ============================================================
-- NEGOCIOS
-- ============================================================

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  type text,
  has_customized_costs boolean not null default false,
  expenses jsonb, -- BusinessExpenses: rent, utilities, operationalCosts, marketing, laborCosts, otherExpenses
  estimated_monthly_plates integer,
  net_profit_percentage numeric not null default 25,
  -- Método de costeo por defecto del negocio — ver types/business.ts PricingMethod.
  pricing_method text check (pricing_method in ('gastrometrics', 'food_cost')),
  target_food_cost_percent numeric,
  created_at timestamptz not null default now()
);

-- Multiusuario compartiendo una suscripción — plan ya confirmado por el
-- dueño del proyecto (ver CLAUDE.md): cada quien crea su propia cuenta, el
-- dueño del negocio invita por link.
create table if not exists business_members (
  business_id uuid references businesses(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member', -- chef | subchef | contabilidad | dueño, etc — abierto, ver docs/12
  invited_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

-- Invitaciones pendientes (token en el link) — se resuelven a una fila real
-- de business_members cuando la persona invitada acepta ya logueada, ver
-- lib/auth/supabase-auth.ts (inviteToBusiness / acceptBusinessInvite).
create table if not exists business_invites (
  token uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade not null,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

-- ============================================================
-- INGREDIENTES
-- ============================================================

create table if not exists ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade, -- null = espacio "main" del usuario
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null,
  unit text not null,
  pricing jsonb not null, -- IngredientPrice: purchasePrice, netContent, pricePerUnit, lastUpdated
  presentation text,
  supplier text,
  merma_customized boolean default false,
  merma_tipo text check (merma_tipo in ('unidad', 'porcentaje')),
  merma_value numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RECETAS
-- ============================================================

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  classification text not null,
  plate text,
  step text, -- paso de menú, ver types/recipe.ts recipeSteps
  servings integer not null default 1,
  yield_amount numeric not null default 0,
  yield_unit text not null default '',
  ingredients jsonb not null default '[]', -- array de RecipeIngredient
  procedure jsonb not null default '[]', -- array de strings
  observations jsonb not null default '[]', -- array de strings, ver docs/22 seccion 20
  total_cost numeric not null default 0,
  cost_per_serving numeric not null default 0,
  unit_price numeric, -- precio final ya resuelto (sugerido o editado a mano, ver docs/22 seccion 17)
  custom_unit_price numeric, -- override manual del usuario, si existe
  custom_unit_profit numeric,
  pricing_config jsonb, -- publicServices, marketing, operationalCosts, laborCosts, isv, netProfit
  pricing_method text check (pricing_method in ('gastrometrics', 'food_cost')), -- override de esta receta, si existe
  target_food_cost_percent numeric,
  is_sub_recipe boolean not null default false,
  metadata jsonb not null default '{}', -- version, createdAt, updatedAt (legado, se duplica con las columnas de abajo)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Papelera de recetas — 30 días antes de purga automática (regla ya
-- confirmada, ver CLAUDE.md). La purga real es un cron job de Supabase o
-- Edge Function contra `deleted_at < now() - interval '30 days'` — hoy esa
-- lógica corre en el cliente (ver getTrashDaysRemaining/purgeExpiredTrash en
-- lib/storage/recipes.ts), ahí queda documentada como referencia de la regla.
create table if not exists recipes_trash (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  business_id uuid references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  recipe_data jsonb not null, -- snapshot completo de la receta al momento de borrar
  deleted_at timestamptz not null default now()
);

-- ============================================================
-- INVENTARIO
-- ============================================================

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  category text not null,
  current_stock numeric,
  min_stock numeric not null default 0,
  unit text not null,
  price numeric not null default 0,
  status text not null default 'normal' check (status in ('normal', 'low', 'critical')),
  updated_at timestamptz not null default now()
);

create table if not exists inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('initial', 'final', 'purchase')),
  periodicity text, -- daily | weekly | monthly
  division text,
  notes text,
  inventory_mode text, -- metric | presentation
  modified_items integer,
  total_value numeric,
  items jsonb not null default '[]', -- array de InventorySnapshotItem
  date timestamptz not null default now()
);

-- ============================================================
-- MENÚS
-- ============================================================

create table if not exists menus (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  items jsonb not null default '[]', -- array de MenuItem (recipeId, section, priceOverride, etc.)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ÓRDENES DE COMPRA
-- ============================================================

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  number integer,
  provider text,
  status text default 'pending' check (status in ('pending', 'approved', 'ordered', 'received', 'cancelled')),
  recipes jsonb not null default '[]', -- array de {id, name, yield}
  items jsonb not null default '[]', -- array de PurchaseOrderItem
  total numeric not null default 0,
  date timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES — todo lo que se filtra por negocio en cada pantalla de la app
-- ============================================================

create index if not exists idx_ingredients_business on ingredients(business_id);
create index if not exists idx_recipes_business on recipes(business_id);
create index if not exists idx_recipes_trash_business on recipes_trash(business_id);
create index if not exists idx_inventory_items_business on inventory_items(business_id);
create index if not exists idx_inventory_snapshots_business on inventory_snapshots(business_id);
create index if not exists idx_menus_business on menus(business_id);
create index if not exists idx_purchase_orders_business on purchase_orders(business_id);
create index if not exists idx_business_members_user on business_members(user_id);

-- ============================================================
-- ROW LEVEL SECURITY — reemplaza el aislamiento manual por prefijo de
-- clave que hoy simula la app en localStorage (business_{id}_recipes, etc.)
-- con algo real: cada fila solo la puede ver/editar su dueño, o cualquier
-- persona en business_members para ese business_id (plan de multiusuario).
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

-- Todas las políticas van precedidas de `drop policy if exists` — Postgres no
-- tiene `create policy if not exists`, así que sin este guard el script entero
-- deja de ser re-corrible: una segunda ejecución (por ejemplo, después de que
-- una ejecución anterior fallara a medias en otra sentencia) revienta en la
-- primera política con "already exists" aunque las tablas de arriba, que sí
-- usan `if not exists`, se salten sin problema. Con el guard, correr este
-- archivo completo de nuevo en cualquier momento es seguro.

-- BUG REAL CORREGIDO: "infinite recursion detected in policy for relation
-- businesses" (Postgres 42P17) al consultar `businesses`. Causa: la política
-- `businesses_member_select` consulta `business_members`, y la política
-- `business_members_owner_manage` consulta `businesses` de vuelta — evaluar
-- cualquiera de las dos obliga a evaluar la RLS de la otra, que a su vez
-- vuelve a evaluar la primera, sin fin. Cualquier política "_member_select"
-- de las demás tablas (ingredients, recipes, etc.) hereda el mismo problema
-- en cuanto su subconsulta a `business_members` dispara la RLS de esa tabla.
--
-- Arreglo estándar de Postgres/Supabase para este patrón: mover el chequeo a
-- una función `security definer` — al correr con los privilegios de quien la
-- define (el rol dueño de la migración, con permiso para saltarse RLS), su
-- consulta interna a la otra tabla NO vuelve a disparar las políticas de esa
-- tabla, así que el ciclo se rompe. `stable` porque el resultado no cambia
-- dentro de la misma consulta; `set search_path = public` evita que alguien
-- con permiso de crear objetos en otro esquema pueda secuestrar la función.
create or replace function public.is_business_member(target_business_id uuid)
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

create or replace function public.is_business_owner(target_business_id uuid)
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

-- businesses: el dueño ve/edita las suyas; cualquier miembro invitado las ve (no edita).
drop policy if exists "businesses_owner_all" on businesses;
create policy "businesses_owner_all" on businesses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "businesses_member_select" on businesses;
create policy "businesses_member_select" on businesses
  for select using (is_business_member(businesses.id));

-- business_members: el dueño del negocio administra la lista de miembros.
drop policy if exists "business_members_owner_manage" on business_members;
create policy "business_members_owner_manage" on business_members
  for all using (is_business_owner(business_members.business_id))
  with check (is_business_owner(business_members.business_id));

drop policy if exists "business_members_self_select" on business_members;
create policy "business_members_self_select" on business_members
  for select using (user_id = auth.uid());

-- business_invites: solo el dueño del negocio las crea/borra; cualquier
-- usuario autenticado puede leer una invitación puntual por su token (para
-- poder aceptarla) — el token en sí (uuid random) ya funciona como el secreto.
drop policy if exists "business_invites_owner_manage" on business_invites;
create policy "business_invites_owner_manage" on business_invites
  for all using (is_business_owner(business_invites.business_id))
  with check (is_business_owner(business_invites.business_id));

drop policy if exists "business_invites_authenticated_select" on business_invites;
create policy "business_invites_authenticated_select" on business_invites
  for select using (auth.role() = 'authenticated');

-- El resto de las tablas comparten exactamente el mismo patrón: el dueño de
-- la fila (owner_id), o cualquier miembro del negocio dueño de esa fila.
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
