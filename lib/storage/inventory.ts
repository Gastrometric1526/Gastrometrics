/**
 * INVENTORY STORAGE MODULE — migrado a Supabase real (ver docs/52 y el comentario de
 * cabecera de lib/storage/businesses.ts para el patrón general).
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import { getIngredients } from "./ingredients"
import { buildPackageContentLookup, inventoryTotalValue } from "@/lib/inventory-value"
import { stockStatus } from "@/lib/inventory-status"

type InventoryItemRow = Database["public"]["Tables"]["inventory_items"]["Row"]
type InventorySnapshotRow = Database["public"]["Tables"]["inventory_snapshots"]["Row"]

const itemsCache = createBusinessScopedCache<InventoryItem>()
const historyCache = createBusinessScopedCache<InventorySnapshot>()

function toDbBusinessId(businessId?: string | null): string | null {
  return !businessId || businessId === "main" ? null : businessId
}

function rowToItem(row: InventoryItemRow): InventoryItem {
  return { ...(row.data as unknown as InventoryItem), id: row.id }
}

function rowToSnapshot(row: InventorySnapshotRow): InventorySnapshot {
  return { ...(row.data as unknown as InventorySnapshot), id: row.id, date: row.date }
}

async function fetchInventory(businessId?: string | null): Promise<InventoryItem[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("inventory_items").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[Inventory] Error cargando inventario:", error)
    return []
  }
  return (data ?? []).map(rowToItem)
}

async function fetchHistory(businessId?: string | null): Promise<InventorySnapshot[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("inventory_snapshots").select("*").order("date", { ascending: false })
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[Inventory] Error cargando historial:", error)
    return []
  }
  return (data ?? []).map(rowToSnapshot)
}

/** Hook reactivo — usar en vez de getInventory(businessId) dentro de useMemo. */
export function useInventory(businessId?: string | null): InventoryItem[] {
  return itemsCache.useCached(businessId, () => fetchInventory(businessId))
}

/** Hook reactivo para el historial de inventario. */
export function useInventoryHistory(businessId?: string | null): InventorySnapshot[] {
  return historyCache.useCached(businessId, () => fetchHistory(businessId))
}

export function ensureInventoryLoaded(businessId?: string | null): Promise<void> {
  return itemsCache.ensureLoaded(businessId, () => fetchInventory(businessId))
}

export function ensureInventoryHistoryLoaded(businessId?: string | null): Promise<void> {
  return historyCache.ensureLoaded(businessId, () => fetchHistory(businessId))
}

/**
 * Get all inventory items for a business (síncrono — lee la caché en memoria).
 */
export function getInventory(businessId?: string | null): InventoryItem[] {
  return itemsCache.getSnapshot(businessId)
}

/**
 * Save inventory items — recibe el array completo, sincroniza contra Supabase
 * (upsert + delete de lo removido), y actualiza la caché al instante.
 */
export async function saveInventory(items: InventoryItem[], businessId?: string | null): Promise<void> {
  const previous = itemsCache.getSnapshot(businessId)
  const nextIds = new Set(items.map((i) => i.id))
  const removedIds = previous.filter((i) => !nextIds.has(i.id)).map((i) => i.id)

  itemsCache.setSnapshot(businessId, items)

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[Inventory] No hay sesión — no se pudo guardar en Supabase.")
    return
  }

  const dbBusinessId = toDbBusinessId(businessId)
  const rows = items.map((item) => ({
    id: item.id,
    business_id: dbBusinessId,
    owner_id: user.id,
    data: item as unknown as Record<string, unknown>,
  }))

  if (rows.length > 0) {
    const { error } = await supabase.from("inventory_items").upsert(rows)
    if (error) console.error("[Inventory] Error guardando inventario:", error)
  }
  if (removedIds.length > 0) {
    const { error } = await supabase.from("inventory_items").delete().in("id", removedIds)
    if (error) console.error("[Inventory] Error eliminando ítems de inventario:", error)
  }
  console.log(`[Storage] Saved ${items.length} inventory items`)
}

/**
 * Add a new inventory item
 */
export async function addInventoryItem(item: InventoryItem, businessId?: string | null): Promise<InventoryItem> {
  itemsCache.mutateSnapshot(businessId, (list) => [...list, item])

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Debes iniciar sesión.")

  const { error } = await supabase
    .from("inventory_items")
    .insert({
      id: item.id,
      business_id: toDbBusinessId(businessId),
      owner_id: user.id,
      data: item as unknown as Record<string, unknown>,
    })
  if (error) throw error
  return item
}

/**
 * Update an inventory item
 */
export async function updateInventoryItem(
  id: string,
  updates: Partial<InventoryItem>,
  businessId?: string | null,
): Promise<InventoryItem | null> {
  const inventory = getInventory(businessId)
  const current = inventory.find((item) => item.id === id)
  if (!current) return null

  const updated: InventoryItem = { ...current, ...updates, lastUpdated: new Date().toISOString() }
  itemsCache.mutateSnapshot(businessId, (list) => list.map((item) => (item.id === id ? updated : item)))

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase
    .from("inventory_items")
    .update({ data: updated as unknown as Record<string, unknown> })
    .eq("id", id)
  if (error) {
    console.error("[Inventory] Error actualizando ítem:", error)
    return null
  }
  return updated
}

/**
 * Delete an inventory item
 */
export async function deleteInventoryItem(id: string, businessId?: string | null): Promise<boolean> {
  const inventory = getInventory(businessId)
  if (!inventory.some((item) => item.id === id)) return false

  itemsCache.mutateSnapshot(businessId, (list) => list.filter((item) => item.id !== id))

  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("inventory_items").delete().eq("id", id)
  if (error) {
    console.error("[Inventory] Error eliminando ítem:", error)
    return false
  }
  return true
}

