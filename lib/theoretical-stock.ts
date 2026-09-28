/**
 * Stock teórico (docs/134): cuánto DEBERÍA quedar de cada producto según las ventas
 * registradas, sin esperar al próximo conteo físico.
 *
 *   stock teórico = último conteo real − consumo de las ventas registradas después
 *
 * No modifica ningún dato: se calcula al vuelo. Así, editar o borrar una venta, una
 * importación del POS o una factura corrige el número solo, sin «devoluciones» de stock.
 *
 * - «Último conteo real» de un producto: el registro de inventario más reciente que lo
 *   incluye (inventory_snapshots — los 3 tipos guardan el total resultante), o una
 *   edición manual del stock si es más nueva (InventoryItem.stockCountedAt).
 * - Consumo: cada línea de venta (manual, POS o factura) con receta o menú se expande a
 *   ingredientes base con lib/recipe-consumption.ts (sub-recetas escaladas por su
 *   rendimiento, merma en cantidad bruta). Vender N unidades = N porciones del
 *   rendimiento de la receta (mismo criterio que el costo teórico de las ventas). Un menú
 *   vendido = 1 porción de cada plato habilitado (mismo criterio que getMenuUnitPriceAndCost).
 * - Una venta cuenta si su fecha es posterior al día del conteo, o del mismo día pero
 *   registrada después del conteo.
 * - «Diferencia en el último conteo»: lo contado en el último registro menos lo que la
 *   teoría esperaba desde el registro anterior. Negativo = salió más de lo que explican
 *   las recetas (merma, desperdicio, porciones más grandes, faltantes); positivo = hay más
 *   de lo esperado (compras o ventas sin registrar).
 */

import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { Menu } from "@/lib/types/menus"
import type { SalesImport } from "@/types/sales-import"
import { accumulateRecipeConsumption, indexById, recipeBaseYield, type ConsumptionMap } from "./recipe-consumption"

export interface TheoreticalStockEntry {
  /** Stock del último conteo real. */
  baseline: number
  /** Momento de ese conteo (ISO). */
  baselineAt: string
  /** Consumo teórico de las ventas registradas desde entonces (unidad base). */
  consumed: number
  /** Mercadería recibida (órdenes de compra marcadas «Recibida») desde el conteo. */
  received: number
  /** baseline + received − consumed (puede quedar negativo: faltan compras o conteos por registrar). */
  theoretical: number
  /** Diferencia real vs. teórica en el último registro de inventario (null si no hay dos registros). */
  lastCountVariance: number | null
}

interface CountPoint {
  quantity: number
  at: string
  receivedSincePrevious: number
}

function dayOf(iso: string): string {
  return iso.slice(0, 10)
}

function saleCountsAfter(saleDay: string, registeredAt: string, countAt: string): boolean {
  const countDay = dayOf(countAt)
  if (saleDay > countDay) return true
  return saleDay === countDay && registeredAt > countAt
}

function saleCountsBetween(saleDay: string, registeredAt: string, fromAt: string, toAt: string): boolean {
  return saleCountsAfter(saleDay, registeredAt, fromAt) && !saleCountsAfter(saleDay, registeredAt, toAt)
}

/** Registros de inventario por producto, del más nuevo al más viejo. */
function countHistoryByItem(snapshots: InventorySnapshot[]): Map<string, CountPoint[]> {
  const history = new Map<string, CountPoint[]>()
  for (const snap of snapshots) {
    for (const entry of snap.items ?? []) {
      if (typeof entry.quantity !== "number" || !isFinite(entry.quantity)) continue
      const list = history.get(entry.id) ?? []
      list.push({ quantity: entry.quantity, at: snap.date, receivedSincePrevious: entry.receivedSincePrevious || 0 })
      history.set(entry.id, list)
    }
  }
  for (const list of history.values()) list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return history
}

/** Consumo de las ventas que cumplen `include`, expandido a ingredientes base. */
export function salesConsumption(
  salesImports: SalesImport[],
  recipes: Recipe[],
  ingredients: Ingredient[],
  menus: Menu[],
  include: (saleDay: string, registeredAt: string) => boolean,
): ConsumptionMap {
  const recipesById = indexById(recipes)
  const ingredientsById = indexById(ingredients)
  const menusById = indexById(menus)
  const acc: ConsumptionMap = new Map()

  for (const imp of salesImports) {
    const registeredAt = imp.importedAt
    for (const line of imp.lines ?? []) {
      if (!(line.quantity > 0)) continue
      const saleDay = dayOf(line.date || imp.periodEnd || imp.importedAt)
      if (!include(saleDay, registeredAt)) continue

      if (line.menuId) {
        const menu = menusById.get(line.menuId)
        for (const item of menu?.items ?? []) {
          if (!item.enabled) continue
          const recipe = recipesById.get(item.recipeId)
          if (!recipe) continue
          accumulateRecipeConsumption(recipe, line.quantity / recipeBaseYield(recipe), recipesById, ingredientsById, acc, {
            grossUpMerma: true,
          })
        }
      } else if (line.recipeId) {
        const recipe = recipesById.get(line.recipeId)
        if (!recipe) continue
        accumulateRecipeConsumption(recipe, line.quantity / recipeBaseYield(recipe), recipesById, ingredientsById, acc, {
          grossUpMerma: true,
        })
      }
    }
  }
  return acc
}

export function computeTheoreticalStock(input: {
  items: InventoryItem[]
  snapshots: InventorySnapshot[]
  salesImports: SalesImport[]
  recipes: Recipe[]
  ingredients: Ingredient[]
  menus: Menu[]
}): Map<string, TheoreticalStockEntry> {
  const { items, snapshots, salesImports, recipes, ingredients, menus } = input
  const history = countHistoryByItem(snapshots)
  const result = new Map<string, TheoreticalStockEntry>()

  // Se agrupan los productos por momento de conteo para expandir las ventas una sola vez
  // por momento (normalmente todos se cuentan juntos en el mismo registro).
  const consumptionCache = new Map<string, ConsumptionMap>()
  const consumptionSince = (at: string) => {
    let map = consumptionCache.get(at)
    if (!map) {
      map = salesConsumption(salesImports, recipes, ingredients, menus, (day, reg) => saleCountsAfter(day, reg, at))
      consumptionCache.set(at, map)
    }
    return map
  }

  for (const item of items) {
    const counts = history.get(item.id) ?? []
    let baseline: CountPoint | null = counts[0] ?? null
    if (item.stockCountedAt && typeof item.currentStock === "number" && (!baseline || item.stockCountedAt > baseline.at)) {
      baseline = { quantity: item.currentStock, at: item.stockCountedAt, receivedSincePrevious: 0 }
    }
    if (!baseline) continue

    const consumed = consumptionSince(baseline.at).get(item.id)?.quantity ?? 0
    const baselineAt = baseline.at
    const received = (item.stockReceipts ?? []).filter((r) => r.at > baselineAt).reduce((sum, r) => sum + r.quantity, 0)

    let lastCountVariance: number | null = null
    if (counts.length >= 2) {
      const [latest, previous] = counts
      const between = salesConsumption(salesImports, recipes, ingredients, menus, (day, reg) =>
        saleCountsBetween(day, reg, previous.at, latest.at),
      )
      const expected = previous.quantity + latest.receivedSincePrevious - (between.get(item.id)?.quantity ?? 0)
      lastCountVariance = latest.quantity - expected
    }

    result.set(item.id, {
      baseline: baseline.quantity,
      baselineAt: baseline.at,
      consumed,
      received,
      theoretical: baseline.quantity + received - consumed,
      lastCountVariance,
    })
  }
  return result
}
