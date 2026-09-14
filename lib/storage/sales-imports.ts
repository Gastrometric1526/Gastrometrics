/**
 * Importación de ventas del POS — migrado a Supabase real (ver docs/60 y el
 * comentario de cabecera de lib/storage/purchase-orders.ts para el patrón general:
 * caché reactiva por negocio, getXxx síncrono, saveXxx/addXxx/deleteXxx async).
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"
import type { SalesImport, POSColumnMapping, DishNameMapping } from "@/types/sales-import"

type SalesImportRow = Database["public"]["Tables"]["sales_imports"]["Row"]
type POSColumnMappingRow = Database["public"]["Tables"]["pos_column_mappings"]["Row"]
type DishNameMappingRow = Database["public"]["Tables"]["dish_name_mappings"]["Row"]

const importsCache = createBusinessScopedCache<SalesImport>()
const columnMappingCache = createBusinessScopedCache<POSColumnMapping>()
const dishMappingsCache = createBusinessScopedCache<DishNameMapping>()

function dbId(businessId?: string | null): string {
  return businessId || "main"
}
function toDbBusinessId(businessId?: string | null): string | null {
  return !businessId || businessId === "main" ? null : businessId
}

function rowToImport(row: SalesImportRow): SalesImport {
  return { ...(row.data as unknown as SalesImport), id: row.id }
}
function rowToMapping(row: POSColumnMappingRow): POSColumnMapping {
  const data = row.data as unknown as Partial<POSColumnMapping>
  // Compatibilidad con filas guardadas antes de que existiera el id/nombre de
  // plantilla (una sola plantilla por negocio, sin nombre): se les da un id y
  // nombre de reemplazo para que sigan funcionando como "la plantilla de antes",
  // en vez de romper al leerlas.
  return {
    id: data.id || row.id,
    name: data.name || "Mapeo guardado",
    businessId: data.businessId || "",
    dateColumn: data.dateColumn ?? null,
    dishColumn: data.dishColumn || "",
    quantityColumn: data.quantityColumn || "",
    priceColumn: data.priceColumn ?? null,
    dateFormat: data.dateFormat || "auto",
    updatedAt: data.updatedAt || new Date().toISOString(),
  }
}
function rowToDishMapping(row: DishNameMappingRow): DishNameMapping {
  return row.data as unknown as DishNameMapping
}

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ============== SALES IMPORTS ==============

async function fetchImports(businessId: string): Promise<SalesImport[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("sales_imports").select("*").order("created_at", { ascending: false })
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[SalesImports] Error cargando importaciones:", error)
    return []
  }
  return (data ?? []).map(rowToImport)
}

export function ensureSalesImportsLoaded(businessId?: string | null): Promise<void> {
  return importsCache.ensureLoaded(businessId, () => fetchImports(dbId(businessId)))
}

export function getSalesImports(businessId?: string | null): SalesImport[] {
  return importsCache.getSnapshot(businessId)
}

export async function addSalesImport(salesImport: SalesImport, businessId?: string | null): Promise<void> {
  const ownerId = await currentUserId()
  if (!ownerId) {
    console.error("[SalesImports] No hay sesión — no se pudo guardar en Supabase.")
    return
  }

  importsCache.mutateSnapshot(businessId, (list) => [salesImport, ...list])

  const supabase = getSupabaseBrowserClient()
  const { id, ...rest } = salesImport
  const { error } = await supabase
    .from("sales_imports")
    .insert({ id, business_id: toDbBusinessId(businessId), owner_id: ownerId, data: rest })
  if (error) console.error("[SalesImports] Error guardando la importación:", error)
}

export async function updateSalesImport(salesImport: SalesImport, businessId?: string | null): Promise<void> {
  importsCache.mutateSnapshot(businessId, (list) => list.map((i) => (i.id === salesImport.id ? salesImport : i)))

  const supabase = getSupabaseBrowserClient()
  const { id, ...rest } = salesImport
  const { error } = await supabase.from("sales_imports").update({ data: rest }).eq("id", id)
  if (error) console.error("[SalesImports] Error actualizando la importación:", error)
}

export async function deleteSalesImport(id: string, businessId?: string | null): Promise<void> {
  importsCache.mutateSnapshot(businessId, (list) => list.filter((i) => i.id !== id))

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("sales_imports").delete().eq("id", id)
  if (error) console.error("[SalesImports] Error eliminando la importación:", error)
}

// ============== MAPEO DE COLUMNAS DEL POS (varias plantillas por negocio) ==============
// Antes había una sola fila por negocio (id = businessId); ahora puede haber varias,
// una por plantilla con nombre, con id compuesto `${businessId}::${templateId}` —
// mismo patrón que ya usa dish_name_mappings más abajo. Una fila vieja de antes de
// este cambio (id = businessId a secas) se sigue leyendo bien: la filtra el índice
// por business_id, no la forma del id.

async function fetchColumnMappings(businessId: string): Promise<POSColumnMapping[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("pos_column_mappings").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[SalesImports] Error cargando las plantillas de mapeo:", error)
    return []
  }
  return (data ?? []).map(rowToMapping)
}

export function ensurePOSColumnMappingLoaded(businessId?: string | null): Promise<void> {
  return columnMappingCache.ensureLoaded(businessId, () => fetchColumnMappings(dbId(businessId)))
}

/** Todas las plantillas de mapeo guardadas para este negocio. */
export function getPOSColumnMappings(businessId?: string | null): POSColumnMapping[] {
  return columnMappingCache.getSnapshot(businessId)
}

