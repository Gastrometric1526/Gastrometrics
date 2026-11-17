// Cocina vs. barra en Finanzas (docs/136, Fase 3). El dueño necesita ver el food cost y
// el beverage cost por separado: un trago con 20 % de costo y un plato con 32 % promedian
// un número que no describe a ninguno de los dos, y los objetivos sanos son distintos.
//
// Un plato vendido es "de barra" si su receta tiene una clasificación de barra
// (lib/beverage.ts). Las líneas de menú (combos del registro manual) y las líneas sin
// receta quedan en cocina: no hay forma de saber qué parte del combo era bebida.

import { DEFAULT_VALUATION_METHOD, snapshotItemValueBy, type ValuationMethod } from "./inventory-valuation"
import { orderPurchaseValue, receiptLines, returnValue } from "@/lib/purchase-receipt"
import { receivedPurchaseOrdersIn, type DishPerformance } from "@/lib/sales-analytics"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import { BAR_CLASSIFICATIONS, getBarKind, isBarClassification, isBeverageCategory, type BarKind } from "@/lib/beverage"
import { snapshotItemValue } from "@/lib/inventory-value"
import { inPeriodDays } from "@/lib/date-format"

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
  const netByArea = { kitchen: 0, bar: 0 }
  for (const dish of dishes) {
    const area = split[getDishArea(dish, recipesById)]
    area.revenue += dish.revenue
    area.theoreticalCost += dish.theoreticalCost
    area.dishCount += 1
    netByArea[getDishArea(dish, recipesById)] += dish.revenue - (dish.tax || 0)
  }
  const total = split.kitchen.revenue + split.bar.revenue
  for (const key of ["kitchen", "bar"] as const) {
    const area = split[key]
    // % de costo sobre la venta sin ISV (docs/187), igual que la Ficha Técnica.
    area.costPercent = netByArea[key] > 0 ? (area.theoreticalCost / netByArea[key]) * 100 : 0
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
  /** Método de valoración del inventario (docs/313), el mismo que el COGS total. */
  valuationMethod?: ValuationMethod
}): AreaCOGS {
  const { snapshots, purchaseOrders, periodStart, periodEnd, ingredients, valuationMethod = DEFAULT_VALUATION_METHOD } = params
  // Por día local, igual que computeCOGS (docs/328).
  const inRange = (dateStr: string) => inPeriodDays(dateStr, periodStart, periodEnd)
  const sorted = [...snapshots].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const inPeriod = periodStart && periodEnd ? sorted.filter((s) => inRange(s.date)) : sorted
  if (inPeriod.length < 2) return { kitchen: 0, bar: 0, hasFullData: false }

  const valueByArea = (snapshot: InventorySnapshot) => {
    let bar = 0
    let kitchen = 0
    for (const item of snapshot.items ?? []) {
      const value = snapshotItemValueBy(item, valuationMethod)
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
  // docs/322: lo recibido de verdad y menos las devoluciones del período.
  const isBarItem = (name: string) => isBeverageCategory(categoryByName.get(name.trim().toLowerCase()))
  for (const order of receivedPurchaseOrdersIn(purchaseOrders, inRange)) {
    totalPurchases += orderPurchaseValue(order)
    // Sin recepción revisada, el costo de cada línea tal como se pidió (lo de siempre).
    const lines = receiptLines(order)
    ;(order.items ?? []).forEach((item, i) => {
      if (isBarItem(item.name)) barPurchases += order.receipt ? lines[i].receivedValue : item.purchaseCost || 0
    })
  }
  for (const order of purchaseOrders) {
    const names = new Map(receiptLines(order).map((l) => [l.key, l.name]))
    for (const ret of order.returns ?? []) {
      if (!inRange(ret.at)) continue
      totalPurchases -= returnValue(order, ret).total
      for (const l of ret.lines) if (isBarItem(names.get(l.key) || "")) barPurchases -= l.quantity * l.unitCost
    }
  }
  barPurchases = Math.max(0, barPurchases)
  const kitchenPurchases = Math.max(0, totalPurchases - barPurchases)

  return {
    kitchen: Math.max(0, initial.kitchen + kitchenPurchases - final.kitchen),
    bar: Math.max(0, initial.bar + barPurchases - final.bar),
    hasFullData: true,
  }
}

export interface BarKindRow {
  kind: BarKind
  revenue: number
  theoreticalCost: number
  /** Costo teórico ÷ venta neta (sin ISV incluido), en %. */
  pourCost: number
  /** Promedio de los objetivos de pour cost de sus fichas, ponderado por la venta. null si no hay. */
  target: number | null
}

/**
 * Pour cost por tipo de bebida (docs/272): cócteles, vinos, cervezas, sin alcohol y café.
 * Mismas ventas y costo teórico que «Cocina vs. barra», separadas por la clasificación de
 * barra de cada ficha. El objetivo de cada tipo es el que la persona puso en sus fichas.
 */
export function splitBarByKind(dishes: DishPerformance[], recipes: Recipe[]): BarKindRow[] {
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const acc = new Map<BarKind, { revenue: number; net: number; cost: number; targetSum: number; targetWeight: number }>()
  for (const dish of dishes) {
    const recipe = dish.recipeId ? recipesById.get(dish.recipeId) : undefined
    const kind = recipe ? getBarKind(recipe.classification) : null
    if (!kind || !recipe) continue
    const row = acc.get(kind) ?? { revenue: 0, net: 0, cost: 0, targetSum: 0, targetWeight: 0 }
    row.revenue += dish.revenue
    row.net += dish.revenue - (dish.tax || 0)
    row.cost += dish.theoreticalCost
    if (recipe.pricingMethod === "food_cost" && typeof recipe.targetFoodCostPercent === "number" && dish.revenue > 0) {
      row.targetSum += recipe.targetFoodCostPercent * dish.revenue
      row.targetWeight += dish.revenue
    }
    acc.set(kind, row)
  }
  return (Object.keys(BAR_CLASSIFICATIONS) as BarKind[])
    .filter((kind) => acc.has(kind))
    .map((kind) => {
      const row = acc.get(kind)!
      return {
        kind,
        revenue: row.revenue,
        theoreticalCost: row.cost,
        pourCost: row.net > 0 ? (row.cost / row.net) * 100 : 0,
        target: row.targetWeight > 0 ? row.targetSum / row.targetWeight : null,
      }
    })
}
