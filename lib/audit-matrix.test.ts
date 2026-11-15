/**
 * Matriz de pruebas matemáticas de la auditoría (docs/306).
 *
 * Cada `it` es una fila de la matriz: ID, fórmula esperada, datos de entrada y resultado
 * calculado a mano (en los comentarios). El criterio de aprobación es la igualdad exacta o a
 * 1e-9, salvo donde se indica. Todas las filas usan el mismo negocio de ejemplo, «Pizzería
 * de prueba», para que los números encadenen de un módulo al siguiente:
 *
 *   ingrediente con merma → subreceta → receta → precio → venta → consumo → compra → COGS → P&L
 *
 * Si una fila falla, la corrección rompió un número que ya estaba bien (o al revés): la
 * matriz se actualiza solo si el dueño cambia la regla, nunca para que la prueba pase.
 */
import { describe, expect, it } from "vitest"
import { usableContentAfterMerma } from "./merma-categories"
import { foodCostBasePrice, coverCommission, taxIncludedIn } from "./food-cost-pricing"
import { suggestedUnitPrice, unitMarginPercent, applyPriceRule } from "./recipe-pricing"
import { accumulateRecipeConsumption, indexById, mermaGrossFactor, type ConsumptionMap } from "./recipe-consumption"
import { buildImportLines, emptyTicket } from "./manual-sales"
import {
  aggregateSalesByDish,
  linkedContribution,
  salesCoverage,
  computeCOGS,
  computePrimeCost,
  computeVariance,
  buildSimplifiedPnL,
  classifyMenuEngineering,
  menuEngineeringThresholds,
  aggregateSalesByPeriod,
  periodsTotals,
} from "./sales-analytics"
import { computeWeightedAverageCost } from "./utils/weighted-average-cost"
import { convertBetweenUnits } from "./utils/calculations"
import { crossesMassVolume } from "./unit-change"
import { paxMultiplierFor, roundUpToStep } from "./pax-scaling"
import { roundSalePrice } from "./price-rounding"
import { fallbackYield } from "./yield-weight"
import { stockStatus, effectiveStockStatus } from "./inventory-status"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { SalesImport } from "@/types/sales-import"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"

// ---------- Negocio de ejemplo ----------
// Harina: saco de 1 000 g a 100 → 0.10 por gramo, sin merma.
// Tomate: caja de 1 000 g a 50 con 20 % de merma → 800 g aprovechables → 0.0625 por gramo.
// Salsa (subreceta): 400 g de tomate rinden 500 g → costo 25 → 0.05 por gramo.
// Pizza: 200 g de harina (20) + 100 g de salsa (5) = 25 por porción. Food Cost 25 %, ISV 15 %, comisión 10 %.
const harina = { id: "harina", name: "Harina", category: "OTROS", unit: "gramos", pricing: { purchasePrice: 100, netContent: 1000, pricePerUnit: 0.1 } } as unknown as Ingredient
const tomate = {
  id: "tomate", name: "Tomate", category: "VERDURAS", unit: "gramos", originalNetContent: 1000,
  pricing: { purchasePrice: 50, netContent: 800, pricePerUnit: 0.0625 },
} as unknown as Ingredient
const salsaIng = { id: "salsa-ing", name: "Salsa", category: "SUBRECETAS", unit: "gramos", recipeId: "salsa", pricing: { purchasePrice: 25, netContent: 500, pricePerUnit: 0.05 } } as unknown as Ingredient
const recipe = (over: Partial<Recipe>): Recipe => ({ id: "r", name: "r", yieldAmount: 1, ingredients: [], totalCost: 0, ...over }) as unknown as Recipe
const salsa = recipe({ id: "salsa", name: "Salsa", yieldAmount: 500, ingredients: [{ id: "l1", ingredientId: "tomate", quantity: 400 }] as Recipe["ingredients"] })
const pizza = recipe({
  id: "pizza", name: "Pizza", yieldAmount: 1, pricingMethod: "food_cost", targetFoodCostPercent: 25, isv: 15, salesCommissionPercent: 10,
  ingredients: [
    { id: "l1", ingredientId: "harina", quantity: 200 },
    { id: "l2", ingredientId: "salsa-ing", quantity: 100 },
  ] as Recipe["ingredients"],
})
const recipesById = indexById([salsa, pizza])
const ingredientsById = indexById([harina, tomate, salsaIng])
const USD = { currencyCode: "USD" }

