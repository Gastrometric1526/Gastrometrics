/**
 * Un mes completo de un restaurante, de punta a punta (docs/328). Pedido del dueño, a partir de
 * una evaluación externa: «si un restaurante usa GastroMetrics 30 días y registra todo bien,
 * ¿podemos garantizar que los números de sus reportes representan fielmente lo que ocurrió?».
 *
 * La prueba arma noviembre de 2026 de una pizzería con las MISMAS funciones que usa la app:
 * - POS: cada cuenta se cobra con `buildPosSale` y se suma al día con `mergeSaleIntoDay`;
 * - compras recibidas (con una devolución), conteos, una pérdida registrada con `applyStockLoss`;
 * - stock teórico (`computeTheoreticalStock`), control de faltantes (`computeStockControl`);
 * - Finanzas cableado igual que components/estadisticas-finanzas-tab.tsx: platos
 *   (`aggregateSalesByDish`), venta neta, costo teórico, COGS, Prime Cost y P&L;
 * - historial por día (`aggregateSalesByPeriod`) y resumen de cuentas (`summarizeTickets`).
 *
 * Al lado, la «verdad» se calcula a mano, sin las funciones de la app, con lo que pasó en la
 * cocina. Si un día una función cambia y los reportes dejan de contar lo que pasó, esto falla.
 */

import { beforeEach, describe, expect, it } from "vitest"
import { buildPosSale, mergeSaleIntoDay } from "./pos"
import { summarizeTickets } from "./manual-sales"
import { applyStockLoss, lossesByReason } from "./stock-losses"
import { computeTheoreticalStock } from "./theoretical-stock"
import { computeStockControl } from "./stock-control"
import {
  aggregateSalesByDish,
  aggregateSalesByPeriod,
  buildSimplifiedPnL,
  computeCOGS,
  computePrimeCost,
  linkedContribution,
  periodsTotals,
  salesCoverage,
} from "./sales-analytics"
import { laborCostForFinance } from "./labor"
import { updateIngredientPriceAndRecalculate } from "./recalculate"
import { saveIngredients } from "./storage/ingredients"
import { getRecipes, saveRecipes } from "./storage/recipes"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { SalesImport } from "@/types/sales-import"
import type { PosOrder, PosOrderItem } from "@/types/pos"
import type { StaffShift } from "./labor"

// ───────────────────────── El negocio ─────────────────────────
// Harina: saco de 25 000 g a 500 → 0.02 por g. Queso: bloque de 5 000 g a 600 → 0.12 por g.
// Tomate: caja de 10 000 g a 300 (0.03 por g físico) con 20 % de merma → 8 000 g útiles → 0.0375.
// Salsa (subreceta): 4 000 g útiles de tomate rinden 5 000 g → 150 → 0.03 por g.
// Pizza: 250 g harina (5) + 150 g salsa (4.50) + 120 g queso (14.40) = 23.90. Precio 115 con ISV 15 %.
// Agua: 20, sin receta (venta sin vincular).
const PIZZA_COST = 23.9
const PIZZA_PRICE = 115

const ing = (id: string, name: string, purchasePrice: number, netContent: number, extra: Partial<Ingredient> = {}): Ingredient =>
  ({
    id,
    name,
    category: "OTROS",
    unit: "gramos",
    supplier: "",
    pricing: { purchasePrice, netContent, pricePerUnit: purchasePrice / netContent, lastUpdated: "2026-11-01T00:00:00" },
    metadata: { createdAt: "2026-10-01T00:00:00", updatedAt: "2026-10-01T00:00:00", version: 1 },
    ...extra,
  }) as unknown as Ingredient

const harina = ing("harina", "Harina", 500, 25000)
const queso = ing("queso", "Queso", 600, 5000)
const tomate = ing("tomate", "Tomate", 300, 8000, {
  originalNetContent: 10000,
  merma: { enabled: true, useGlobal: false, globalPercentage: 0, customType: "percentage", customPercentage: 20, customValue: 0 },
})
const salsaIng = ing("salsa-ing", "Salsa base", 150, 5000, { recipeId: "salsa", category: "Sub Receta / produccion (Mise en place)" as never })
const ingredients = [harina, queso, tomate, salsaIng]

