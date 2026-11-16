/**
 * Pronóstico de ventas y presupuesto del mes (docs/322).
 *
 * Pronóstico (el método que enseñan los libros para un negocio pequeño: promedio del mismo día
 * de la semana):
 *   venta esperada del lunes = promedio de la venta de los últimos lunes con ventas (hasta 4)
 *   platos esperados del lunes = promedio, plato por plato, de esos mismos lunes
 * Un día sin ninguna venta registrada no cuenta (se toma como cerrado o sin registrar).
 * La venta es la de la carta (lo que paga el cliente), igual que en el Panorama de Reportes.
 *
 * Presupuesto: metas del mes (venta, costo de comida %, personal y otros gastos) contra lo
 * que va del mes y la proyección al cierre:
 *   proyección = lo que va ÷ días que van × días del mes
 */

import type { SalesImport } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"
import { menuItemShares } from "@/lib/menu-shares"
import { recipeBaseYield } from "@/lib/recipe-consumption"

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Día local «AAAA-MM-DD» de una fecha guardada (mismo criterio que lib/theoretical-stock.ts). */
export function dayOf(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Día de la semana (0 = domingo) de «AAAA-MM-DD», sin desfase de zona horaria. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number)
  const dt = new Date(y, m - 1, d + n)
  const p = (x: number) => String(x).padStart(2, "0")
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

export interface DayItem {
  key: string
  recipeId: string | null
  menuId: string | null
  name: string
  quantity: number
}

export interface DaySales {
  day: string
  revenue: number
  items: Map<string, DayItem>
}

/** Ventas agrupadas por día local, con la cantidad de cada plato o menú. */
export function salesByDay(imports: SalesImport[]): Map<string, DaySales> {
  const out = new Map<string, DaySales>()
  for (const imp of imports) {
    for (const line of imp.lines ?? []) {
      if (!(line.quantity > 0)) continue
      const day = dayOf(line.date || imp.periodEnd || imp.importedAt)
      let entry = out.get(day)
      if (!entry) {
        entry = { day, revenue: 0, items: new Map() }
        out.set(day, entry)
      }
      entry.revenue += line.revenue || 0
      const key = line.menuId ? `m:${line.menuId}` : line.recipeId ? `r:${line.recipeId}` : `n:${(line.rawDishName || "").trim().toLowerCase()}`
      const item = entry.items.get(key)
      if (item) item.quantity += line.quantity
      else entry.items.set(key, { key, recipeId: line.menuId ? null : line.recipeId ?? null, menuId: line.menuId ?? null, name: line.rawDishName || "", quantity: line.quantity })
    }
  }
  return out
}

export interface ForecastDay {
  day: string
  weekday: number
  /** Días de la historia que se promediaron (mismo día de la semana, con ventas). */
  basis: { day: string; revenue: number }[]
  revenue: number
  items: DayItem[]
}

/**
 * Pronóstico de los próximos `horizon` días desde `today` (incluido), con los últimos `weeks`
 * días iguales de la semana que tuvieron ventas, sin contar hoy.
 */
export function forecastSales(imports: SalesImport[], today: string, opts: { horizon?: number; weeks?: number } = {}): ForecastDay[] {
  const horizon = opts.horizon ?? 7
  const weeks = opts.weeks ?? 4
  const byDay = salesByDay(imports)
  const days: ForecastDay[] = []
  for (let i = 0; i < horizon; i++) {
    const day = addDays(today, i)
    const weekday = weekdayOf(day)
    const basis: DaySales[] = []
    // Hasta 12 semanas atrás buscando los `weeks` días iguales con ventas.
    for (let w = 1; w <= 12 && basis.length < weeks; w++) {
      const past = addDays(day, -7 * w)
      if (past >= today) continue
      const s = byDay.get(past)
      if (s && s.revenue > 0) basis.push(s)
    }
    const n = basis.length
    const items = new Map<string, DayItem>()
    for (const s of basis) {
      for (const it of s.items.values()) {
        const prev = items.get(it.key)
        if (prev) prev.quantity += it.quantity
        else items.set(it.key, { ...it })
      }
    }
    days.push({
      day,
      weekday,
      basis: basis.map((b) => ({ day: b.day, revenue: r2(b.revenue) })),
      revenue: n > 0 ? r2(basis.reduce((s, b) => s + b.revenue, 0) / n) : 0,
      items: n > 0 ? [...items.values()].map((it) => ({ ...it, quantity: Math.round((it.quantity / n) * 100) / 100 })).sort((a, b) => b.quantity - a.quantity) : [],
    })
  }
  return days
}

/**
 * Cuántas veces hay que hacer cada receta para lo pronosticado (para la orden de compra):
 * platos ÷ rendimiento de la receta; un menú reparte sus platos con `menuItemShares`
 * (docs/314), igual que el inventario teórico.
 */
export function forecastRecipeMultipliers(days: ForecastDay[], recipes: Recipe[], menus: Menu[]): Record<string, number> {
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const menusById = new Map(menus.map((m) => [m.id, m]))
  const out: Record<string, number> = {}
  const add = (recipeId: string, portions: number) => {
    const recipe = recipesById.get(recipeId)
    if (!recipe || !(portions > 0)) return
    out[recipeId] = (out[recipeId] || 0) + portions / recipeBaseYield(recipe)
  }
  for (const d of days) {
    for (const it of d.items) {
      if (it.menuId) {
        const menu = menusById.get(it.menuId)
        for (const share of menu ? menuItemShares(menu) : []) add(share.recipeId, it.quantity * share.share)
      } else if (it.recipeId) add(it.recipeId, it.quantity)
    }
  }
  return out
}

// ============== PRESUPUESTO DEL MES ==============

export interface MonthlyBudget {
  /** Venta del mes (lo que pagan los clientes). */
  sales: number
  /** Costo de comida y bebida objetivo, en % de la venta. */
  foodCostPercent: number
  /** Personal del mes. */
  labor: number
  /** Renta, servicios y demás gastos del mes. */
  otherExpenses: number
}

export interface BudgetLine {
  budget: number
  actual: number
  /** actual ÷ días transcurridos × días del mes. */
  projected: number
  /** projected − budget (positivo = por encima del presupuesto). */
  projectedDiff: number
  /** actual ÷ budget × 100. */
  usedPercent: number
}

export function monthDays(day: string): { start: string; daysInMonth: number; elapsed: number } {
  const [y, m, d] = day.split("-").map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  return { start: `${y}-${String(m).padStart(2, "0")}-01`, daysInMonth, elapsed: d }
}

export function budgetLine(budget: number, actual: number, elapsed: number, daysInMonth: number): BudgetLine {
  const projected = elapsed > 0 ? (actual / elapsed) * daysInMonth : 0
  return {
    budget: r2(budget),
    actual: r2(actual),
    projected: r2(projected),
    projectedDiff: r2(projected - budget),
    usedPercent: budget > 0 ? r2((actual / budget) * 100) : 0,
  }
}

/** Presupuesto de costo de comida en dinero = venta presupuestada × % objetivo. */
export function budgetFoodCost(b: MonthlyBudget): number {
  return r2((b.sales * b.foodCostPercent) / 100)
}

export function isMonthlyBudget(v: unknown): v is MonthlyBudget {
  if (!v || typeof v !== "object") return false
  const b = v as Record<string, unknown>
  return ["sales", "foodCostPercent", "labor", "otherExpenses"].every((k) => typeof b[k] === "number" && (b[k] as number) >= 0)
}
