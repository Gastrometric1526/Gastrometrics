-- GastroMetrics — corrige un hueco de seguridad real encontrado al verificar 0011 en
-- vivo con cuentas de prueba desechables (ver docs/62).
--
-- El bug: la condición "auth.uid() = owner_id" en la política "<tabla>_owner_all" de
-- cada tabla de negocio es cierta para CUALQUIER usuario autenticado que inserte una
-- fila con su propio uid como owner_id — sin importar de qué business_id se trate,
-- porque lib/storage/*.ts SIEMPRE graba owner_id = quien escribe (nunca el dueño real
-- del negocio). Existe desde 0005_ids_as_text.sql (antes de esta sesión) — nunca fue
-- explotable porque la interfaz nunca ofrecía ese camino. Con escritura real de equipo
-- ya activa (0011), se confirmó en vivo: una cuenta invitada solo a un negocio, solo
-- con el permiso "ingredients", igual pudo escribir una fila de "recipes" (sin permiso)
-- y escribir en un negocio distinto al invitado, porque bastaba con mandar owner_id =
-- su propio uid en cualquier insert, a cualquier business_id, vía la API REST directo
-- (no alcanzable desde la propia app, sí desde fuera de ella).
--
-- La corrección: esa mitad de la condición ahora exige ADEMÁS que business_id sea null
-- (el workspace "main" sin negocio real — el único caso legítimo donde depender solo
-- de owner_id tiene sentido, porque no hay fila de "businesses" contra la cual
-- verificar dueño real). Para cualquier fila con business_id real, la única forma de
-- pasar ahora es is_business_owner(business_id) (si eres el dueño real del negocio) o,
-- para miembros invitados, las políticas _member_write/_member_update/_member_delete
-- de 0011 (is_business_member + has_feature_access) — esas ya estaban bien, no cambian.
-- Re-corrible.

do $$
declare
  t text;
begin
  foreach t in array array[
    'ingredients', 'recipes', 'recipes_trash', 'inventory_items', 'inventory_snapshots',
    'menus', 'purchase_orders', 'sales_imports', 'pos_column_mappings', 'dish_name_mappings'
  ]
  loop
    execute format('drop policy if exists %I on %I', t || '_owner_all', t);
    execute format(
      'create policy %I on %I for all using ((%I.business_id is null and auth.uid() = owner_id) or is_business_owner(%I.business_id)) with check ((%I.business_id is null and auth.uid() = owner_id) or is_business_owner(%I.business_id))',
      t || '_owner_all', t, t, t, t, t
    );
  end loop;
end $$;