describe("A. Ingredientes y merma", () => {
  it("A-01 · Precio por unidad aprovechable = precio ÷ (contenido × (1 − merma)) → 50 ÷ 800 = 0.0625", () => {
    const usable = usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "percentage", customPercentage: 20 }, "VERDURAS")
    expect(usable).toBe(800)
    expect(50 / usable).toBe(0.0625)
  })
  it("A-02 · Factor bruto = contenido original ÷ aprovechable → 1 000 ÷ 800 = 1.25", () => {
    expect(mermaGrossFactor(tomate)).toBe(1.25)
    expect(mermaGrossFactor(harina)).toBe(1)
  })
  it("A-03 · Conversión exacta: 1 kg = 2.20462 lb; peso ⇄ volumen se marca (1 L = 1 kg solo para el agua)", () => {
    expect(convertBetweenUnits(1, "kilogramos", "libras")).toBeCloseTo(2.20462, 5)
    expect(convertBetweenUnits(1, "libras", "gramos")).toBeCloseTo(453.59237, 5)
    expect(crossesMassVolume("litros", "kilogramos")).toBe(true)
    expect(crossesMassVolume("kilogramos", "gramos")).toBe(false)
  })
})

describe("B. Ficha Técnica y precio", () => {
  it("B-01 · Costo de la subreceta = 400 × 0.0625 = 25; por gramo 25 ÷ 500 = 0.05", () => {
    expect(400 * 0.0625).toBe(25)
    expect(25 / salsa.yieldAmount).toBe(0.05)
  })
  it("B-02 · Costo de la pizza = 200 × 0.10 + 100 × 0.05 = 25", () => {
    expect(200 * 0.1 + 100 * 0.05).toBeCloseTo(25, 9)
  })
  it("B-03 · Food Cost con ISV y comisión: 25 ÷ 0.25 × 1.15 = 115; 115 ÷ (1 − 0.10 × 1.15) = 129.94 → USD 130", () => {
    const base = foodCostBasePrice(25, 25, 15)
    expect(base).toBeCloseTo(115, 9)
    expect(coverCommission(base, 10, 15)).toBeCloseTo(115 / 0.885, 9)
    expect(suggestedUnitPrice(pizza, 25, USD)).toBe(130)
  })
  it("B-04 · Lo que queda después de ISV y comisión cubre el objetivo: 130 − 16.96 − 13 = 100.04 ≥ 25 ÷ 0.25", () => {
    const left = 130 - taxIncludedIn(130, 15) - 130 * 0.1
    expect(left).toBeCloseTo(100.0435, 4)
    expect(left).toBeGreaterThanOrEqual(25 / 0.25)
  })
  it("B-05 · Margen de la pizza: (venta sin ISV − costo − comisión) ÷ venta sin ISV = (113.04 − 25 − 13) ÷ 113.04 = 66.38 %", () => {
    const net = 130 / 1.15
    expect(unitMarginPercent(pizza, 130, 25)).toBeCloseTo(((net - 25 - 13) / net) * 100, 9)
    expect(unitMarginPercent(pizza, 130, 25)).toBeCloseTo(66.385, 3)
  })
  it("B-06 · 6 rubros: 100 + 105 % = 205; con costo fijo de 20 por plato = 225 (aviso de gastos dobles, docs/305)", () => {
    const six = recipe({ pricingMethod: "gastrometrics" })
    expect(suggestedUnitPrice(six, 100, USD)).toBe(205)
    expect(suggestedUnitPrice(six, 100, { ...USD, fixedCostPerPlate: 20 })).toBe(225)
    // «Usar solo mis gastos reales»: servicios, marketing, operación y personal en 0 → 100 + 30 + 20 = 150.
    const realOnly = recipe({ pricingMethod: "gastrometrics", publicServices: 0, marketing: 0, operationalCosts: 0, laborCosts: 0 })
    expect(suggestedUnitPrice(realOnly, 100, { ...USD, fixedCostPerPlate: 20 })).toBe(150)
  })
  it("B-07 · 6 rubros con comisión: 205 ÷ (1 − 0.10) = 227.78 → USD 228 (sin ISV dentro del precio)", () => {
    expect(suggestedUnitPrice(recipe({ pricingMethod: "gastrometrics", salesCommissionPercent: 10 }), 100, USD)).toBe(228)
  })
  it("B-08 · Ganancia sobre costo no es margen: 30 % de 100 sobre un precio de 205 = 14.63 % del precio", () => {
    expect((30 / 205) * 100).toBeCloseTo(14.634, 3)
  })
  it("B-09 · Redondeo hacia arriba al escalón: USD 0.50, HNL 5", () => {
    expect(roundSalePrice(129.94, "USD")).toBe(130)
    expect(roundSalePrice(66.67, "HNL")).toBe(70)
  })
  it("B-10 · El precio solo sube: costo 25 → 30 sube a 156; costo 25 → 20 se queda en 130 y el margen sube", () => {
    const priced = { ...pizza, unitPrice: 130 } as Recipe
    const up = applyPriceRule(priced, 25, 30, USD)
    expect(up.kind).toBe("raised")
    if (up.kind === "raised") expect(up.newPrice).toBe(156) // 30 ÷ 0.25 × 1.15 ÷ 0.885 = 155.93
    const down = applyPriceRule(priced, 25, 20, USD)
    expect(down.kind).toBe("kept")
    if (down.kind === "kept") {
      expect(down.price).toBe(130)
      expect(down.newMargin).toBeGreaterThan(down.oldMargin)
    }
  })
  it("B-12 · Rendimiento vacío: 500 g + 1 kg = 1 500 g (no 501); en kg = 1.5; solo piezas: se suman (6 huevos = 6)", () => {
    const lines = [
      { ingredientId: "a", quantity: 500, unit: "gramos" },
      { ingredientId: "b", quantity: 1, unit: "kilogramos" },
    ]
    expect(fallbackYield(lines, "g")).toBe(1500)
    expect(fallbackYield(lines, "kg")).toBe(1.5)
    expect(fallbackYield([{ ingredientId: "h", quantity: 6, unit: "unidad" }], "un")).toBe(6)
    expect(fallbackYield(lines, "g", 2)).toBe(3000) // con PAX × 2
  })
  it("B-11 · PAX: 10 personas sobre rendimiento 4 = × 2.5; redondeo hacia arriba sin error de coma (0.1 × 3 = 0.3)", () => {
    expect(paxMultiplierFor(10, 4)).toBe(2.5)
    expect(roundUpToStep(0.1 * 3, 0.1)).toBe(0.3)
  })
})

