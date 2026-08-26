-- GastroMetrics — Equipo: escritura real por miembro, filtrada por función asignada.
-- Continúa 0010_team_real.sql (que dio acceso real de LECTURA vía is_business_member,
-- pero explícitamente dejó fuera escritura y filtrado por allowed_features/pdf_access
-- "por el riesgo de diseñarlas mal y abrir un hueco de seguridad real"). Ver docs/62.
--
-- Alcance real de este cambio:
--   - Un miembro invitado ahora puede insertar/editar/borrar en las tablas de negocio
--     (ingredients, recipes, inventory_items, inventory_snapshots, menus,
--     purchase_orders, sales_imports, pos_column_mappings, dish_name_mappings) SOLO si
--     el negocio está en su business_members (ya existía) Y la función correspondiente
--     está en su allowed_features (team_members.allowed_features) — nueva función
--     has_feature_access(business_id, feature_key) hace ambas verificaciones.
--   - Se corrige de paso un bug que esto habría activado en silencio: cada
--     lib/storage/*.ts de escritura graba owner_id = quien escribe, no el dueño real
--     del negocio. Sin esto, filas escritas por un miembro quedarían invisibles para
--     el propio dueño (su política "_owner_all" solo igualaba auth.uid() = owner_id).
--     Se corrige agregando "or is_business_owner(business_id)" a esa misma política,
--     sin tocar ninguna fila existente ni ningún archivo .ts.
--   - Se agrega un trigger que propaga business_members automáticamente cuando el
--     dueño crea un negocio nuevo y ya tiene miembros con scope 'dashboard' (antes ese
--     negocio nuevo simplemente no aparecía para ellos).
--
-- Lo que sigue sin cubrir, a propósito (ver docs/62 para el porqué completo):
--   - pdf_access: no hay ninguna ruta /api de PDF — se genera 100% en el navegador con
--     los mismos datos que ya requiere el permiso "recipes"/"menus". No se puede
--     separar a nivel de base de datos sin partir el modelo de costos en otra tabla.
--     Sigue siendo un filtro solo de interfaz.
--   - merma: vive dentro del jsonb "data" de cada ingrediente, no en su propia fila —
--     RLS no puede restringir un campo específico dentro de una fila. Sigue siendo un
--     filtro solo de interfaz.
--   - recipes_trash: sigue exclusiva del dueño, sin cambios — es la papelera de
--     borrado permanente, no mapea a ningún feature de la interfaz.
--
-- Cómo aplicar: pegar completo en el SQL Editor de Supabase y correr. Re-corrible.

-- 1. Corrige el hueco de owner_id: el dueño real del negocio siempre puede
--    leer/editar/borrar, sin importar qué miembro haya escrito la fila.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ingredients', 'recipes', 'inventory_items', 'inventory_snapshots',
    'menus', 'purchase_orders', 'sales_imports', 'pos_column_mappings', 'dish_name_mappings'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_owner_all', t);
    execute format(
      'create policy %I on %I for all using (auth.uid() = owner_id or is_business_owner(%I.business_id)) with check (auth.uid() = owner_id or is_business_owner(%I.business_id))',
      t || '_owner_all', t, t, t
    );
  end loop;
end $$;

-- 2. Helper: ¿el usuario actual es miembro invitado con esta función habilitada,
--    para el negocio indicado? (mismo patrón security definer que is_business_member).
create or replace function public.has_feature_access(target_business_id text, feature_key text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from team_members tm
    join businesses b on b.id = target_business_id
    where tm.invited_user_id = auth.uid()
      and tm.owner_id = b.owner_id
      and tm.allowed_features @> to_jsonb(feature_key::text)
  );
$$;

-- 3. Políticas de escritura para miembros, una función requerida por tabla.
--    purchase_orders acepta cualquiera de las dos features de compras (igual que ya
--    agrupa app/dashboard/page.tsx en su hrefFeatureMap).
do $$
declare
  t text;
  feat text;
  check_expr text;
begin
  foreach t in array array[
    'ingredients', 'recipes', 'inventory_items', 'inventory_snapshots', 'menus',
    'sales_imports', 'pos_column_mappings', 'dish_name_mappings'
  ]
  loop
    feat := case t
      when 'ingredients' then 'ingredients'
      when 'recipes' then 'recipes'
      when 'inventory_items' then 'inventory'
      when 'inventory_snapshots' then 'inventory'
      when 'menus' then 'menus'
      when 'sales_imports' then 'stats_finance'
      when 'pos_column_mappings' then 'stats_finance'
      when 'dish_name_mappings' then 'stats_finance'
    end;

    check_expr := format('is_business_member(%I.business_id) and has_feature_access(%I.business_id, %L)', t, t, feat);

    execute format('drop policy if exists %I on %I', t || '_member_write', t);
    execute format('create policy %I on %I for insert with check (%s)', t || '_member_write', t, check_expr);

    execute format('drop policy if exists %I on %I', t || '_member_update', t);
    execute format('create policy %I on %I for update using (%s) with check (%s)', t || '_member_update', t, check_expr, check_expr);

    execute format('drop policy if exists %I on %I', t || '_member_delete', t);
    execute format('create policy %I on %I for delete using (%s)', t || '_member_delete', t, check_expr);
  end loop;
end $$;

-- purchase_orders aparte: acepta purchase_orders_manual O purchase_orders_auto.
drop policy if exists "purchase_orders_member_write" on purchase_orders;
create policy "purchase_orders_member_write" on purchase_orders
  for insert with check (
    is_business_member(purchase_orders.business_id)
    and (
      has_feature_access(purchase_orders.business_id, 'purchase_orders_manual')
      or has_feature_access(purchase_orders.business_id, 'purchase_orders_auto')
    )
  );

drop policy if exists "purchase_orders_member_update" on purchase_orders;
create policy "purchase_orders_member_update" on purchase_orders
  for update
  using (
    is_business_member(purchase_orders.business_id)
    and (
      has_feature_access(purchase_orders.business_id, 'purchase_orders_manual')
      or has_feature_access(purchase_orders.business_id, 'purchase_orders_auto')
    )
  )
  with check (
    is_business_member(purchase_orders.business_id)
    and (
      has_feature_access(purchase_orders.business_id, 'purchase_orders_manual')
      or has_feature_access(purchase_orders.business_id, 'purchase_orders_auto')
    )
  );

drop policy if exists "purchase_orders_member_delete" on purchase_orders;
create policy "purchase_orders_member_delete" on purchase_orders
  for delete using (
    is_business_member(purchase_orders.business_id)
    and (
      has_feature_access(purchase_orders.business_id, 'purchase_orders_manual')
      or has_feature_access(purchase_orders.business_id, 'purchase_orders_auto')
    )
  );

-- 4. Propaga business_members a miembros con scope 'dashboard' cuando el dueño crea
--    un negocio nuevo — hoy no existía ningún trigger para esto, así que un negocio
--    creado después de invitar a alguien con "todos los negocios" nunca le aparecía.
create or replace function public.grant_dashboard_members_on_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into business_members (business_id, user_id, role)
  select new.id, tm.invited_user_id, 'member'
  from team_members tm
  where tm.owner_id = new.owner_id
    and tm.scope = 'dashboard'
    and tm.invited_user_id is not null
  on conflict (business_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_grant_dashboard_members_on_new_business on businesses;
create trigger trg_grant_dashboard_members_on_new_business
  after insert on businesses
  for each row execute function grant_dashboard_members_on_new_business();
