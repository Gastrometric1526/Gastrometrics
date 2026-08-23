import { describe, it, expect } from "vitest"
import {
  aggregateSalesByDish,
  classifyMenuEngineering,
  computeCOGS,
  computePrimeCost,
  prorateMonthlyExpense,
  computeInventoryTurnover,
  computeVariance,
  buildSimplifiedPnL,
  computeSupplierPriceVariance,
} from "./sales-analytics"
import type { SalesImport } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { Ingredient } from "@/types/ingredient"

const makeImport = (overrides: Partial<SalesImport> = {}): SalesImport => ({
  id: "imp1",
  businessId: "biz1",
  fileName: "ventas.xlsx",
  importedAt: new Date().toISOString(),
  periodStart: "2026-08-01",
  periodEnd: "2026-08-07",
  totalRevenue: 0,
  totalTheoreticalCost: 0,
  lineCount: 0,
  unmatchedDishNames: [],
  lines: [],
  ...overrides,
})

describe("aggregateSalesByDish", () => {
  it("suma cantidades, ingresos y costo teorico por receta a traves de varias importaciones", () => {
    const imports = [
      makeImport({
        lines: [
          { id: "l1", rawDishName: "Hamburguesa", recipeId: "r1", quantity: 10, unitPrice: 100, revenue: 1000, theoreticalCost: 300 },
        ],
      }),
      makeImport({
        id: "imp2",
        lines: [
          { id: "l2", rawDishName: "Hamburguesa", recipeId: "r1", quantity: 5, unitPrice: 100, revenue: 500, theoreticalCost: 150 },
        ],
      }),
    ]
    const result = aggregateSalesByDish(imports, [])
    expect(result).toHaveLength(1)
    expect(result[0].quantitySold).toBe(15)
    expect(result[0].revenue).toBe(1500)
    expect(result[0].theoreticalCost).toBe(450)
    expect(result[0].contributionMargin).toBe(1050)
    expect(result[0].contributionMarginPercent).toBeCloseTo(70, 5)
  })

  it("usa el nombre crudo del POS cuando no hay receta vinculada, y agrupa por nombre", () => {
    const imports = [
      makeImport({
        lines: [
          { id: "l1", rawDishName: "Plato Misterioso", recipeId: null, quantity: 2, unitPrice: 50, revenue: 100, theoreticalCost: 0 },
        ],
      }),
    ]
    const result = aggregateSalesByDish(imports, [])
    expect(result[0].name).toBe("Plato Misterioso")
    expect(result[0].recipeId).toBeNull()
  })
})

describe("classifyMenuEngineering", () => {
  it("clasifica en los 4 cuadrantes contra el promedio del propio menu", () => {
    const dishes = [
      { recipeId: "star", name: "Estrella", quantitySold: 100, revenue: 1000, theoreticalCost: 300, contributionMargin: 700, contributionMarginPercent: 70, unitPrice: 10, unitCost: 3 },
      { recipeId: "cow", name: "Vaca", quantitySold: 100, revenue: 1000, theoreticalCost: 800, contributionMargin: 200, contributionMarginPercent: 20, unitPrice: 10, unitCost: 8 },
      { recipeId: "puzzle", name: "Puzzle", quantitySold: 5, revenue: 500, theoreticalCost: 100, contributionMargin: 400, contributionMarginPercent: 80, unitPrice: 100, unitCost: 20 },
      { recipeId: "dog", name: "Perro", quantitySold: 5, revenue: 50, theoreticalCost: 40, contributionMargin: 10, contributionMarginPercent: 20, unitPrice: 10, unitCost: 8 },
    ]
    const result = classifyMenuEngineering(dishes)
    const byName = Object.fromEntries(result.map((d) => [d.name, d.classification]))
    expect(byName["Estrella"]).toBe("estrella")
    expect(byName["Vaca"]).toBe("vaca")
    expect(byName["Puzzle"]).toBe("puzzle")
    expect(byName["Perro"]).toBe("perro")
  })

  it("con lista vacia no revienta", () => {
    expect(classifyMenuEngineering([])).toEqual([])
  })
})

describe("computeCOGS", () => {
  it("Inventario Inicial + Compras - Inventario Final, con snapshots dentro del periodo", () => {
    const snapshots: InventorySnapshot[] = [
      { id: "s1", date: "2026-08-01", type: "initial", modifiedItems: 1, totalValue: 12000 },
      { id: "s2", date: "2026-08-07", type: "final", modifiedItems: 1, totalValue: 11200 },
    ]
    const purchaseOrders: PurchaseOrder[] = [
      { id: "po1", name: "OC-1", number: 1, date: "2026-08-03", recipes: [], items: [], total: 8500 },
    ]
    const result = computeCOGS({
      snapshots,
      purchaseOrders,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-07",
      currentInventoryValue: 11200,
    })
    expect(result.initialInventoryValue).toBe(12000)
    expect(result.finalInventoryValue).toBe(11200)
    expect(result.purchasesValue).toBe(8500)
    expect(result.cogs).toBe(9300)
    expect(result.hasFullData).toBe(true)
  })

  it("sin snapshots en el periodo, usa el inventario actual como aproximacion y marca hasFullData en false", () => {
    const result = computeCOGS({
      snapshots: [],
      purchaseOrders: [],
      periodStart: "2026-08-01",
      periodEnd: "2026-08-07",
      currentInventoryValue: 5000,
    })
    expect(result.hasFullData).toBe(false)
    expect(result.initialInventoryValue).toBe(5000)
    expect(result.finalInventoryValue).toBe(5000)
  })

  it("el COGS nunca es negativo aunque el inventario final supere al inicial mas compras", () => {
    const snapshots: InventorySnapshot[] = [
      { id: "s1", date: "2026-08-01", type: "initial", modifiedItems: 1, totalValue: 1000 },
      { id: "s2", date: "2026-08-07", type: "final", modifiedItems: 1, totalValue: 5000 },
    ]
    const result = computeCOGS({
      snapshots,
      purchaseOrders: [],
      periodStart: "2026-08-01",
      periodEnd: "2026-08-07",
      currentInventoryValue: 5000,
    })
    expect(result.cogs).toBe(0)
  })
})

