/**
 * Purchase Orders Storage Module — migrado a Supabase real (ver docs/52 y el
 * comentario de cabecera de lib/storage/businesses.ts para el patrón general).
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"
import type { PurchaseOrder } from "@/types/purchase-order"

type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"]

const cache = createBusinessScopedCache<PurchaseOrder>()

function toDbBusinessId(businessId?: string | null): string | null {
  return !businessId || businessId === "main" ? null : businessId
}

function rowToOrder(row: PurchaseOrderRow): PurchaseOrder {
  return { ...(row.data as unknown as PurchaseOrder), id: row.id }
}

async function fetchOrders(businessId: string): Promise<PurchaseOrder[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("purchase_orders").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[PurchaseOrders] Error cargando órdenes de compra:", error)
    return []
  }
  return (data ?? []).map(rowToOrder)
}

/** Hook reactivo — usar en vez de getPurchaseOrders(businessId) dentro de useMemo. */
export function usePurchaseOrders(businessId: string): PurchaseOrder[] {
  return cache.useCached(businessId, () => fetchOrders(businessId))
}

export function ensurePurchaseOrdersLoaded(businessId: string): Promise<void> {
  return cache.ensureLoaded(businessId, () => fetchOrders(businessId))
}

/**
 * Get all purchase orders for a business (síncrono — lee la caché en memoria).
 */
export function getPurchaseOrders(businessId: string): PurchaseOrder[] {
  return cache.getSnapshot(businessId)
}

/**
 * Save purchase orders for a business
 */
export async function savePurchaseOrders(businessId: string, orders: PurchaseOrder[]): Promise<void> {
  const previous = cache.getSnapshot(businessId)
  const nextIds = new Set(orders.map((o) => o.id))
  const removedIds = previous.filter((o) => !nextIds.has(o.id)).map((o) => o.id)

  cache.setSnapshot(businessId, orders)

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[PurchaseOrders] No hay sesión — no se pudo guardar en Supabase.")
    return
  }

  const dbBusinessId = toDbBusinessId(businessId)
  const rows = orders.map((order) => {
    const { id, ...rest } = order
    return { id, business_id: dbBusinessId, owner_id: user.id, data: rest }
  })

  if (rows.length > 0) {
    const { error } = await supabase.from("purchase_orders").upsert(rows)
    if (error) console.error("[PurchaseOrders] Error guardando órdenes:", error)
  }
  if (removedIds.length > 0) {
    const { error } = await supabase.from("purchase_orders").delete().in("id", removedIds)
    if (error) console.error("[PurchaseOrders] Error eliminando órdenes:", error)
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("purchaseOrdersUpdated", { detail: { businessId, count: orders.length } }))
  }
}

/**
 * Get a single purchase order by ID
 */
export function getPurchaseOrder(businessId: string, orderId: string): PurchaseOrder | null {
  const orders = getPurchaseOrders(businessId)
  return orders.find((order) => order.id === orderId) || null
}

/**
 * Add a new purchase order
 */
export async function addPurchaseOrder(businessId: string, order: PurchaseOrder): Promise<void> {
  const orders = getPurchaseOrders(businessId)
  await savePurchaseOrders(businessId, [...orders, order])
}

/**
 * Update an existing purchase order
 */
export async function updatePurchaseOrder(
  businessId: string,
  orderId: string,
  updatedOrder: PurchaseOrder,
): Promise<void> {
  const orders = getPurchaseOrders(businessId)
  const index = orders.findIndex((order) => order.id === orderId)
  if (index === -1) return
  const next = [...orders]
  next[index] = updatedOrder
  await savePurchaseOrders(businessId, next)
}

/**
 * Delete a purchase order
 */
export async function deletePurchaseOrder(businessId: string, orderId: string): Promise<void> {
  const orders = getPurchaseOrders(businessId)
  await savePurchaseOrders(businessId, orders.filter((order) => order.id !== orderId))
}

/**
 * Duplicate a purchase order
 */
export async function duplicatePurchaseOrder(businessId: string, orderId: string): Promise<PurchaseOrder | null> {
  const order = getPurchaseOrder(businessId, orderId)
  if (!order) return null

  const newOrder: PurchaseOrder = {
    ...order,
    id: `OC-${Date.now()}`,
    date: new Date().toISOString().split("T")[0],
    number: Date.now(),
  }

  await addPurchaseOrder(businessId, newOrder)
  return newOrder
}
