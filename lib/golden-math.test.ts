/**
 * Casos de referencia (docs/237): resultados calculados a mano, fuera de la app, que las
 * funciones reales deben reproducir exactamente. Pedido del dueño a partir de una evaluación
 * externa: «la cifra calculada independientemente debe coincidir con la ficha, el inventario,
 * el reporte y el PDF». Si una fórmula cambia, estas pruebas lo dicen.
 */
import { describe, expect, it } from "vitest"
import { usableContentAfterMerma } from "./merma-categories"
import { suggestedUnitPrice, unitCostPercent, unitMarginPercent } from "./recipe-pricing"
import { coverCommission, foodCostBasePrice, taxIncludedIn } from "./food-cost-pricing"
import { computeTheoreticalStock } from "./theoretical-stock"
import { computeCOGS, computePrimeCost, buildSimplifiedPnL, computeInventoryTurnover } from "./sales-analytics"
import { recipePdfFigures } from "./pdf/recipe-pdf-generator"
import { getMenuUnitPriceAndCost } from "./menus"
import { effectiveStockStatus } from "./inventory-status"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import type { SalesImport } from "@/types/sales-import"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { Menu } from "@/lib/types/menus"

const recipe = (over: Partial<Recipe>): Recipe => ({ id: "r", name: "r", yieldAmount: 1, ingredients: [], totalCost: 0, ...over }) as unknown as Recipe

describe("1. Ingrediente con merma", () => {
  it("1 kg a 100 con 20 % de merma → 800 g aprovechables → 0.125 por gramo", () => {
    const usable = usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "percentage", customPercentage: 20 }, "OTROS")
    expect(usable).toBe(800)
    expect(100 / usable).toBe(0.125)
  })
  it("merma por cantidad: 1000 g − 150 g = 850 g; nunca menos de 0.1", () => {
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "quantity", customValue: 150 }, "OTROS")).toBe(850)
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "quantity", customValue: 5000 }, "OTROS")).toBe(0.1)
  })
})

describe("2. Receta", () => {
  it("200 g a 0.125 = 25; con rendimiento de 4 porciones = 6.25 por porción (igual en el PDF)", () => {
    const lineCost = 200 * 0.125
    expect(lineCost).toBe(25)
    const r = recipe({ totalCost: lineCost, yieldAmount: 4, unitPrice: 25, pricingMethod: "food_cost" })
    const pdf = recipePdfFigures(r)
    expect(pdf.costPerUnit).toBe(6.25)
    expect(pdf.foodCostPct).toBe(25) // 6.25 ÷ 25 × 100
    expect(pdf.marginPct).toBe(75)
  })
  it("la receta de ejemplo (costo 25.60, precio 90) da en el PDF lo mismo que la Ficha", () => {
    const r = recipe({ totalCost: 25.6, yieldAmount: 1, unitPrice: 90, pricingMethod: "food_cost" })
    const pdf = recipePdfFigures(r)
    expect(pdf.totalCost).toBe(25.6)
    expect(pdf.foodCostPct).toBeCloseTo((25.6 / 90) * 100, 9) // 28.44 %
    expect(pdf.foodCostPct).toBe(unitCostPercent(r, 90, 25.6))
    expect(pdf.marginPct).toBe(unitMarginPercent(r, 90, 25.6))
  })
  it("con ISV 15 % y comisión 10 %: el PDF usa la venta sin ISV y resta la comisión, como la Ficha", () => {
    const r = recipe({ totalCost: 30, yieldAmount: 1, unitPrice: 115, pricingMethod: "food_cost", isv: 15, salesCommissionPercent: 10 })
    const pdf = recipePdfFigures(r)
    expect(pdf.foodCostPct).toBeCloseTo(30, 9) // 30 ÷ (115 − 15) × 100
    expect(pdf.marginPct).toBeCloseTo(58.5, 9) // (100 − 30 − 11.5) ÷ 100 × 100
  })
})

describe("3. Food Cost", () => {
  it("costo 20, objetivo 30 %, sin impuesto ni comisión → 66.67, redondeado hacia arriba al escalón", () => {
    expect(foodCostBasePrice(20, 30, 0)).toBeCloseTo(66.6667, 4)
    expect(suggestedUnitPrice(recipe({ pricingMethod: "food_cost", targetFoodCostPercent: 30 }), 20, { currencyCode: "USD" })).toBe(67) // escalón 0.50
    expect(suggestedUnitPrice(recipe({ pricingMethod: "food_cost", targetFoodCostPercent: 30 }), 20, { currencyCode: "HNL" })).toBe(70) // escalón 5
  })
  it("con ISV 15 % y comisión 20 %: después de impuesto y comisión queda la misma venta neta", () => {
    const base = foodCostBasePrice(20, 30, 15)
    const price = coverCommission(base, 20, 15)
    expect(price - taxIncludedIn(price, 15) - price * 0.2).toBeCloseTo(20 / 0.3, 9)
  })
})