describe("computePrimeCost", () => {
  it("Prime Cost = COGS + costo laboral, como % de las ventas", () => {
    const result = computePrimeCost(9300, 5000, 30000)
    expect(result.primeCost).toBe(14300)
    expect(result.primeCostPercent).toBeCloseTo(47.6667, 3)
  })

  it("con ventas en 0 no revienta (devuelve 0%)", () => {
    expect(computePrimeCost(100, 100, 0).primeCostPercent).toBe(0)
  })
})

describe("prorateMonthlyExpense", () => {
  it("prorratea un gasto mensual sobre 30 dias segun la duracion real del periodo", () => {
    // 7 dias (1 al 7 de agosto, inclusive) de un gasto mensual de 3000 -> 3000/30*7 = 700
    expect(prorateMonthlyExpense(3000, "2026-08-01", "2026-08-07")).toBeCloseTo(700, 5)
  })

  it("sin periodo definido, devuelve el monto mensual completo", () => {
    expect(prorateMonthlyExpense(3000, null, null)).toBe(3000)
  })
})

describe("computeInventoryTurnover", () => {
  it("COGS dividido entre el inventario promedio", () => {
    expect(computeInventoryTurnover(9300, 12000, 11200)).toBeCloseTo(0.8017, 3)
  })

  it("con inventario promedio en 0 no revienta", () => {
    expect(computeInventoryTurnover(100, 0, 0)).toBe(0)
  })
})

describe("computeVariance", () => {
  it("Real menos Teorico", () => {
    expect(computeVariance(31, 28)).toBe(3)
    expect(computeVariance(25, 28)).toBe(-3)
  })
})

describe("buildSimplifiedPnL", () => {
  it("prorratea los gastos configurados del negocio y calcula la utilidad neta estimada", () => {
    const result = buildSimplifiedPnL({
      revenue: 30000,
      cogs: 9300,
      expenses: { rent: 3000, utilities: 900, operationalCosts: 1200, marketing: 600, laborCosts: 5000, otherExpenses: 300 },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-07", // 7 dias
    })
    // cada gasto mensual prorrateado a 7/30 del mes
    expect(result.laborCost).toBeCloseTo((5000 / 30) * 7, 5)
    expect(result.rent).toBeCloseTo((3000 / 30) * 7, 5)
    expect(result.totalExpenses).toBeCloseTo(9300 + (5000 + 3000 + 900 + 1200 + 600 + 300) / 30 * 7, 5)
    expect(result.netProfit).toBeCloseTo(result.revenue - result.totalExpenses, 5)
  })

  it("sin gastos configurados, solo resta el COGS", () => {
    const result = buildSimplifiedPnL({ revenue: 1000, cogs: 300, expenses: undefined, periodStart: null, periodEnd: null })
    expect(result.totalExpenses).toBe(300)
    expect(result.netProfit).toBe(700)
  })
})

describe("computeSupplierPriceVariance", () => {
  const baseIngredient = (overrides: Partial<Ingredient>): Ingredient =>
    ({
      id: "i1",
      name: "Harina",
      category: "HARINA",
      unit: "gramos",
      pricing: { purchasePrice: 0, netContent: 1, pricePerUnit: 0, lastUpdated: "" },
      supplier: "Proveedor A",
      metadata: { createdAt: "", updatedAt: "", version: 1 },
      ...overrides,
    }) as Ingredient

  it("solo reporta ingredientes con variacion significativa (>= 5%)", () => {
    const ingredients = [
      baseIngredient({ id: "big", pricing: { purchasePrice: 0, netContent: 1, pricePerUnit: 12, weightedAverageCost: 10, lastUpdated: "" } }),
      baseIngredient({ id: "small", pricing: { purchasePrice: 0, netContent: 1, pricePerUnit: 10.1, weightedAverageCost: 10, lastUpdated: "" } }),
    ]
    const result = computeSupplierPriceVariance(ingredients)
    expect(result.map((r) => r.ingredientId)).toEqual(["big"])
    expect(result[0].variancePercent).toBeCloseTo(20, 5)
  })

  it("ordena por magnitud de variacion, no por signo", () => {
    const ingredients = [
      baseIngredient({ id: "up", pricing: { purchasePrice: 0, netContent: 1, pricePerUnit: 11, weightedAverageCost: 10, lastUpdated: "" } }),
      baseIngredient({ id: "down", pricing: { purchasePrice: 0, netContent: 1, pricePerUnit: 7, weightedAverageCost: 10, lastUpdated: "" } }),
    ]
    const result = computeSupplierPriceVariance(ingredients)
    expect(result.map((r) => r.ingredientId)).toEqual(["down", "up"])
  })
})