describe("C. Consumo y compras", () => {
  const consume = (portions: number, grossUpMerma: boolean) => {
    const acc: ConsumptionMap = new Map()
    accumulateRecipeConsumption(pizza, portions, recipesById, ingredientsById, acc, { grossUpMerma })
    return acc
  }
  it("C-01 · 10 pizzas consumen 2 000 g de harina y 800 g de tomate aprovechable (vía 2 salsas)", () => {
    const acc = consume(10, false)
    expect(acc.get("harina")?.quantity).toBe(2000)
    expect(acc.get("tomate")?.quantity).toBeCloseTo(800, 9) // 1 000 g de salsa ÷ 500 × 400
    expect(acc.has("salsa-ing")).toBe(false) // la subreceta se expande, no se descuenta como tal
  })
  it("C-02 · Para comprar, el tomate se pide bruto: 800 × 1.25 = 1 000 g", () => {
    expect(consume(10, true).get("tomate")?.quantity).toBeCloseTo(1000, 9)
  })
  it("C-03 · La compra se paga a precio físico: 1 000 g × (50 ÷ 1 000) = 50, no 1 000 × 0.0625 = 62.50", () => {
    const qty = consume(10, true).get("tomate")!.quantity
    const physical = tomate.pricing.purchasePrice / (tomate.originalNetContent as number)
    expect(qty * physical).toBeCloseTo(50, 9)
    expect(qty * tomate.pricing.pricePerUnit).toBeCloseTo(62.5, 9) // lo que daría cobrar la merma dos veces
  })
  it("C-04 · Promedio ponderado: 10 kg a 100 + 10 kg a 120 = 110 por kg", () => {
    const r = computeWeightedAverageCost({ previousStock: 10, newStock: 20, purchasePrice: 1200, netContent: 10, previousWeightedAverageCost: 100, previousWeightedAverageQuantity: 10 })
    expect(r.weightedAverageCost).toBe(110)
  })
  it("C-05 · Semáforo: ≤ mínimo crítico, ≤ 2 × mínimo bajo; con teórico manda el teórico", () => {
    expect(stockStatus(5, 5)).toBe("critical")
    expect(stockStatus(10, 5)).toBe("low")
    expect(stockStatus(11, 5)).toBe("normal")
    expect(effectiveStockStatus(11, 5, 4)).toBe("critical")
  })
})

