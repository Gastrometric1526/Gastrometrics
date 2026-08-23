/**
 * INVENTORY STORAGE MODULE
 * Unified storage functions for inventory management
 */

import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"

/**
 * Get all inventory items for a business
 */
export function getInventory(businessId?: string | null): InventoryItem[] {
  return getFromStorage<InventoryItem[]>(STORAGE_KEYS.INVENTORY, businessId) || []
}

/**
 * Save inventory items
 */
export function saveInventory(items: InventoryItem[], businessId?: string | null): void {
  saveToStorage(STORAGE_KEYS.INVENTORY, items, businessId)
  console.log(`[Storage] Saved ${items.length} inventory items`)
}

/**
 * Add a new inventory item
 */
export function addInventoryItem(item: InventoryItem, businessId?: string | null): InventoryItem {
  const inventory = getInventory(businessId)
  inventory.push(item)
  saveInventory(inventory, businessId)
  return item
}

/**
 * Update an inventory item
 */
export function updateInventoryItem(
  id: string,
  updates: Partial<InventoryItem>,
  businessId?: string | null,
): InventoryItem | null {
  const inventory = getInventory(businessId)
  const index = inventory.findIndex((item) => item.id === id)

  if (index === -1) return null

  inventory[index] = { ...inventory[index], ...updates, lastUpdated: new Date().toLocaleDateString() }
  saveInventory(inventory, businessId)

  return inventory[index]
}

/**
 * Delete an inventory item
 */
export function deleteInventoryItem(id: string, businessId?: string | null): boolean {
  const inventory = getInventory(businessId)
  const filteredInventory = inventory.filter((item) => item.id !== id)

  if (filteredInventory.length === inventory.length) return false

  saveInventory(filteredInventory, businessId)
  return true
}

/**
 * Get inventory history (snapshots)
 */
export function getInventoryHistory(businessId?: string | null): InventorySnapshot[] {
  const newHistory = getFromStorage<InventorySnapshot[]>(STORAGE_KEYS.INVENTORY_HISTORY, businessId)

  // Fallback to old key for backward compatibility
  if (!newHistory || newHistory.length === 0) {
    if (typeof window !== "undefined") {
      const oldHistory = localStorage.getItem("inventoryHistory")
      if (oldHistory) {
        try {
          const parsed = JSON.parse(oldHistory)
          // Migrate to new system
          if (parsed && Array.isArray(parsed) && parsed.length > 0) {
            saveInventoryHistory(parsed, businessId)
            return parsed
          }
        } catch (error) {
          console.error("[Storage] Error reading old inventory history:", error)
        }
      }
    }
  }

  return newHistory || []
}

/**
 * Save inventory history
 */
export function saveInventoryHistory(history: InventorySnapshot[], businessId?: string | null): void {
  saveToStorage(STORAGE_KEYS.INVENTORY_HISTORY, history, businessId)
  console.log(`[Storage] Saved ${history.length} inventory snapshots`)
}

/**
 * Add a new inventory snapshot to history
 */
export function addInventorySnapshot(snapshot: InventorySnapshot, businessId?: string | null): void {
  const history = getInventoryHistory(businessId)
  history.unshift(snapshot) // Add to beginning
  saveInventoryHistory(history, businessId)
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