export async function savePOSColumnMapping(mapping: POSColumnMapping, businessId?: string | null): Promise<void> {
  const ownerId = await currentUserId()
  if (!ownerId) {
    console.error("[SalesImports] No hay sesión — no se pudo guardar la plantilla en Supabase.")
    return
  }

  columnMappingCache.mutateSnapshot(businessId, (list) => [...list.filter((m) => m.id !== mapping.id), mapping])

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("pos_column_mappings").upsert({
    id: `${dbId(businessId)}::${mapping.id}`,
    business_id: toDbBusinessId(businessId),
    owner_id: ownerId,
    updated_at: new Date().toISOString(),
    data: mapping as unknown as Record<string, unknown>,
  })
  if (error) console.error("[SalesImports] Error guardando la plantilla de mapeo:", error)
}

export async function deletePOSColumnMapping(id: string, businessId?: string | null): Promise<void> {
  columnMappingCache.mutateSnapshot(businessId, (list) => list.filter((m) => m.id !== id))

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("pos_column_mappings").delete().eq("id", `${dbId(businessId)}::${id}`)
  if (error) console.error("[SalesImports] Error eliminando la plantilla de mapeo:", error)
}

// ============== EMPAREJAMIENTO PLATO -> RECETA (lista por negocio) ==============

async function fetchDishMappings(businessId: string): Promise<DishNameMapping[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("dish_name_mappings").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[SalesImports] Error cargando emparejamientos de plato:", error)
    return []
  }
  return (data ?? []).map(rowToDishMapping)
}

export function ensureDishNameMappingsLoaded(businessId?: string | null): Promise<void> {
  return dishMappingsCache.ensureLoaded(businessId, () => fetchDishMappings(dbId(businessId)))
}

export function getDishNameMappings(businessId?: string | null): DishNameMapping[] {
  return dishMappingsCache.getSnapshot(businessId)
}

export async function saveDishNameMapping(mapping: DishNameMapping, businessId?: string | null): Promise<void> {
  const ownerId = await currentUserId()
  if (!ownerId) {
    console.error("[SalesImports] No hay sesión — no se pudo guardar el emparejamiento en Supabase.")
    return
  }

  dishMappingsCache.mutateSnapshot(businessId, (list) => [
    ...list.filter((m) => m.normalizedPosName !== mapping.normalizedPosName),
    mapping,
  ])

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("dish_name_mappings").upsert({
    id: `${dbId(businessId)}::${mapping.normalizedPosName}`,
    business_id: toDbBusinessId(businessId),
    owner_id: ownerId,
    updated_at: new Date().toISOString(),
    data: mapping as unknown as Record<string, unknown>,
  })
  if (error) console.error("[SalesImports] Error guardando el emparejamiento de plato:", error)
}