const salsa = {
  id: "salsa",
  name: "Salsa base",
  classification: "Sub Receta / produccion (Mise en place)",
  isSubRecipe: true,
  yieldAmount: 5000,
  yieldUnit: "g",
  totalCost: 150,
  costPerServing: 0.03,
  ingredients: [{ id: "s1", ingredientId: "tomate", quantity: 4000 }],
} as unknown as Recipe
const pizza = {
  id: "pizza",
  name: "Pizza",
  classification: "Platos fuertes",
  yieldAmount: 1,
  yieldUnit: "un",
  pricingMethod: "food_cost",
  targetFoodCostPercent: 25,
  isv: 15,
  customUnitPrice: PIZZA_PRICE,
  unitPrice: PIZZA_PRICE,
  totalCost: PIZZA_COST,
  costPerServing: PIZZA_COST,
  ingredients: [
    { id: "p1", ingredientId: "harina", quantity: 250 },
    { id: "p2", ingredientId: "salsa-ing", quantity: 150 },
    { id: "p3", ingredientId: "queso", quantity: 120 },
  ],
} as unknown as Recipe
const recipes = [salsa, pizza]

// Productos del inventario: el id es el del ingrediente; precio y contenido del envase físico.
const item = (id: string, name: string, price: number, netContent: number): InventoryItem =>
  ({ id, name, category: "OTROS", currentStock: 0, minStock: 0, unit: "gramos", price, netContent, lastUpdated: "", status: "normal" }) as InventoryItem

// ───────────────────────── Noviembre ─────────────────────────
const day = (d: number) => `2026-11-${String(d).padStart(2, "0")}`
// Momentos en hora LOCAL (sin «Z»), como los guarda el aparato de la persona.
const at = (d: number, hhmm: string) => `${day(d)}T${hhmm}:00`
const pizzasOn = (d: number) => 10 + (d % 5) // 10 a 14 por día → 360 en el mes

type Month = {
  sales: SalesImport[]
  orders: PurchaseOrder[]
  items: InventoryItem[]
  snapshots: InventorySnapshot[]
  shifts: StaffShift[]
  tickets: number
}

const order = (id: string, d: number, ingredientId: string, name: string, quantity: number, unitCost: number): PurchaseOrder =>
  ({
    id,
    name: id,
    number: 1,
    date: day(d),
    recipes: [],
    items: [{ id: `${id}-1`, ingredientId, name, totalQuantity: quantity, unit: "gramos", costPerUnit: unitCost, purchaseCost: quantity * unitCost, quantityToBuy: quantity, supplier: "" }],
    subtotal: quantity * unitCost,
    tax: 0,
    total: quantity * unitCost,
    status: "received",
    receivedAt: at(d, "10:00"),
  }) as unknown as PurchaseOrder

/**
 * Arma el mes. `unrecordedQueso` = gramos de queso que desaparecen sin que nadie los registre;
 * `finalCountAt` = hora del conteo del último día.
 */