describe("D. Ventas", () => {
  // Una cuenta: 2 pizzas a 130 + 1 agua sin receta a 20 = 280; descuento 28; propina 15.
  const ticket = {
    ...emptyTicket("t1", { discount: 28, tip: 15 }),
    items: [
      { id: "i1", sourceType: "recipe" as const, refId: "pizza", name: "Pizza", quantity: 2, unitPrice: 130, unitCost: 25 },
      { id: "i2", sourceType: "recipe" as const, refId: "", name: "Agua", quantity: 1, unitPrice: 20, unitCost: 0 },
    ],
  }
  const lines = buildImportLines([ticket], "2026-10-15").map((l) => (l.rawDishName === "Agua" ? { ...l, recipeId: null } : l))
  const imp = { id: "d1", businessId: "main", fileName: "", importedAt: "2026-10-15T20:00:00Z", periodStart: "2026-10-15", periodEnd: "2026-10-15", totalRevenue: 0, totalTheoreticalCost: 0, lineCount: 2, unmatchedDishNames: [], lines } as unknown as SalesImport
  const dishes = aggregateSalesByDish([imp], [pizza])

  it("D-01 · El descuento se reparte en proporción: pizza 260 − 26 = 234; agua 20 − 2 = 18; suma 252 = 280 − 28", () => {
    expect(lines[0].revenue).toBe(234)
    expect(lines[1].revenue).toBe(18)
    expect(lines[0].revenue + lines[1].revenue).toBe(252)
  })
  it("D-02 · La propina no es venta: 15 de propina no cambia los 252", () => {
    expect(dishes.reduce((s, d) => s + d.revenue, 0)).toBe(252)
  })
  it("D-03 · Venta neta de ISV de la pizza: 234 ÷ 1.15 = 203.48; costo 2 × 25 = 50", () => {
    const p = dishes.find((d) => d.name === "Pizza")!
    expect(p.revenue - (p.tax || 0)).toBeCloseTo(203.4783, 4)
    expect(p.theoreticalCost).toBe(50)
  })
  it("D-04 · Plato sin receta no es costo cero: margen solo con lo vinculado = (203.48 − 50) ÷ 203.48 = 75.43 %", () => {
    const m = linkedContribution(dishes)
    expect(m.netRevenue).toBeCloseTo(203.4783, 4)
    expect(m.contributionMarginPercent).toBeCloseTo(75.427, 3)
  })
  it("D-05 · Cobertura: 18 de 221.48 netos no tienen receta = 8.13 %", () => {
    const c = salesCoverage(dishes)
    expect(c.unlinkedCount).toBe(1)
    expect(c.unlinkedNetRevenue).toBe(18)
    expect(c.unlinkedPercent).toBeCloseTo((18 / (203.4783 + 18)) * 100, 3)
  })
  it("D-06 · Menu Engineering (Kasavana-Smith): muy vendido con poco margen por unidad es «vaca»", () => {
    const d = (id: string, qty: number, revenue: number, cost: number) => ({
      recipeId: id, name: id, quantitySold: qty, revenue, theoreticalCost: cost, contributionMargin: revenue - cost,
      contributionMarginPercent: 0, unitPrice: revenue / qty, unitCost: cost / qty, linked: true,
    })
    const r = Object.fromEntries(classifyMenuEngineering([d("a", 1000, 2000, 1000), d("b", 60, 1200, 600), d("c", 40, 200, 100)]).map((x) => [x.name, x.classification]))
    expect(r.a).toBe("vaca")
    expect(r.b).toBe("puzzle")
  })
  it("D-07 · El margen de referencia es PONDERADO por unidades, no la media simple: A 100 u × 20, B 10 u × 100, C 50 u × 40 → 31.25 (simple daría 53.33) y C es «estrella», no «vaca»", () => {
    const d = (id: string, qty: number, unitMargin: number) => ({
      recipeId: id, name: id, quantitySold: qty, revenue: qty * (unitMargin + 10), theoreticalCost: qty * 10, contributionMargin: qty * unitMargin,
      contributionMarginPercent: 0, unitPrice: unitMargin + 10, unitCost: 10, linked: true,
    })
    const dishes = [d("A", 100, 20), d("B", 10, 100), d("C", 50, 40)]
    const th = menuEngineeringThresholds(dishes)
    expect(th.averageUnitMargin).toBeCloseTo(5000 / 160, 9) // (2 000 + 1 000 + 2 000) ÷ 160
    expect(th.popularityThreshold).toBeCloseTo(0.7 * (160 / 3), 9) // 37.33
    const r = Object.fromEntries(classifyMenuEngineering(dishes).map((x) => [x.name, x.classification]))
    expect(r).toEqual({ A: "vaca", B: "puzzle", C: "estrella" })
  })
  it("D-08 · El historial por período usa la misma regla que Finanzas: 75.43 %, no (252 − 50) ÷ 252 = 80.16 %", () => {
    const totals = periodsTotals(aggregateSalesByPeriod([imp], [pizza], [], "month"))
    expect(totals.revenue).toBe(252)
    expect(totals.marginPercent).toBeCloseTo(linkedContribution(dishes).contributionMarginPercent, 9)
    expect(totals.marginPercent).toBeCloseTo(75.427, 3)
    expect(totals.unlinkedPercent).toBeCloseTo(salesCoverage(dishes).unlinkedPercent, 9)
  })
})

