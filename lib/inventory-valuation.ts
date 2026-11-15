/**
 * Valoración del inventario (docs/313, pedido del dueño). Tres métodos, cada uno con su
 * costo por unidad (g, ml, unidad…), nunca mezclados:
 *
 * | Método                     | Costo por unidad                                   | De dónde sale                          |
 * |----------------------------|----------------------------------------------------|----------------------------------------|
 * | Costo promedio ponderado   | lo que costó, en promedio, lo que hay en stock      | `pricing.weightedAverageCost` (costo   |
 * |                            |                                                    | móvil, docs/187), al registrar una     |
 * |                            |                                                    | compra o recibir una orden             |
 * | Último precio de compra    | lo que se pagó la última vez que se COMPRÓ          | `pricing.lastPurchasePrice`; antes de  |
 * |                            |                                                    | este cambio, el precio del envase del  |
 * |                            |                                                    | inventario (lo de siempre)             |
 * | Valor de reposición        | lo que costaría comprarlo HOY                       | precio vigente del ingrediente         |
 * |                            |                                                    | (`pricing.pricePerUnit`)               |
 *
 * Si a un producto le falta el dato de su método (nunca se registró una compra), se usa el
 * siguiente que tenga y se cuenta en `fallbacks`, para avisarlo en pantalla: nunca se
 * inventa un costo ni se valora en cero algo que sí tiene precio.
 *
 * El método elegido (por defecto «último precio de compra», el de siempre: los números no
 * cambian si nadie elige otro) valora el inventario en pantalla, en los conteos que se
 * guardan desde ahora y, por eso, el inventario inicial y final del costo real (COGS).
 */

import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem, InventorySnapshot, InventorySnapshotItem } from "@/types/inventory"
import { stockValue, type PackageContentLookup, inventoryItemPackageContent } from "@/lib/inventory-value"

export const VALUATION_METHODS = ["last_purchase", "weighted_average", "replacement"] as const
export type ValuationMethod = (typeof VALUATION_METHODS)[number]
export const DEFAULT_VALUATION_METHOD: ValuationMethod = "last_purchase"

export function isValuationMethod(value: unknown): value is ValuationMethod {
  return typeof value === "string" && (VALUATION_METHODS as readonly string[]).includes(value)
}

export type UnitCosts = Partial<Record<ValuationMethod, number>>

const positive = (n: number | undefined | null): number | undefined => (typeof n === "number" && n > 0 && Number.isFinite(n) ? n : undefined)

/**
 * Costo por unidad de un producto en cada método, con lo que se sabe de él. `item` aporta
 * el precio del envase del inventario (lo de siempre), `ingredient` los datos de compra.
 */
export function unitCostsFor(item: Pick<InventoryItem, "price"> | undefined, ingredient: Ingredient | undefined, packageContent: number | undefined): UnitCosts {
  const pricing = ingredient?.pricing
  const packagePerUnit = item && positive(item.price) ? item.price / (packageContent && packageContent > 0 ? packageContent : 1) : undefined
  return {
    weighted_average: positive(pricing?.weightedAverageCost),
    last_purchase: positive(pricing?.lastPurchasePrice) ?? packagePerUnit,
    replacement: positive(pricing?.pricePerUnit) ?? packagePerUnit,
  }
}

/** Orden de respaldo si falta el dato del método elegido. */
const FALLBACK: Record<ValuationMethod, ValuationMethod[]> = {
  last_purchase: ["last_purchase", "replacement", "weighted_average"],
  weighted_average: ["weighted_average", "last_purchase", "replacement"],
  replacement: ["replacement", "last_purchase", "weighted_average"],
}

/** Costo por unidad en el método pedido y si hubo que usar otro. */
export function resolveUnitCost(costs: UnitCosts, method: ValuationMethod): { unitCost: number; usedMethod: ValuationMethod | null } {
  for (const m of FALLBACK[method]) {
    const c = costs[m]
    if (c !== undefined) return { unitCost: c, usedMethod: m }
  }
  return { unitCost: 0, usedMethod: null }
}

export interface ValuationLine {
  id: string
  name: string
  quantity: number
  unitCosts: UnitCosts
  value: Record<ValuationMethod, number>
}

export interface InventoryValuation {
  lines: ValuationLine[]
  totals: Record<ValuationMethod, number>
  /** Productos con stock a los que les falta el dato de cada método (se usó otro). */
  fallbacks: Record<ValuationMethod, number>
}

/** Valor del inventario actual en los tres métodos, lado a lado. */
export function valueInventory(items: InventoryItem[], ingredients: Ingredient[], lookup?: PackageContentLookup): InventoryValuation {
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const byName = new Map(ingredients.map((i) => [i.name.trim().toLowerCase(), i]))
  const totals = { last_purchase: 0, weighted_average: 0, replacement: 0 }
  const fallbacks = { last_purchase: 0, weighted_average: 0, replacement: 0 }
  const lines: ValuationLine[] = []
  for (const item of items) {
    const quantity = item.currentStock || 0
    if (!(quantity > 0)) continue
    const ingredient = byId.get(item.id) ?? byName.get(item.name.trim().toLowerCase())
    const unitCosts = unitCostsFor(item, ingredient, inventoryItemPackageContent(item, lookup))
    const value = { last_purchase: 0, weighted_average: 0, replacement: 0 }
    for (const m of VALUATION_METHODS) {
      const { unitCost, usedMethod } = resolveUnitCost(unitCosts, m)
      value[m] = quantity * unitCost
      totals[m] += value[m]
      if (usedMethod !== m) fallbacks[m]++
    }
    lines.push({ id: item.id, name: item.name, quantity, unitCosts, value })
  }
  return { lines, totals, fallbacks }
}

/**
 * Valor de una línea de un conteo guardado en un método. Los conteos guardados desde
 * docs/313 traen `unitCosts`; los anteriores solo el precio del envase, que es el último
 * precio de compra (lo de siempre), y se valoran así en cualquier método.
 */
export function snapshotItemValueBy(item: InventorySnapshotItem, method: ValuationMethod): number {
  const legacy = stockValue(item.quantity, item.priceAtDate ?? item.price, item.netContent)
  if (method === DEFAULT_VALUATION_METHOD || !item.unitCosts) return legacy
  const { unitCost, usedMethod } = resolveUnitCost(item.unitCosts, method)
  return usedMethod ? (item.quantity || 0) * unitCost : legacy
}

/** Valor de un conteo guardado en un método (el de siempre si no se pide otro). */
export function snapshotValueBy(snapshot: InventorySnapshot, method: ValuationMethod = DEFAULT_VALUATION_METHOD): number {
  if (!snapshot.items || snapshot.items.length === 0) return snapshot.totalValue || 0
  return snapshot.items.reduce((sum, item) => sum + snapshotItemValueBy(item, method), 0)
}
