/**
 * Control de faltantes y pérdidas (docs/283): la etapa 6 de la propuesta de barra del dueño
 * («diferencia teórica vs. real: detectar consumo no explicado»), en dinero.
 *
 * Por producto:
 * - Faltante sin explicar del último conteo: lo contado − lo esperado (conteo anterior +
 *   compras recibidas − lo que gastaron las ventas según las recetas − pérdidas
 *   registradas). Negativo = salió más de lo que explican las ventas y las pérdidas
 *   (sobreservido, derrames sin anotar, cortesías no registradas, errores de venta, robo).
 * - Pérdidas registradas desde el último conteo, por motivo (lib/stock-losses.ts).
 * Valor = cantidad × (precio del envase ÷ contenido del envase), como el valor del
 * inventario (lib/inventory-value.ts). La barra = productos de categorías de bebidas.
 */

import type { InventoryItem, StockLossReason } from "@/types/inventory"
import type { TheoreticalStockEntry } from "@/lib/theoretical-stock"
import { isBeverageCategory } from "@/lib/beverage"
import { stockValue, inventoryItemPackageContent, type PackageContentLookup } from "@/lib/inventory-value"
import { STOCK_LOSS_REASONS } from "@/lib/stock-losses"

export type StockControlRow = {
  id: string
  name: string
  unit: string
  bar: boolean
  packageContent: number | undefined
  /** Diferencia del último conteo (negativo = faltante). null sin dos conteos. */
  variance: number | null
  /** Valor del faltante sin explicar (positivo), 0 si no falta. */
  shortageValue: number
  /** Valor del sobrante (positivo), 0 si no sobra. */
  surplusValue: number
  /** Pérdidas registradas desde el último conteo (cantidad y valor). */
  lost: number
  lostValue: number
  /** Pérdidas ya descontadas en el último conteo. */
  lastCountLost: number
}

export type StockControlSummary = {
  rows: StockControlRow[]
  shortageValue: number
  surplusValue: number
  lostValue: number
  lostByReason: Record<StockLossReason, number>
  /** Productos con al menos dos conteos (sin eso no hay diferencia que medir). */
  measured: number
  hasBar: boolean
}

export function computeStockControl(
  items: InventoryItem[],
  theoretical: Map<string, TheoreticalStockEntry>,
  lookup?: PackageContentLookup,
  options: { onlyBar?: boolean } = {},
): StockControlSummary {
  const lostByReason = Object.fromEntries(STOCK_LOSS_REASONS.map((r) => [r, 0])) as Record<StockLossReason, number>
  const rows: StockControlRow[] = []
  let hasBar = false
  for (const item of items) {
    const bar = isBeverageCategory(item.category)
    if (bar) hasBar = true
    if (options.onlyBar && !bar) continue
    const entry = theoretical.get(item.id)
    const content = inventoryItemPackageContent(item, lookup)
    const value = (qty: number) => stockValue(Math.abs(qty), item.price, content)
    const variance = entry?.lastCountVariance ?? null
    const losses = item.stockLosses ?? []
    const lost = losses.reduce((sum, l) => sum + (l.quantity || 0), 0)
    for (const l of losses) lostByReason[l.reason] = (lostByReason[l.reason] ?? 0) + value(l.quantity || 0)
    // Diferencias mínimas (redondeo de conteos) no cuentan.
    const meaningful = variance !== null && Math.abs(variance) > 1e-6
    const row: StockControlRow = {
      id: item.id,
      name: item.name,
      unit: item.unit,
      bar,
      packageContent: content,
      variance,
      shortageValue: meaningful && variance! < 0 ? value(variance!) : 0,
      surplusValue: meaningful && variance! > 0 ? value(variance!) : 0,
      lost,
      lostValue: value(lost),
      lastCountLost: entry?.lastCountLost ?? 0,
    }
    if (variance !== null || lost > 0) rows.push(row)
  }
  // Lo que más dinero cuesta primero: faltantes, luego pérdidas.
  rows.sort((a, b) => b.shortageValue + b.lostValue - (a.shortageValue + a.lostValue) || a.name.localeCompare(b.name))
  return {
    rows,
    shortageValue: rows.reduce((s, r) => s + r.shortageValue, 0),
    surplusValue: rows.reduce((s, r) => s + r.surplusValue, 0),
    lostValue: rows.reduce((s, r) => s + r.lostValue, 0),
    lostByReason,
    measured: rows.filter((r) => r.variance !== null).length,
    hasBar,
  }
}
