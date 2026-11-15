import { describe, expect, it } from "vitest"
import { buildBusinessBreakdown, type BreakdownInput, type BreakdownRecipe } from "./business-breakdown"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"

const recipe = (over: Partial<BreakdownRecipe> = {}): BreakdownRecipe => ({
  businessId: null,
  isSubRecipe: false,
  totalCost: 40,
  unitPrice: 100,
  yieldAmount: 1,
  classification: "Plato fuerte",
  pricingMethod: "six_items",
  isv: 0,
  salesCommissionPercent: 0,
  ...over,
})

const empty = (): BreakdownInput => ({
  businesses: [],
  recipes: [],
  ingredients: [],
  inventory: [],
  counted: { menus: [], inventoryCounts: [], purchaseOrders: [], invoices: [], salesImports: [] },
  activity: [],
})

describe("negocios de una cuenta en /admin (docs/232)", () => {
  it("separa el espacio principal y cada negocio, con los números del Dashboard", () => {
    const input = empty()
    input.businesses = [{ id: "b1", name: "Café", createdAt: "2026-10-01", isActive: true }]
    input.recipes = [
      recipe(),
      recipe({ businessId: "b1", totalCost: 30, unitPrice: 0 }),
      recipe({ businessId: "b1", isSubRecipe: true, classification: SUBRECIPE_CLASSIFICATION, totalCost: 10 }),
    ]
    input.ingredients = [{ businessId: "b1", category: "OTROS" }, { businessId: "b1", category: SUBRECIPE_CLASSIFICATION }]
    input.inventory = [{ businessId: "b1", status: "low" }, { businessId: "b1", status: "ok" }]
    input.counted.menus = [{ businessId: "b1" }]
    const out = buildBusinessBreakdown(input)
    expect(out.spaces.map((s) => s.id)).toEqual([null, "b1"])
    const main = out.spaces[0]
    expect(main.recipes).toBe(1)
    expect(main.averageMargin).toBe(60)
    const cafe = out.spaces[1]
    expect(cafe.recipes).toBe(2)
    expect(cafe.subRecipes).toBe(1)
    expect(cafe.ingredients).toBe(1) // sin la fila de la subreceta
    expect(cafe.recipesWithoutPrice).toBe(1)
    expect(cafe.lowStock).toBe(1)
    expect(cafe.menus).toBe(1)
    expect(cafe.averageCost).toBe(20)
    expect(out.totals.recipes).toBe(3)
    expect(out.totals.averageCost).toBeCloseTo(80 / 3)
  })

  it("cuenta PDF por tipo, migraciones, importaciones y la última actividad por negocio", () => {
    const input = empty()
    input.businesses = [{ id: "b1", name: "Café", createdAt: "2026-10-01", isActive: true }]
    input.activity = [
      { businessId: "b1", module: "pdf", action: "exported", entityLabel: "recipe", at: "2026-11-01T10:00:00Z" },
      { businessId: "b1", module: "pdf", action: "exported", entityLabel: "recipe", at: "2026-11-01T11:00:00Z" },
      { businessId: null, module: "pdf", action: "exported", entityLabel: "menu", at: "2026-11-01T09:00:00Z" },
      { businessId: "b1", module: "recetas", action: "migrated", entityLabel: "Flan", at: "2026-11-02T08:00:00Z" },
      { businessId: "b1", module: "ingredientes", action: "imported", entityLabel: null, at: "2026-10-30T08:00:00Z" },
      { businessId: "b1", module: "dashboard", action: "entered", entityLabel: null, at: "2026-11-03T08:00:00Z" },
      { businessId: "otro", module: "pdf", action: "exported", entityLabel: "recipe", at: "2026-11-01T09:00:00Z" },
    ]
    const out = buildBusinessBreakdown(input)
    const cafe = out.spaces.find((s) => s.id === "b1")!
    expect(cafe.pdfExports).toBe(2)
    expect(cafe.pdfByKind).toEqual({ recipe: 2 })
    expect(cafe.recipesMigrated).toBe(1)
    expect(cafe.imports).toBe(1)
    expect(cafe.lastActivityAt).toBe("2026-11-02T08:00:00Z") // entrar a una pantalla no cuenta
    expect(out.totals.pdfExports).toBe(3) // el del negocio ajeno no cuenta
    expect(out.totals.pdfByKind).toEqual({ recipe: 2, menu: 1 })
  })

  it("negocios creados: nunca menos que los que hay más los borrados", () => {
    const input = empty()
    input.businesses = [{ id: "b1", name: "A", createdAt: "", isActive: true }, { id: "b2", name: "B", createdAt: "", isActive: false }]
    input.activity = [{ businessId: null, module: "negocios", action: "deleted", entityLabel: "C", at: "2026-10-01" }]
    const out = buildBusinessBreakdown(input)
    expect(out.totals).toMatchObject({ businessesNow: 2, businessesCreated: 3, businessesDeleted: 1 })
    expect(out.spaces[0]).toMatchObject({ recipes: 0, salesRevenue: 0, theoreticalFoodCostPercent: null })
    expect(out.spaces.map((s) => s.id)).toEqual([null, "b1", "b2"]) // el Dashboard personal siempre (docs/315)
  })

  it("ventas, food cost teórico, equipo y configuración por negocio (docs/315)", () => {
    const input = empty()
    const settings = { type: "Café", pricingMethod: "food_cost", targetFoodCostPercent: 30, estimatedMonthlyPlates: 900, monthlyFixedExpenses: 4000, valuationMethod: null }
    input.businesses = [{ id: "b1", name: "Café", createdAt: "2026-10-01", isActive: true, settings }]
    input.now = "2026-11-15T12:00:00Z"
    input.sales = [
      { businessId: "b1", revenue: 1000, theoreticalCost: 300, at: "2026-11-10T00:00:00Z" },
      { businessId: "b1", revenue: 500, theoreticalCost: 150, at: "2026-09-01T00:00:00Z" },
      { businessId: "b1", revenue: 0, theoreticalCost: 99, at: "2026-11-11T00:00:00Z" },
      { businessId: null, revenue: 200, theoreticalCost: 80, at: "2026-11-01T00:00:00Z" },
    ]
    input.members = [{ businessId: "b1" }, { businessId: "b1" }, { businessId: "ajeno" }]
    const out = buildBusinessBreakdown(input)
    const cafe = out.spaces.find((s) => s.id === "b1")!
    // 1500 vendidos; 450 de costo teórico (la venta en 0 no cuenta) = 30 %; 1000 en los últimos 30 días.
    expect(cafe).toMatchObject({ salesRevenue: 1500, salesRevenue30d: 1000, theoreticalFoodCostPercent: 30, lastSaleAt: "2026-11-11T00:00:00Z", teamMembers: 2, settings })
    expect(out.spaces[0]).toMatchObject({ salesRevenue: 200, theoreticalFoodCostPercent: 40, teamMembers: 0, settings: null })
    expect(out.totals).toMatchObject({ salesRevenue: 1700, salesRevenue30d: 1200, teamMembers: 2 })
  })
})
