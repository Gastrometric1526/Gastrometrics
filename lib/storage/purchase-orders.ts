/**
 * Purchase Orders Storage Module
 * Unified storage management for purchase orders
 */

import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"
import type { PurchaseOrder } from "@/types/purchase-order"

/**
 * Get all purchase orders for a business
 */
export function getPurchaseOrders(businessId: string): PurchaseOrder[] {
  return getFromStorage<PurchaseOrder[]>(STORAGE_KEYS.PURCHASE_ORDERS, businessId) || []
}

/**
 * Save purchase orders for a business
 */
export function savePurchaseOrders(businessId: string, orders: PurchaseOrder[]): void {
  saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, orders, businessId)

  // Dispatch event for reactivity
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("purchaseOrdersUpdated", {
        detail: { businessId, count: orders.length },
      }),
    )
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
export function addPurchaseOrder(businessId: string, order: PurchaseOrder): void {
  const orders = getPurchaseOrders(businessId)
  orders.push(order)
  savePurchaseOrders(businessId, orders)
}

/**
 * Update an existing purchase order
 */
export function updatePurchaseOrder(businessId: string, orderId: string, updatedOrder: PurchaseOrder): void {
  const orders = getPurchaseOrders(businessId)
  const index = orders.findIndex((order) => order.id === orderId)

  if (index !== -1) {
    orders[index] = updatedOrder
    savePurchaseOrders(businessId, orders)
  }
}

/**
 * Delete a purchase order
 */
export function deletePurchaseOrder(businessId: string, orderId: string): void {
  const orders = getPurchaseOrders(businessId)
  const filteredOrders = orders.filter((order) => order.id !== orderId)
  savePurchaseOrders(businessId, filteredOrders)
}

/**
 * Duplicate a purchase order
 */
export function duplicatePurchaseOrder(businessId: string, orderId: string): PurchaseOrder | null {
  const order = getPurchaseOrder(businessId, orderId)

  if (!order) return null

  const newOrder: PurchaseOrder = {
    ...order,
    id: `OC-${Date.now()}`,
    date: new Date().toISOString().split("T")[0],
    number: Date.now(),
  }

  addPurchaseOrder(businessId, newOrder)
  return newOrder
}