describe("E. Costo real, Prime Cost y P&L", () => {
  // Octubre: inventario inicial 10 000, final 8 000. Recibida 5 000 en el mes; pendiente 3 000;
  // cancelada 1 000; pedida en octubre pero recibida en noviembre 700. COGS = 10 000 + 5 000 − 8 000 = 7 000.
  const snap = (date: string, value: number) =>
    ({ id: date, date, type: "final", modifiedItems: 0, totalValue: 0, items: [{ id: "x", name: "x", category: "", quantity: value / 100, unit: "unidad", price: 100, netContent: 1, totalPrice: 0 }] }) as unknown as InventorySnapshot
  const po = (id: string, total: number, status: string, date: string, receivedAt?: string) => ({ id, date, total, status, receivedAt }) as unknown as PurchaseOrder
  const orders = [
    po("r", 5000, "received", "2026-10-10", "2026-10-12T09:00:00"),
    po("p", 3000, "pending", "2026-10-11"),
    po("c", 1000, "cancelled", "2026-10-11"),
    po("late", 700, "received", "2026-10-28", "2026-11-02T09:00:00"),
  ]
  const cogs = computeCOGS({ snapshots: [snap("2026-10-01", 10000), snap("2026-10-31", 8000)], purchaseOrders: orders, periodStart: "2026-10-01", periodEnd: "2026-10-31", currentInventoryValue: 0 })

  it("E-01 · Compras = solo recibidas en el período = 5 000 (no 9 700)", () => {
    expect(cogs.purchasesValue).toBe(5000)
  })
  it("E-02 · COGS = 10 000 + 5 000 − 8 000 = 7 000", () => {
    expect(cogs.cogs).toBe(7000)
    expect(cogs.hasFullData).toBe(true)
  })
  it("E-03 · Food cost real 7 000 ÷ 25 000 = 28 %; teórico 25 %; varianza +3 puntos", () => {
    expect((7000 / 25000) * 100).toBeCloseTo(28, 9)
    expect(computeVariance(28, 25)).toBeCloseTo(3, 9)
  })
  it("E-04 · Prime cost = (7 000 + 6 000) ÷ 25 000 = 52 %", () => {
    expect(computePrimeCost(7000, 6000, 25000)).toEqual({ primeCost: 13000, primeCostPercent: 52 })
  })
  it("E-06 · Ejemplo del auditor: 10 000 + 2 000 recibidas − 8 000 = 4 000; la pendiente de 5 000 no entra", () => {
    const r = computeCOGS({
      snapshots: [snap("2026-10-01", 10000), snap("2026-10-31", 8000)],
      purchaseOrders: [po("p", 5000, "pending", "2026-10-05"), po("r", 2000, "received", "2026-10-06", "2026-10-07T10:00:00")],
      periodStart: "2026-10-01", periodEnd: "2026-10-31", currentInventoryValue: 0,
    })
    expect(r.cogs).toBe(4000)
  })
  it("E-07 · Pedida en septiembre y recibida el 3 de octubre: cuenta en octubre, no en septiembre", () => {
    const order = po("x", 900, "received", "2026-09-28", "2026-10-03T08:00:00")
    const flat = (from: string, to: string) => [snap(from, 1000), snap(to, 1000)]
    expect(computeCOGS({ snapshots: flat("2026-09-01", "2026-09-30"), purchaseOrders: [order], periodStart: "2026-09-01", periodEnd: "2026-09-30", currentInventoryValue: 0 }).purchasesValue).toBe(0)
    expect(computeCOGS({ snapshots: flat("2026-10-01", "2026-10-31"), purchaseOrders: [order], periodStart: "2026-10-01", periodEnd: "2026-10-31", currentInventoryValue: 0 }).purchasesValue).toBe(900)
  })
  it("E-08 · El COGS nunca es negativo: 1 000 + 0 − 3 000 → 0", () => {
    expect(computeCOGS({ snapshots: [snap("2026-10-01", 1000), snap("2026-10-31", 3000)], purchaseOrders: [], periodStart: "2026-10-01", periodEnd: "2026-10-31", currentInventoryValue: 0 }).cogs).toBe(0)
  })
  it("E-05 · P&L de un mes completo: 25 000 − 7 000 − 6 000 − 3 000 − 1 000 = 8 000 (32 %)", () => {
    const pnl = buildSimplifiedPnL({ revenue: 25000, cogs: 7000, expenses: { laborCosts: 6000, rent: 3000, utilities: 1000 } as never, periodStart: "2026-10-01", periodEnd: "2026-10-30" })
    expect(pnl.netProfit).toBeCloseTo(8000, 9)
    expect(pnl.netProfitPercent).toBeCloseTo(32, 9)
  })
})
