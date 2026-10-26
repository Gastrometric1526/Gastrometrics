/**
 * Precios y proveedores (docs/202) — pedido del dueño: historial de precios y comparación de
 * proveedores dentro de Estadísticas. Puro, cubierto por lib/supplier-insights.test.ts.
 *
 * Junta cada precio que la app ya conoce, sin tablas nuevas:
 * - Órdenes de compra (no canceladas): precio por unidad del ingrediente y proveedor de cada
 *   línea, con la fecha de la orden.
 * - Compras registradas en Inventario (conteos tipo «compra»): precio del envase ÷ su
 *   contenido, con el proveedor guardado.
 * - Cambios de precio (las notificaciones que deja cada compra o edición, lib/recalculate.ts):
 *   sin proveedor; sirven para el historial.
 * - El precio y proveedor actuales de cada ingrediente.
 * Todo se compara en precio por unidad del ingrediente (la misma unidad del catálogo).
 */

import type { Ingredient } from "@/types/ingredient"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { InventorySnapshot } from "@/types/inventory"

export type PriceSource = "order" | "purchase" | "change" | "current"

export interface PriceObservation {
  key: string // id del ingrediente, o el nombre normalizado si no hay id
  ingredientId: string | null
  name: string
  unit: string
  supplier: string | null
  pricePerUnit: number
  date: string // ISO
  source: PriceSource
  /** Cantidad comprada (órdenes y compras), para estimar gasto y ahorro. */
  quantity: number
}

