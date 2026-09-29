// Cocina vs. barra en Finanzas (docs/136, Fase 3). El dueño necesita ver el food cost y
// el beverage cost por separado: un trago con 20 % de costo y un plato con 32 % promedian
// un número que no describe a ninguno de los dos, y los objetivos sanos son distintos.
//
// Un plato vendido es "de barra" si su receta tiene una clasificación de barra
// (lib/beverage.ts). Las líneas de menú (combos del registro manual) y las líneas sin
// receta quedan en cocina: no hay forma de saber qué parte del combo era bebida.

import type { DishPerformance } from "@/lib/sales-analytics"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import { isBarClassification, isBeverageCategory } from "@/lib/beverage"
import { snapshotItemValue } from "@/lib/inventory-value"

export type SalesArea = "kitchen" | "bar"

export function getDishArea(dish: Pick<DishPerformance, "recipeId">, recipesById: Map<string, Recipe>): SalesArea {
  const recipe = dish.recipeId ? recipesById.get(dish.recipeId) : undefined
  return recipe && isBarClassification(recipe.classification) ? "bar" : "kitchen"
}

export interface AreaTotals {
  revenue: number
  theoreticalCost: number
  /** Costo teórico ÷ ventas, en %. */
  costPercent: number
  /** Participación en las ventas totales, en %. */
  mixPercent: number
  dishCount: number
}

export interface KitchenBarSplit {
  kitchen: AreaTotals
  bar: AreaTotals
}

export function splitSalesByArea(dishes: DishPerformance[], recipes: Recipe[]): KitchenBarSplit {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const empty = (): AreaTotals => ({ revenue: 0, theoreticalCost: 0, costPercent: 0, mixPercent: 0, dishCount: 0 })
  const split: KitchenBarSplit = { kitchen: empty(), bar: empty() }
  for (const dish of dishes) {
    const area = split[getDishArea(dish, recipesById)]
    area.revenue += dish.revenue
    area.theoreticalCost += dish.theoreticalCost
    area.dishCount += 1
  }
  const total = split.kitchen.revenue + split.bar.revenue
  for (const area of [split.kitchen, split.bar]) {
    area.costPercent = area.revenue > 0 ? (area.theoreticalCost / area.revenue) * 100 : 0
    area.mixPercent = total > 0 ? (area.revenue / total) * 100 : 0
  }
  return split
}

export function filterDishesByArea(dishes: DishPerformance[], recipes: Recipe[], area: SalesArea | "all"): DishPerformance[] {
  if (area === "all") return dishes
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  return dishes.filter((dish) => getDishArea(dish, recipesById) === area)
}

export interface AreaCOGS {
  kitchen: number
  bar: number
  hasFullData: boolean
}

/**
 * Costo real (inventario inicial + compras − inventario final) por área, con la misma
 * fórmula que computeCOGS pero separando los productos de barra (categoría de bebida) del
 * resto. Solo tiene sentido con un conteo inicial y uno final dentro del período: sin
 * ellos devuelve hasFullData = false y el panel muestra solo el costo teórico.
 */
export function computeCOGSByArea(params: {
  snapshots: InventorySnapshot[]
  purchaseOrders: PurchaseOrder[]
  periodStart: string | null
  periodEnd: string | null
  ingredients: Ingredient[]
}): AreaCOGS {
  const { snapshots, purchaseOrders, periodStart, periodEnd, ingredients } = params
  const inRange = (dateStr: string) => {
    if (!periodStart || !periodEnd) return true
    const d = new Date(dateStr).getTime()
    return d >= new Date(periodStart).getTime() && d <= new Date(periodEnd).getTime() + 86400000 - 1
  }
  const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const inPeriod = periodStart && periodEnd ? sorted.filter((s) => inRange(s.date)) : sorted
  if (inPeriod.length < 2) return { kitchen: 0, bar: 0, hasFullData: false }

  const valueByArea = (snapshot: InventorySnapshot) => {
    let bar = 0
    let kitchen = 0
    for (const item of snapshot.items ?? []) {
      const value = snapshotItemValue(item)
      if (isBeverageCategory(item.category)) bar += value
      else kitchen += value
    }
    return { bar, kitchen }
  }
  const initial = valueByArea(inPeriod[0])
  const final = valueByArea(inPeriod[inPeriod.length - 1])

  const categoryByName = new Map(ingredients.map((ingredient) => [ingredient.name.trim().toLowerCase(), ingredient.category]))
  let barPurchases = 0
  let totalPurchases = 0
  for (const order of purchaseOrders) {
    if (!inRange(order.date)) continue
    totalPurchases += order.total || 0
    for (const item of order.items ?? []) {
      if (isBeverageCategory(categoryByName.get(item.name.trim().toLowerCase()))) barPurchases += item.purchaseCost || 0
    }
  }
  const kitchenPurchases = Math.max(0, totalPurchases - barPurchases)

  return {
    kitchen: Math.max(0, initial.kitchen + kitchenPurchases - final.kitchen),
    bar: Math.max(0, initial.bar + barPurchases - final.bar),
    hasFullData: true,
  }
}
