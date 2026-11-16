/**
 * Ventas por tipo de plato (pedido del dueño, docs/325): cuánto se vende de platos con res,
 * cerdo, pollo, pescado…, vegetarianos, veganos y sin gluten. Sale de los mismos platos que
 * Finanzas y el Menu Engineering (`DishPerformance`, solo los vinculados a una receta) y del
 * tipo de cada receta (`dishLabels`, lib/diet.ts). Nunca otra fórmula de venta o margen.
 *
 * Un plato cuenta en cada proteína que lleva (un mar y tierra suma en res y en mariscos), y un
 * plato vegano cuenta también como vegetariano; por eso los % no suman 100.
 */

import type { DishLabels, Protein } from "@/lib/diet"
import { PROTEINS } from "@/lib/diet"
import type { DishPerformance } from "@/lib/sales-analytics"

export type DishTypeKey = Protein | "vegetarian" | "vegan" | "gluten_free"
export const DISH_TYPE_KEYS: DishTypeKey[] = [...PROTEINS, "vegetarian", "vegan", "gluten_free"]

export interface DishTypeRow {
  key: DishTypeKey
  /** Platos distintos vendidos de este tipo. */
  dishes: number
  units: number
  /** Venta neta (sin ISV incluido), igual que Finanzas. */
  net: number
  /** % de la venta neta de los platos con receta (0 a 100). */
  share: number
  /** Margen de contribución sumado de esos platos (el mismo de Finanzas). */
  margin: number
}

export interface DishTypeSales {
  rows: DishTypeRow[]
  /** Venta neta de los platos con receta (la base de los %). */
  recipeNet: number
  /** Venta neta vinculada a un menú completo (no tiene un solo tipo): queda fuera. */
  menuNet: number
}

export function salesByDishType(dishes: DishPerformance[], labelsById: Map<string, DishLabels>): DishTypeSales {
  const rows = new Map<DishTypeKey, DishTypeRow>(DISH_TYPE_KEYS.map((key) => [key, { key, dishes: 0, units: 0, net: 0, share: 0, margin: 0 }]))
  let recipeNet = 0
  let menuNet = 0
  for (const d of dishes) {
    if (!d.linked) continue
    const net = d.revenue - (d.tax || 0)
    const labels = d.recipeId ? labelsById.get(d.recipeId) : undefined
    if (!labels) {
      menuNet += net
      continue
    }
    recipeNet += net
    const keys: DishTypeKey[] = [...labels.proteins]
    if (labels.diet.vegetarian) keys.push("vegetarian")
    if (labels.diet.vegan) keys.push("vegan")
    if (!labels.allergens.includes("gluten") && !labels.mayContain.includes("gluten")) keys.push("gluten_free")
    for (const k of keys) {
      const r = rows.get(k)!
      r.dishes += 1
      r.units += d.quantitySold
      r.net += net
      r.margin += d.contributionMargin
    }
  }
  const out = [...rows.values()]
    .filter((r) => r.dishes > 0)
    .map((r) => ({ ...r, share: recipeNet > 0 ? (r.net / recipeNet) * 100 : 0 }))
    .sort((a, b) => b.net - a.net)
  return { rows: out, recipeNet, menuNet }
}