function buildMonth(opts: { unrecordedQueso?: number; finalCountAt?: string } = {}): Month {
  // POS: cuentas de 2 pizzas (la última con 1 si son impares) y una cuenta con un agua.
  // Propina de 10 por cuenta. Los días 7, 14, 21 y 28, la primera cuenta tiene 10 % de descuento (23).
  const sales: SalesImport[] = []
  let tickets = 0
  for (let d = 1; d <= 30; d++) {
    let dayImport: SalesImport | null = null
    const charge = (items: Omit<PosOrderItem, "seat" | "extras" | "note" | "status" | "sentAt" | "readyAt">[], discount: number, n: number) => {
      const posOrder = {
        id: `o-${d}-${n}`,
        tableId: null,
        tableLabel: `Mesa ${n}`,
        areaName: null,
        channel: "dine_in",
        guests: 2,
        waiter: "Ana",
        openedAt: at(d, "12:00"),
        status: "bill",
        items: items.map((i) => ({ ...i, seat: null, extras: [], note: null, status: "served", sentAt: null, readyAt: null })),
        updatedAt: at(d, "12:30"),
      } as PosOrder
      const sale = buildPosSale(posOrder, { seats: null, payment: n % 2 ? "cash" : "card", discount, tip: 10 }, recipes, day(d), `t-${d}-${n}`, new Date(at(d, "13:00")))
      dayImport = mergeSaleIntoDay(dayImport, sale, { id: `day-${d}`, businessId: "main", isoDate: day(d), fileName: "POS", now: new Date(at(d, "13:00")) })
      tickets++
    }
    let left = pizzasOn(d)
    let n = 1
    while (left > 0) {
      const q = Math.min(2, left)
      const discount = n === 1 && d % 7 === 0 ? 23 : 0
      charge([{ id: `i-${d}-${n}`, sourceType: "recipe", refId: "pizza", name: "Pizza", quantity: q, unitPrice: PIZZA_PRICE, unitCost: PIZZA_COST }], discount, n)
      left -= q
      n++
    }
    charge([{ id: `a-${d}`, sourceType: "recipe", refId: "", name: "Agua", quantity: 1, unitPrice: 20, unitCost: 0 }], 0, n)
    sales.push(dayImport as unknown as SalesImport)
  }

  // Compras recibidas: harina días 5, 12 y 19; tomate 3, 9, 15, 21 y 27; queso 2, 6, 10, 14, 18, 22, 26 y 29.
  const orders: PurchaseOrder[] = [
    ...[5, 12, 19].map((d) => order(`H${d}`, d, "harina", "Harina", 25000, 0.02)),
    ...[3, 9, 15, 21, 27].map((d) => order(`T${d}`, d, "tomate", "Tomate", 10000, 0.03)),
    ...[2, 6, 10, 14, 18, 22, 26, 29].map((d) => order(`Q${d}`, d, "queso", "Queso", 5000, 0.12)),
  ]
  // El día 16 se devuelven 2 000 g de tomate dañado de la caja del 15.
  const t15 = orders.find((o) => o.id === "T15") as PurchaseOrder
  t15.returns = [{ id: "dev", at: at(16, "09:00"), reason: "damaged", lines: [{ key: "T15-1", quantity: 2000, unitCost: 0.03 }] }] as never

  // Inventario: lo recibido entra al stock de cada producto; la devolución, en negativo.
  const items = [item("harina", "Harina", 500, 25000), item("tomate", "Tomate", 300, 10000), item("queso", "Queso", 600, 5000)]
  for (const o of orders) {
    const it = items.find((i) => i.id === o.items[0].ingredientId) as InventoryItem
    it.stockReceipts = [...(it.stockReceipts ?? []), { quantity: o.items[0].totalQuantity, at: o.receivedAt as string }]
  }
  items[1].stockReceipts!.push({ quantity: -2000, at: at(16, "09:00"), kind: "return" })

  // El día 20 se derraman 300 g de queso y se registran como pérdida.
  const quesoItem = items[2]
  quesoItem.currentStock = 5000
  const loss = applyStockLoss(quesoItem, { quantity: 300, reason: "spill", at: at(20, "15:00") })
  quesoItem.stockLosses = loss?.stockLosses

  // Conteo inicial (1 de noviembre, 7:00) y final (30 de noviembre).
  const opening = { harina: 20000, tomate: 8000, queso: 6000 }
  const closing = closingStock(opts.unrecordedQueso ?? 0)
  const snapshot = (date: string, q: Record<string, number>, withLosses: boolean): InventorySnapshot =>
    ({
      id: date,
      date,
      type: "final",
      modifiedItems: 3,
      totalValue: 0,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        category: "OTROS",
        quantity: q[i.id],
        unit: "gramos",
        price: i.price,
        netContent: i.netContent,
        totalPrice: 0,
        receivedSincePrevious: withLosses ? (i.stockReceipts ?? []).reduce((s, r) => s + r.quantity, 0) : 0,
        ...(withLosses ? { lostSincePrevious: lossesByReason(i.stockLosses) } : {}),
      })),
    }) as unknown as InventorySnapshot
  const snapshots = [snapshot(at(1, "07:00"), opening, false), snapshot(opts.finalCountAt ?? at(30, "23:00"), closing, true)]

  // Personal: 1 persona, 8 h a 50 por hora, los 30 días → 12 000.
  const shifts: StaffShift[] = Array.from({ length: 30 }, (_, k) => ({ id: `s${k}`, staffId: "ana", date: day(k + 1), start: "10:00", end: "18:00", hours: 8, rate: 50 }))

  return { sales, orders, items, snapshots, shifts, tickets }
}