describe("4. Inventario: stock teórico", () => {
  it("conteo 10 kg + compra recibida 5 kg − consumo de ventas 3 kg = 12 kg", () => {
    const countedAt = "2026-10-01T10:00:00.000Z"
    const harina = { id: "harina", name: "harina", category: "OTROS", unit: "gramos", pricing: { purchasePrice: 100, netContent: 1000, pricePerUnit: 0.1 } } as unknown as Ingredient
    const pan = recipe({ id: "pan", name: "pan", yieldAmount: 1, ingredients: [{ id: "l", ingredientId: "harina", quantity: 3000 }] as Recipe["ingredients"] })
    const item = {
      id: "harina", name: "harina", category: "", unit: "gramos", price: 0, lastUpdated: "", status: "normal", minStock: 13000,
      currentStock: 15000, // 10 000 contados + 5 000 recibidos después
      stockCountedAt: countedAt,
      stockReceipts: [{ at: "2026-10-01T15:00:00.000Z", quantity: 5000 }],
    } as unknown as InventoryItem
    const sale = {
      id: "s", businessId: "main", fileName: "", importedAt: "2026-10-02T20:00:00.000Z", periodStart: "2026-10-02", periodEnd: "2026-10-02",
      totalRevenue: 0, totalTheoreticalCost: 0, lineCount: 1, unmatchedDishNames: [],
      lines: [{ id: "l0", rawDishName: "", recipeId: "pan", menuId: null, quantity: 1, unitPrice: null, revenue: 0, theoreticalCost: 0, date: "2026-10-02" }],
    } as unknown as SalesImport
    const entry = computeTheoreticalStock({ items: [item], snapshots: [], salesImports: [sale], recipes: [pan], ingredients: [harina], menus: [] }).get("harina")!
    expect(entry.baseline).toBe(10000)
    expect(entry.received).toBe(5000)
    expect(entry.consumed).toBe(3000)
    expect(entry.theoretical).toBe(12000)
    // El semáforo usa el teórico: 15 000 contados dirían «bajo» (≤ 2 × 13 000); 12 000 teóricos, «crítico».
    expect(effectiveStockStatus(item.currentStock, item.minStock, entry.theoretical)).toBe("critical")
  })
})

describe("5. Un mes completo hasta el P&L", () => {
  // Inventario inicial 10 000, compras 5 000, inventario final 8 000 → COGS 7 000.
  // Ventas 25 000 → food cost real 28 %. Mano de obra 6 000/mes, alquiler 3 000, servicios 1 000,
  // en un período de 30 días → prime cost 13 000 (52 %), utilidad 8 000 (32 %).
  const snap = (date: string, value: number) =>
    ({ id: date, date, type: "final", modifiedItems: 0, totalValue: 0, items: [{ id: "x", name: "x", category: "", quantity: value / 100, unit: "unidad", price: 100, netContent: 1, totalPrice: 0 }] }) as unknown as InventorySnapshot
  const po = { id: "po", date: "2026-10-15", total: 5000 } as unknown as PurchaseOrder
  const cogs = computeCOGS({ snapshots: [snap("2026-10-01", 10000), snap("2026-10-30", 8000)], purchaseOrders: [po], periodStart: "2026-10-01", periodEnd: "2026-10-30", currentInventoryValue: 0 })

  it("COGS = inicial + compras − final", () => {
    expect(cogs).toMatchObject({ initialInventoryValue: 10000, purchasesValue: 5000, finalInventoryValue: 8000, cogs: 7000, hasFullData: true })
    expect((cogs.cogs / 25000) * 100).toBeCloseTo(28, 9)
    expect(computeInventoryTurnover(cogs.cogs, 10000, 8000)).toBeCloseTo(7000 / 9000, 9)
  })
  it("prime cost y P&L del mismo período", () => {
    expect(computePrimeCost(7000, 6000, 25000)).toEqual({ primeCost: 13000, primeCostPercent: 52 })
    const pnl = buildSimplifiedPnL({
      revenue: 25000,
      cogs: 7000,
      expenses: { laborCosts: 6000, rent: 3000, utilities: 1000 } as never,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-30",
    })
    expect(pnl.totalExpenses).toBeCloseTo(17000, 9)
    expect(pnl.netProfit).toBeCloseTo(8000, 9)
    expect(pnl.netProfitPercent).toBeCloseTo(32, 9)
  })
  it("una compra fuera del período no cuenta", () => {
    const outside = { id: "po2", date: "2026-11-05", total: 9999 } as unknown as PurchaseOrder
    const r = computeCOGS({ snapshots: [snap("2026-10-01", 10000), snap("2026-10-30", 8000)], purchaseOrders: [po, outside], periodStart: "2026-10-01", periodEnd: "2026-10-30", currentInventoryValue: 0 })
    expect(r.cogs).toBe(7000)
  })
})

describe("6. Menú", () => {
  it("precio del menú completo = suma de platos; costo con costo total ÷ rendimiento si falta el de porción", () => {
    const a = recipe({ id: "a", unitPrice: 100, costPerServing: 30 })
    const b = recipe({ id: "b", unitPrice: 50, totalCost: 40, yieldAmount: 4 }) // sin costPerServing: 10 por porción
    delete (b as Partial<Recipe>).costPerServing
    const menu = { items: [{ recipeId: "a", enabled: true }, { recipeId: "b", enabled: true }, { recipeId: "a", enabled: false }] } as unknown as Menu
    expect(getMenuUnitPriceAndCost(menu, [a, b])).toEqual({ price: 150, cost: 40 })
  })
})