/**
 * Get inventory history (snapshots) — síncrono, lee la caché en memoria.
 */
export function getInventoryHistory(businessId?: string | null): InventorySnapshot[] {
  return historyCache.getSnapshot(businessId)
}

/**
 * Save inventory history — reemplaza el historial completo (poco común, usualmente se
 * usa addInventorySnapshot para agregar uno nuevo).
 */
export async function saveInventoryHistory(history: InventorySnapshot[], businessId?: string | null): Promise<void> {
  const previous = historyCache.getSnapshot(businessId)
  const nextIds = new Set(history.map((h) => h.id))
  const removedIds = previous.filter((h) => !nextIds.has(h.id)).map((h) => h.id)

  historyCache.setSnapshot(businessId, history)

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[Inventory] No hay sesión — no se pudo guardar el historial.")
    return
  }

  const dbBusinessId = toDbBusinessId(businessId)
  const rows = history.map((snapshot) => {
    const { id, date, ...rest } = snapshot
    return { id, business_id: dbBusinessId, owner_id: user.id, date, data: rest }
  })

  if (rows.length > 0) {
    const { error } = await supabase.from("inventory_snapshots").upsert(rows)
    if (error) console.error("[Inventory] Error guardando historial:", error)
  }
  if (removedIds.length > 0) {
    const { error } = await supabase.from("inventory_snapshots").delete().in("id", removedIds)
    if (error) console.error("[Inventory] Error eliminando snapshots:", error)
  }
  console.log(`[Storage] Saved ${history.length} inventory snapshots`)
}

/**
 * Add a new inventory snapshot to history
 */
export async function addInventorySnapshot(snapshot: InventorySnapshot, businessId?: string | null): Promise<void> {
  historyCache.mutateSnapshot(businessId, (list) => [snapshot, ...list])

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[Inventory] No hay sesión — no se pudo guardar el snapshot.")
    return
  }

  const { id, date, ...rest } = snapshot
  const { error } = await supabase
    .from("inventory_snapshots")
    .insert({ id, business_id: toDbBusinessId(businessId), owner_id: user.id, date, data: rest })
  if (error) console.error("[Inventory] Error guardando snapshot:", error)
}

/**
 * Get inventory statistics
 */
export function getInventoryStats(businessId?: string | null): {
  totalItems: number
  criticalItems: number
  lowItems: number
  totalValue: number
} {
  const inventory = getInventory(businessId)

  return {
    totalItems: inventory.length,
    criticalItems: inventory.filter((item) => item.status === "critical").length,
    lowItems: inventory.filter((item) => item.status === "low").length,
    // Precio del envase ÷ su contenido, no stock × precio (lib/inventory-value.ts, docs/136).
    totalValue: inventoryTotalValue(inventory, buildPackageContentLookup(getIngredients(businessId))),
  }
}

/**
 * Update inventory status based on stock levels
 */
export function updateInventoryStatus(items: InventoryItem[]): InventoryItem[] {
  return items.map((item) => {
    return { ...item, status: stockStatus(item.currentStock, item.minStock) }
  })
}

/**
 * Suma stock real a los ítems de inventario que coincidan por nombre con cada línea de
 * una orden de compra al marcarla como "recibida" (ver components/purchase-order-page.tsx,
 * docs/119) — antes, marcar una orden como recibida no tocaba el inventario en absoluto,
 * dos módulos que deberían estar conectados quedaban aislados. Mismo criterio de
 * coincidencia por nombre exacto que ya usa app/inventario/page.tsx para vincular
 * inventario con el catálogo de ingredientes (no hay un id de ingrediente confiable
 * persistido en la orden — ver comentario en purchase-order-page.tsx).
 */
export async function receivePurchaseOrderIntoInventory(
  items: { ingredientId?: string; name: string; quantity: number }[],
  businessId?: string | null,
): Promise<{ matchedCount: number; unmatchedNames: string[] }> {
  const inventory = getInventory(businessId)
  const norm = (s: string) => s.trim().toLowerCase()

  // Se empareja primero por id de ingrediente (docs/190) y si no, por nombre sin
  // distinguir mayúsculas ni espacios. Suma cantidades si la orden repite el ingrediente.
  const totals = new Map<string, { item: InventoryItem | undefined; name: string; quantity: number }>()
  for (const line of items) {
    if (!line.name || !line.quantity) continue
    const item =
      (line.ingredientId ? inventory.find((inv) => inv.id === line.ingredientId) : undefined) ??
      inventory.find((inv) => norm(inv.name) === norm(line.name))
    const key = item ? `id:${item.id}` : `name:${norm(line.name)}`
    const prev = totals.get(key)
    totals.set(key, { item, name: line.name, quantity: (prev?.quantity || 0) + line.quantity })
  }

  let matchedCount = 0
  const unmatchedNames: string[] = []

  for (const { item: match, name, quantity } of totals.values()) {
    if (!match) {
      unmatchedNames.push(name)
      continue
    }
    const newStock = (match.currentStock ?? 0) + quantity
    // Mismos umbrales que updateInventoryStatus() de arriba — se recalcula acá porque
    // status es un campo guardado, no derivado al leer.
    const newStatus: InventoryItem["status"] =
      stockStatus(newStock, match.minStock)
    const receipts = [...(match.stockReceipts ?? []), { quantity, at: new Date().toISOString() }]
    await updateInventoryItem(match.id, { currentStock: newStock, status: newStatus, stockReceipts: receipts }, businessId)
    matchedCount++
  }

  return { matchedCount, unmatchedNames }
}