// ───────────────────────── La verdad, a mano ─────────────────────────
// 360 pizzas: harina 360 × 250 = 90 000 g; queso 360 × 120 = 43 200 g; tomate: 150 g de salsa
// son 120 g útiles = 150 g físicos → 54 000 g.
const PIZZAS = 360
const USED = { harina: PIZZAS * 250, queso: PIZZAS * 120, tomate: PIZZAS * 150 }
const BOUGHT = { harina: 3 * 25000, tomate: 5 * 10000 - 2000, queso: 8 * 5000 }
const OPENING = { harina: 20000, tomate: 8000, queso: 6000 }
const SPILLED = 300
function closingStock(unrecordedQueso: number) {
  return {
    harina: OPENING.harina + BOUGHT.harina - USED.harina, // 5 000
    tomate: OPENING.tomate + BOUGHT.tomate - USED.tomate, // 2 000
    queso: OPENING.queso + BOUGHT.queso - USED.queso - SPILLED - unrecordedQueso, // 2 500
  }
}
const PRICE_PER_G = { harina: 0.02, tomate: 0.03, queso: 0.12 }
const valueOf = (q: Record<string, number>) => q.harina * PRICE_PER_G.harina + q.tomate * PRICE_PER_G.tomate + q.queso * PRICE_PER_G.queso

const DISCOUNTS = 4 * 23
const PIZZA_REVENUE = PIZZAS * PIZZA_PRICE - DISCOUNTS // 41 308
const PIZZA_NET = PIZZA_REVENUE / 1.15 // 35 920
const WATER = 30 * 20 // 600
const NET_REVENUE = PIZZA_NET + WATER // 36 520
const THEORETICAL_COST = PIZZAS * PIZZA_COST // 8 604
const LABOR = 30 * 8 * 50 // 12 000
const RENT = 6000

// Finanzas, cableado igual que la pantalla (components/estadisticas-finanzas-tab.tsx).
function finance(m: Month) {
  const dishes = aggregateSalesByDish(m.sales, recipes, [])
  const totalRevenue = dishes.reduce((s, d) => s + d.revenue, 0)
  const totalTax = dishes.reduce((s, d) => s + (d.tax || 0), 0)
  const netRevenue = totalRevenue - totalTax
  const totalTheoreticalCost = dishes.reduce((s, d) => s + d.theoreticalCost, 0)
  const linked = linkedContribution(dishes)
  const period = { start: new Date("2026-11-01").toISOString(), end: new Date("2026-11-30").toISOString() }
  const cogs = computeCOGS({ snapshots: m.snapshots, purchaseOrders: m.orders, periodStart: period.start, periodEnd: period.end, currentInventoryValue: 0 })
  const labor = laborCostForFinance(m.shifts, period.start, period.end, 0)
  const pnl = buildSimplifiedPnL({
    revenue: netRevenue,
    cogs: cogs.cogs,
    expenses: { rent: RENT, utilities: 0, operationalCosts: 0, marketing: 0, laborCosts: 0, otherExpenses: 0 },
    periodStart: period.start,
    periodEnd: period.end,
    ...(labor.fromShifts ? { laborCostOverride: labor.cost } : {}),
  })
  return {
    dishes,
    totalRevenue,
    netRevenue,
    totalTheoreticalCost,
    linked,
    cogs,
    labor,
    pnl,
    prime: computePrimeCost(cogs.cogs, labor.cost, netRevenue),
    theoreticalPercent: linked.netRevenue > 0 ? (totalTheoreticalCost / linked.netRevenue) * 100 : 0,
    realPercent: netRevenue > 0 ? (cogs.cogs / netRevenue) * 100 : 0,
  }
}

