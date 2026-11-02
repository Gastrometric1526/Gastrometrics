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
    expect(out.spaces.map((s) => s.id)).toEqual(["b1", "b2"]) // el principal vacío no se muestra
  })
})