export interface PriceChangeLike {
  ingredientId: string
  ingredientName: string
  oldPrice: number
  newPrice: number
  timestamp: string
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ")
const UNKNOWN_SUPPLIERS = new Set(["", "no especificado", "sin proveedor", "-", "—", "n/a"])
export const cleanSupplier = (s: string | null | undefined): string | null => (UNKNOWN_SUPPLIERS.has(norm(s)) ? null : (s ?? "").trim())

export function collectPriceObservations(input: {
  ingredients: Ingredient[]
  orders: PurchaseOrder[]
  snapshots: InventorySnapshot[]
  changes: PriceChangeLike[]
  now?: string
}): PriceObservation[] {
  const byId = new Map(input.ingredients.map((i) => [i.id, i]))
  const byName = new Map(input.ingredients.map((i) => [norm(i.name), i]))
  const resolve = (id: string | null | undefined, name: string) => {
    const ing = (id && byId.get(id)) || byName.get(norm(name))
    return { key: ing?.id ?? `name:${norm(name)}`, ingredientId: ing?.id ?? null, name: ing?.name ?? name, unit: ing?.unit ?? "" }
  }
  const out: PriceObservation[] = []

  for (const order of input.orders) {
    if (order.status === "cancelled") continue
    const date = order.date || order.createdAt || ""
    for (const item of order.items ?? []) {
      if (!(item.costPerUnit > 0)) continue
      const r = resolve(item.ingredientId, item.name)
      out.push({ ...r, unit: r.unit || item.unit, supplier: cleanSupplier(item.supplier) ?? cleanSupplier(order.supplier), pricePerUnit: item.costPerUnit, date, source: "order", quantity: item.quantityToBuy ?? item.totalQuantity ?? 0 })
    }
  }

  for (const snap of input.snapshots) {
    if (snap.type !== "purchase") continue
    for (const item of snap.items ?? []) {
      const pkg = item.priceAtDate ?? item.price
      if (!(pkg > 0)) continue
      const per = item.netContent && item.netContent > 0 ? pkg / item.netContent : pkg
      const r = resolve(item.id, item.name)
      const bought = (item.receivedSincePrevious ?? 0) > 0 ? item.receivedSincePrevious ?? 0 : item.quantity
      out.push({ ...r, unit: r.unit || item.unit, supplier: cleanSupplier(item.supplier), pricePerUnit: per, date: snap.date || snap.createdAt || "", source: "purchase", quantity: bought || 0 })
    }
  }

  for (const c of input.changes) {
    if (!(c.newPrice > 0)) continue
    const r = resolve(c.ingredientId, c.ingredientName)
    out.push({ ...r, supplier: null, pricePerUnit: c.newPrice, date: c.timestamp, source: "change", quantity: 0 })
  }

  const now = input.now ?? new Date().toISOString()
  for (const ing of input.ingredients) {
    const price = ing.pricing?.pricePerUnit
    if (!(price > 0) || ing.recipeId) continue // las sub-recetas no se compran
    out.push({ key: ing.id, ingredientId: ing.id, name: ing.name, unit: ing.unit, supplier: cleanSupplier(ing.supplier), pricePerUnit: price, date: ing.pricing?.lastUpdated || now, source: "current", quantity: 0 })
  }

  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export interface SupplierPrice {
  supplier: string
  lastPrice: number
  lastDate: string
  minPrice: number
  avgPrice: number
  count: number
  quantity: number
}

export interface IngredientPriceSummary {
  key: string
  ingredientId: string | null
  name: string
  unit: string
  /** Puntos del historial (fecha, precio), sin repetir el mismo precio del mismo día. */
  history: { date: string; price: number; supplier: string | null }[]
  firstPrice: number
  lastPrice: number
  changePercent: number
  /** Cambio en los últimos 30 días (null si no hay precio de antes). */
  change30Percent: number | null
  minPrice: number
  maxPrice: number
  currentSupplier: string | null
  suppliers: SupplierPrice[]
  /** Proveedor con el último precio más bajo (si hay 2 o más). */
  cheapest: SupplierPrice | null
  /** Cuánto más barato es el más barato que el proveedor actual (%), si lo hay. */
  savingPercent: number
  /** Ahorro estimado al mes comprando la misma cantidad al más barato. */
  monthlySaving: number
}

const DAY = 86_400_000

export function summarizeIngredients(obs: PriceObservation[], now = Date.now()): IngredientPriceSummary[] {
  const groups = new Map<string, PriceObservation[]>()
  for (const o of obs) {
    const list = groups.get(o.key)
    if (list) list.push(o)
    else groups.set(o.key, [o])
  }
  const result: IngredientPriceSummary[] = []
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const history: IngredientPriceSummary["history"] = []
    for (const o of sorted) {
      const day = o.date.slice(0, 10)
      const prev = history[history.length - 1]
      if (prev && prev.date.slice(0, 10) === day && Math.abs(prev.price - o.pricePerUnit) < 1e-9) continue
      history.push({ date: o.date, price: o.pricePerUnit, supplier: o.supplier })
    }
    const prices = history.map((h) => h.price)
    const first = prices[0]
    const last = prices[prices.length - 1]
    const before30 = [...history].reverse().find((h) => new Date(h.date).getTime() <= now - 30 * DAY)

    const bySupplier = new Map<string, PriceObservation[]>()
    for (const o of sorted) {
      if (!o.supplier || o.source === "change") continue
      const l = bySupplier.get(o.supplier)
      if (l) l.push(o)
      else bySupplier.set(o.supplier, [o])
    }
    const suppliers: SupplierPrice[] = Array.from(bySupplier.entries())
      .map(([supplier, l]) => {
        const lastObs = l[l.length - 1]
        const ps = l.map((x) => x.pricePerUnit)
        return {
          supplier,
          lastPrice: lastObs.pricePerUnit,
          lastDate: lastObs.date,
          minPrice: Math.min(...ps),
          avgPrice: ps.reduce((s, p) => s + p, 0) / ps.length,
          count: l.length,
          quantity: l.reduce((s, x) => s + (x.quantity || 0), 0),
        }
      })
      .sort((a, b) => a.lastPrice - b.lastPrice)

    const current = [...sorted].reverse().find((o) => o.source === "current") ?? sorted[sorted.length - 1]
    const currentSupplier = current?.supplier ?? null
    const currentPrice = currentSupplier ? suppliers.find((s) => s.supplier === currentSupplier)?.lastPrice ?? last : last
    const cheapest = suppliers.length >= 2 ? suppliers[0] : null
    const savingPercent = cheapest && currentPrice > 0 && cheapest.supplier !== currentSupplier && cheapest.lastPrice < currentPrice ? ((currentPrice - cheapest.lastPrice) / currentPrice) * 100 : 0
    // Cantidad comprada en los últimos 90 días ÷ 3 = consumo mensual aproximado.
    const qty90 = sorted.filter((o) => (o.source === "order" || o.source === "purchase") && new Date(o.date).getTime() >= now - 90 * DAY).reduce((s, o) => s + (o.quantity || 0), 0)
    const monthlySaving = savingPercent > 0 && cheapest ? ((currentPrice - cheapest.lastPrice) * qty90) / 3 : 0

    result.push({
      key,
      ingredientId: list[0].ingredientId,
      name: list[list.length - 1].name,
      unit: list[0].unit,
      history,
      firstPrice: first,
      lastPrice: last,
      changePercent: first > 0 ? ((last - first) / first) * 100 : 0,
      change30Percent: before30 && before30.price > 0 ? ((last - before30.price) / before30.price) * 100 : null,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      currentSupplier,
      suppliers,
      cheapest,
      savingPercent,
      monthlySaving,
    })
  }
  return result
}

export interface SupplierSummary {
  supplier: string
  ingredients: number
  /** Gasto en órdenes de compra no canceladas. */
  spend: number
  orders: number
  lastDate: string | null
  /** Ingredientes donde este proveedor tiene el precio más bajo. */
  cheapestFor: number
  /** Cambio promedio de sus precios (primer vs. último registro por ingrediente), %. */
  avgChangePercent: number
}

export function summarizeSuppliers(obs: PriceObservation[], orders: PurchaseOrder[], ingredients: IngredientPriceSummary[]): SupplierSummary[] {
  const map = new Map<string, { keys: Set<string>; spend: number; orders: Set<string>; last: string | null; changes: number[] }>()
  const get = (s: string) => {
    let e = map.get(s)
    if (!e) map.set(s, (e = { keys: new Set(), spend: 0, orders: new Set(), last: null, changes: [] }))
    return e
  }
  for (const o of obs) {
    if (!o.supplier || o.source === "change") continue
    const e = get(o.supplier)
    e.keys.add(o.key)
    if (o.source !== "current" && (!e.last || o.date > e.last)) e.last = o.date
  }
  for (const order of orders) {
    if (order.status === "cancelled") continue
    for (const item of order.items ?? []) {
      const s = cleanSupplier(item.supplier) ?? cleanSupplier(order.supplier)
      if (!s) continue
      const e = get(s)
      e.spend += item.purchaseCost || 0
      e.orders.add(order.id)
    }
  }
  const cheapestCount = new Map<string, number>()
  for (const ing of ingredients) {
    if (ing.cheapest) cheapestCount.set(ing.cheapest.supplier, (cheapestCount.get(ing.cheapest.supplier) || 0) + 1)
    for (const sp of ing.suppliers) {
      const firstObs = obs.find((o) => o.key === ing.key && o.supplier === sp.supplier && o.source !== "change")
      if (firstObs && firstObs.pricePerUnit > 0) map.get(sp.supplier)?.changes.push(((sp.lastPrice - firstObs.pricePerUnit) / firstObs.pricePerUnit) * 100)
    }
  }
  return Array.from(map.entries())
    .map(([supplier, e]) => ({
      supplier,
      ingredients: e.keys.size,
      spend: e.spend,
      orders: e.orders.size,
      lastDate: e.last,
      cheapestFor: cheapestCount.get(supplier) || 0,
      avgChangePercent: e.changes.length ? e.changes.reduce((s, c) => s + c, 0) / e.changes.length : 0,
    }))
    .sort((a, b) => b.spend - a.spend || b.ingredients - a.ingredients)
}
