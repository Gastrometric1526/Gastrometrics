-- GastroMetrics — cierra el hueco de "merma" dejado explícitamente abierto en
-- 0011_team_write_access.sql (ver su comentario de cabecera, punto "Lo que sigue sin
-- cubrir, a propósito"): el permiso allowedFeatures.merma de un miembro de equipo solo
-- se aplicaba en la interfaz (botón "Gestionar Mermas" de app/ingredientes/page.tsx,
-- gateado por hasFeatureAccess("merma")) — nada del lado del servidor lo hacía
-- cumplir. Confirmado: la única lógica real de merma vive en
-- components/merma-management-dialog.tsx, que sobreescribe directamente
-- ingredient.pricing.pricePerUnit/netContent (y guarda el original en
-- ingredient.originalNetContent) llamando a saveIngredients() de
-- lib/storage/ingredients.ts — el mismo camino de escritura que cualquier otro edit
-- de ingrediente, vía supabase.from("ingredients").upsert(...) desde el navegador. Un
-- miembro con el permiso "ingredients" (necesario para poder editar ingredientes en
-- absoluto) pero SIN "merma" podía llamar ese mismo upsert directo —sin pasar por el
-- botón bloqueado— y modificar la merma igual.
--
-- Por qué esto no se resuelve con una política RLS normal (como sí se hizo en 0011
-- para el resto de las herramientas): "merma" no es su propia tabla ni su propia
-- columna, vive dentro del jsonb "data" de cada fila de ingredients, junto con
-- decenas de otros campos (nombre, categoría, unidad, precio de compra, proveedor,
-- notas...) que un miembro con "ingredients" sí debe poder seguir editando
-- libremente. Una política RLS con "using"/"with check" no puede comparar el valor
-- ANTERIOR de un campo dentro de un jsonb contra el NUEVO fila por fila — solo un
-- trigger tiene acceso a OLD y NEW al mismo tiempo. Por eso este archivo agrega un
-- trigger BEFORE INSERT/UPDATE en vez de una policy.
--
-- Qué se restringe exactamente, y qué no: el trigger deja pasar sin tocar nada
-- cualquier escritura que no cambie el sub-objeto data->'merma' ni
-- data->>'originalNetContent' (los dos únicos campos que components/merma-management-
-- dialog.tsx escribe, y que ningún otro flujo del código escribe jamás — verificado:
-- ingredients-table.tsx y app/ingredientes/page.tsx solo LEEN ingredient.merma para
-- mostrar el indicador/badge). Esto es a propósito: pricing.pricePerUnit y
-- pricing.netContent por sí solos SÍ cambian en flujos legítimos ajenos a merma
-- (edición normal de precio de compra, recepción de orden de compra, inventario) que
-- cualquier miembro con "ingredients"/"inventory"/"purchase_orders" ya puede hacer
-- hoy sin necesitar "merma" — bloquear cualquier cambio a esos dos campos habría roto
-- esas pantallas para miembros reales. Solo se bloquea cuando además cambia el
-- objeto merma (o el respaldo originalNetContent que solo usa ese diálogo), que es la
-- huella inequívoca de una escritura de merma.
--
-- A quién aplica: solo a un miembro invitado real de un negocio real
-- (is_business_member(business_id) y NOT is_business_owner(business_id)) sin
-- has_feature_access(business_id, 'merma') — igual que el resto de 0011. El dueño del
-- negocio (dueño real o el workspace "main" sin negocio, business_id null) nunca se ve
-- afectado, exactamente igual que las demás políticas de escritura de equipo.
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

create or replace function public.check_merma_write_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_data jsonb;
  merma_changed boolean;
begin
  -- Workspace "main" sin negocio real: no hay equipo posible aquí, nada que revisar.
  if new.business_id is null then
    return new;
  end if;

  -- El dueño real del negocio nunca está restringido.
  if is_business_owner(new.business_id) then
    return new;
  end if;

  -- No es ni dueño ni miembro invitado de este negocio: no es asunto de este trigger,
  -- las políticas RLS normales ya deciden si la fila pasa o no.
  if not is_business_member(new.business_id) then
    return new;
  end if;

  -- Miembro invitado con el permiso "merma" habilitado: sin restricción.
  if has_feature_access(new.business_id, 'merma') then
    return new;
  end if;

  old_data := case when TG_OP = 'UPDATE' then old.data else '{}'::jsonb end;

  merma_changed :=
    (old_data -> 'merma') is distinct from (new.data -> 'merma')
    or (old_data ->> 'originalNetContent') is distinct from (new.data ->> 'originalNetContent');

  if merma_changed then
    raise exception 'No tienes permiso para modificar la merma de este ingrediente.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_merma_write_access on ingredients;
create trigger trg_check_merma_write_access
  before insert or update on ingredients
  for each row execute function check_merma_write_access();