describe("Un mes de una pizzería, de punta a punta (docs/328)", () => {
  describe("1. Todo registrado: los reportes cuentan exactamente lo que pasó", () => {
    const m = buildMonth()
    const f = finance(m)

    it("ventas: 360 pizzas y 30 aguas; la propina no es venta y el descuento sí resta", () => {
      const p = f.dishes.find((d) => d.recipeId === "pizza")!
      expect(p.quantitySold).toBe(PIZZAS)
      expect(p.revenue).toBeCloseTo(PIZZA_REVENUE, 6)
      expect(f.totalRevenue).toBeCloseTo(PIZZA_REVENUE + WATER, 6)
      const s = summarizeTickets(m.sales)
      expect(s.tips).toBeCloseTo(m.tickets * 10, 6) // las propinas se ven aparte, no en la venta
    })

    it("venta neta sin ISV = 41 308 ÷ 1.15 + 600 = 36 520; el agua sin receta queda fuera del costo teórico", () => {
      expect(f.netRevenue).toBeCloseTo(NET_REVENUE, 6)
      expect(f.linked.netRevenue).toBeCloseTo(PIZZA_NET, 6)
      expect(salesCoverage(f.dishes).unlinkedNetRevenue).toBeCloseTo(WATER, 6)
    })

    it("costo teórico = 360 × 23.90 = 8 604; food cost teórico 8 604 ÷ 35 920 = 23.95 %", () => {
      expect(f.totalTheoreticalCost).toBeCloseTo(THEORETICAL_COST, 6)
      expect(f.theoreticalPercent).toBeCloseTo((THEORETICAL_COST / PIZZA_NET) * 100, 6)
    })

    it("compras = recibido − devuelto = 7 800 − 60 = 7 740", () => {
      expect(f.cogs.grossPurchasesValue).toBeCloseTo(1500 + 1500 + 4800, 6)
      expect(f.cogs.returnsValue).toBeCloseTo(60, 6)
      expect(f.cogs.purchasesValue).toBeCloseTo(7740, 6)
    })

    it("stock teórico al final = lo que de verdad quedó, producto por producto", () => {
      const th = computeTheoreticalStock({ items: m.items, snapshots: [m.snapshots[0]], salesImports: m.sales, recipes, ingredients, menus: [] })
      const truth = closingStock(0)
      for (const id of ["harina", "tomate", "queso"] as const) {
        expect(th.get(id)?.consumed, id).toBeCloseTo(USED[id], 6)
        expect(th.get(id)?.theoretical, id).toBeCloseTo(truth[id], 6)
      }
      expect(th.get("queso")?.lost).toBe(SPILLED)
    })

    it("el conteo final cuadra: diferencia 0 en todo y ningún faltante; la pérdida registrada se explica sola", () => {
      const th = computeTheoreticalStock({ items: m.items.map((i) => ({ ...i, stockLosses: [] })), snapshots: m.snapshots, salesImports: m.sales, recipes, ingredients, menus: [] })
      for (const id of ["harina", "tomate", "queso"]) expect(th.get(id)?.lastCountVariance, id).toBeCloseTo(0, 6)
      expect(th.get("queso")?.lastCountLost).toBe(SPILLED)
      const control = computeStockControl(m.items.map((i) => ({ ...i, stockLosses: [] })), th)
      expect(control.shortageValue).toBeCloseTo(0, 6)
      expect(control.surplusValue).toBeCloseTo(0, 6)
    })

    it("COGS = inicial 1 360 + compras 7 740 − final 460 = 8 640 = costo teórico 8 604 + pérdida registrada 36", () => {
      expect(f.cogs.initialInventoryValue).toBeCloseTo(valueOf(OPENING), 6)
      expect(f.cogs.finalInventoryValue).toBeCloseTo(valueOf(closingStock(0)), 6)
      expect(f.cogs.cogs).toBeCloseTo(8640, 6)
      // La identidad que responde la pregunta: lo que dice el COGS es lo que se gastó de verdad.
      expect(f.cogs.cogs).toBeCloseTo(THEORETICAL_COST + SPILLED * PRICE_PER_G.queso, 6)
      expect(f.cogs.hasFullData).toBe(true)
    })

    it("food cost real 8 640 ÷ 36 520; Prime Cost (8 640 + 12 000) ÷ 36 520; P&L 36 520 − 8 640 − 12 000 − 6 000 = 9 880", () => {
      expect(f.realPercent).toBeCloseTo((8640 / NET_REVENUE) * 100, 6)
      expect(f.labor).toEqual({ cost: LABOR, fromShifts: true })
      expect(f.prime.primeCost).toBeCloseTo(8640 + LABOR, 6)
      expect(f.prime.primeCostPercent).toBeCloseTo(((8640 + LABOR) / NET_REVENUE) * 100, 6)
      expect(f.pnl.rent).toBeCloseTo(RENT, 6)
      expect(f.pnl.netProfit).toBeCloseTo(NET_REVENUE - 8640 - LABOR - RENT, 6)
      expect(f.pnl.netProfit).toBeCloseTo(9880, 6)
    })

    it("el historial por día suma lo mismo que Finanzas (30 días)", () => {
      const days = aggregateSalesByPeriod(m.sales, recipes, [], "day")
      expect(days.length).toBe(30)
      const totals = periodsTotals(days)
      expect(totals.revenue).toBeCloseTo(f.totalRevenue, 6)
      expect(totals.marginPercent).toBeCloseTo(f.linked.contributionMarginPercent, 6)
    })
  })

  describe("2. Faltante sin registrar: el reporte lo muestra, con su valor", () => {
    // 200 g de queso desaparecen sin registro: el conteo final dice 2 300, no 2 500.
    const m = buildMonth({ unrecordedQueso: 200 })
    const f = finance(m)
    it("el conteo marca −200 g de queso y un faltante de 200 × 0.12 = 24", () => {
      const items = m.items.map((i) => ({ ...i, stockLosses: [] }))
      const th = computeTheoreticalStock({ items, snapshots: m.snapshots, salesImports: m.sales, recipes, ingredients, menus: [] })
      expect(th.get("queso")?.lastCountVariance).toBeCloseTo(-200, 6)
      expect(th.get("harina")?.lastCountVariance).toBeCloseTo(0, 6)
      expect(computeStockControl(items, th).shortageValue).toBeCloseTo(24, 6)
    })
    it("el COGS sube exactamente lo que vale el faltante: 8 640 + 24 = 8 664", () => {
      expect(f.cogs.cogs).toBeCloseTo(8664, 6)
      expect(f.cogs.cogs - THEORETICAL_COST - SPILLED * PRICE_PER_G.queso).toBeCloseTo(24, 6)
    })
  })

  describe("3. Conteo a las 8 p. m. del último día (hora de Centroamérica)", () => {
    it("cuenta en noviembre: antes se comparaba en UTC y quedaba en diciembre (docs/328)", () => {
      const m = buildMonth({ finalCountAt: at(30, "20:00") })
      const f = finance(m)
      expect(f.cogs.hasFullData).toBe(true)
      expect(f.cogs.cogs).toBeCloseTo(8640, 6)
    })
    it("una compra recibida a las 8 p. m. del 31 de octubre es de octubre, no de noviembre", () => {
      const m = buildMonth()
      const late = { ...order("OCT", 1, "queso", "Queso", 5000, 0.12), date: "2026-10-31", receivedAt: "2026-10-31T20:00:00" } as PurchaseOrder
      const f = finance({ ...m, orders: [...m.orders, late] })
      expect(f.cogs.purchasesValue).toBeCloseTo(7740, 6)
    })
  })
})

