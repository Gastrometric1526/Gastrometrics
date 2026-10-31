-- docs/216 — Ventas: una persona del equipo con «Registro manual de ventas» o «Facturación»
-- puede guardar ventas.
--
-- Hasta ahora (0011_team_write_access.sql) escribir en sales_imports exigía la función
-- 'stats_finance'. Pero el registro manual (manual_sales) y las facturas (invoices, que
-- guardan su venta en sales_imports) son permisos aparte en /equipo. Resultado: a alguien
-- con solo «Registro manual de ventas» o solo «Facturación» la pantalla lo dejaba entrar y
-- la base le rechazaba el guardado.
--
-- Ahora basta cualquiera de las tres. Las plantillas del POS (pos_column_mappings,
-- dish_name_mappings) siguen exigiendo 'stats_finance', igual que antes.
-- Idempotente: se puede correr más de una vez.

drop policy if exists "sales_imports_member_write" on public.sales_imports;
create policy "sales_imports_member_write" on public.sales_imports
  for insert with check (
    is_business_member(sales_imports.business_id)
    and (
      has_feature_access(sales_imports.business_id, 'stats_finance')
      or has_feature_access(sales_imports.business_id, 'manual_sales')
      or has_feature_access(sales_imports.business_id, 'invoices')
    )
  );

drop policy if exists "sales_imports_member_update" on public.sales_imports;
create policy "sales_imports_member_update" on public.sales_imports
  for update
  using (
    is_business_member(sales_imports.business_id)
    and (
      has_feature_access(sales_imports.business_id, 'stats_finance')
      or has_feature_access(sales_imports.business_id, 'manual_sales')
      or has_feature_access(sales_imports.business_id, 'invoices')
    )
  )
  with check (
    is_business_member(sales_imports.business_id)
    and (
      has_feature_access(sales_imports.business_id, 'stats_finance')
      or has_feature_access(sales_imports.business_id, 'manual_sales')
      or has_feature_access(sales_imports.business_id, 'invoices')
    )
  );

drop policy if exists "sales_imports_member_delete" on public.sales_imports;
create policy "sales_imports_member_delete" on public.sales_imports
  for delete using (
    is_business_member(sales_imports.business_id)
    and (
      has_feature_access(sales_imports.business_id, 'stats_finance')
      or has_feature_access(sales_imports.business_id, 'manual_sales')
      or has_feature_access(sales_imports.business_id, 'invoices')
    )
  );
