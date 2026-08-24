/**
 * INVENTORY STORAGE MODULE — migrado a Supabase real (ver docs/52 y el comentario de
 * cabecera de lib/storage/businesses.ts para el patrón general).
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"

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

  const updated: InventoryItem = { ...current, ...updates, lastUpdated: new Date().toLocaleDateString() }
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
    totalValue: inventory.reduce((sum, item) => sum + (item.currentStock || 0) * (item.price || 0), 0),
  }
}

/**
 * Update inventory status based on stock levels
 */
export function updateInventoryStatus(items: InventoryItem[]): InventoryItem[] {
  return items.map((item) => {
    if (item.currentStock === null) {
      return { ...item, status: "normal" }
    }

    if (item.currentStock <= item.minStock) {
      return { ...item, status: "critical" }
    } else if (item.currentStock <= item.minStock * 2) {
      return { ...item, status: "low" }
    } else {
      return { ...item, status: "normal" }
    }
  })
}