describe("4. Cambio de precio a mitad de mes, a través de la subreceta (docs/328)", () => {
  const businessId = "mes-de-prueba"
  beforeEach(() => {
    localStorage.clear()
    saveIngredients(ingredients.map((i) => structuredClone(i)), businessId)
    saveRecipes(recipes.map((r) => structuredClone(r)), businessId)
  })

  it("la caja de tomate sube de 300 a 360: salsa 0.036 por g y pizza 24.80; el precio nunca baja", async () => {
    await updateIngredientPriceAndRecalculate(businessId, "tomate", 360)
    const after = getRecipes(businessId)
    const s = after.find((r) => r.id === "salsa")!
    const p = after.find((r) => r.id === "pizza")!
    // 360 ÷ 8 000 g útiles = 0.045; salsa 4 000 × 0.045 = 180 → 0.036 por g.
    expect(s.totalCost).toBeCloseTo(180, 6)
    // 250 × 0.02 + 150 × 0.036 + 120 × 0.12 = 5 + 5.4 + 14.4 = 24.80.
    expect(p.costPerServing).toBeCloseTo(24.8, 6)
    expect(p.customUnitPrice ?? p.unitPrice).toBeGreaterThanOrEqual(PIZZA_PRICE)
  })

  it("las ventas después del cambio llevan el costo nuevo; las de antes conservan el suyo", async () => {
    await updateIngredientPriceAndRecalculate(businessId, "tomate", 360)
    const newPizza = getRecipes(businessId).find((r) => r.id === "pizza")!
    const sell = (d: number, cost: number) => {
      const o = {
        id: `o${d}`, tableId: null, tableLabel: "Mesa", areaName: null, channel: "dine_in", guests: 1, waiter: null, openedAt: at(d, "12:00"), status: "bill", updatedAt: at(d, "12:00"),
        items: [{ id: `i${d}`, sourceType: "recipe", refId: "pizza", name: "Pizza", seat: null, quantity: 10, unitPrice: PIZZA_PRICE, unitCost: cost, extras: [], note: null, status: "served", sentAt: null, readyAt: null }],
      } as PosOrder
      return mergeSaleIntoDay(null, buildPosSale(o, { seats: null, payment: "cash", discount: 0, tip: 0 }, [], day(d), `t${d}`, new Date(at(d, "13:00"))), { id: `d${d}`, businessId, isoDate: day(d), fileName: "POS" })
    }
    const dishes = aggregateSalesByDish([sell(10, PIZZA_COST), sell(20, newPizza.costPerServing as number)], [newPizza], [])
    expect(dishes[0].theoreticalCost).toBeCloseTo(10 * 23.9 + 10 * 24.8, 6)
  })
})
