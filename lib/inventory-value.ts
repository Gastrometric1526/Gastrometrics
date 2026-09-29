// Valor del inventario (docs/136).
//
// BUG CORREGIDO: en todo el proyecto el valor se calculaba como `stock × precio`, pero el
// stock se guarda en la unidad del ingrediente (ml, g, kg…) y el precio es el del ENVASE
// completo (la botella, el saco, la caja). Una botella de vino de $20 con 750 ml contada
// entera valía 750 × 20 = $15,000 en vez de $20. Solo daba bien cuando el envase trae
// exactamente 1 unidad (precio por kg con contenido 1). Afectaba el valor de inventario
// de /estadisticas, /inventario, el PDF de inventario y, sobre todo, el costo real (COGS)
// de Finanzas, que sale de los snapshots de conteo. El valor correcto es
// stock × (precio del envase ÷ contenido del envase).

import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem, InventorySnapshot, InventorySnapshotItem } from "@/types/inventory"
import { getPackageContent } from "@/lib/beverage"

export function stockValue(quantity: number | null | undefined, packagePrice: number | null | undefined, packageContent: number | null | undefined): number {
  const qty = quantity || 0
  const price = packagePrice || 0
  if (!(qty > 0) || !(price > 0)) return 0
  // Sin contenido conocido se mantiene el cálculo anterior (precio por unidad).
  return packageContent && packageContent > 0 ? (qty * price) / packageContent : qty * price
}

export type PackageContentLookup = (itemId: string, itemName?: string) => number | undefined

/** Contenido físico de envase por id (y por nombre, como respaldo) desde Ingredientes. */
export function buildPackageContentLookup(ingredients: Ingredient[]): PackageContentLookup {
  const byId = new Map<string, number>()
  const byName = new Map<string, number>()
  for (const ingredient of ingredients) {
    const content = getPackageContent(ingredient)
    if (content > 0) {
      byId.set(ingredient.id, content)
      byName.set(ingredient.name, content)
    }
  }
  return (itemId, itemName) => byId.get(itemId) ?? (itemName ? byName.get(itemName) : undefined)
}

export function inventoryItemPackageContent(item: InventoryItem, lookup?: PackageContentLookup): number | undefined {
  return lookup?.(item.id, item.name) ?? (item.netContent && item.netContent > 0 ? item.netContent : undefined)
}

export function inventoryItemValue(item: InventoryItem, lookup?: PackageContentLookup): number {
  return stockValue(item.currentStock, item.price, inventoryItemPackageContent(item, lookup))
}

export function inventoryTotalValue(items: InventoryItem[], lookup?: PackageContentLookup): number {
  return items.reduce((sum, item) => sum + inventoryItemValue(item, lookup), 0)
}

export function snapshotItemValue(item: InventorySnapshotItem): number {
  return stockValue(item.quantity, item.priceAtDate ?? item.price, item.netContent)
}

/**
 * Valor de un conteo guardado. Se recalcula desde sus líneas (cantidad, precio y
 * contenido de envase del momento) en vez de leer `totalValue`, que en los conteos
 * guardados antes de esta corrección quedó multiplicado por el contenido del envase.
 */
export function snapshotValue(snapshot: InventorySnapshot): number {
  if (!snapshot.items || snapshot.items.length === 0) return snapshot.totalValue || 0
  return snapshot.items.reduce((sum, item) => sum + snapshotItemValue(item), 0)
}
