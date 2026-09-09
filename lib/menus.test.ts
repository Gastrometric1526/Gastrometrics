import { describe, it, expect } from "vitest"
import { getMenuUnitPriceAndCost } from "./menus"
import type { Menu, MenuItem } from "@/lib/types/menus"
import type { Recipe } from "@/types/recipe"

const makeItem = (overrides: Partial<MenuItem> = {}): MenuItem => ({
  id: overrides.id || "item1",
  recipeId: overrides.recipeId || "r1",
  stepId: "step1",
  section: "fuerte",
  enabled: overrides.enabled ?? true,
  priceOverride: overrides.priceOverride,
  ...overrides,
})

const makeMenu = (items: MenuItem[]): Menu => ({
  id: "menu1",
  businessId: "biz1",
  name: "Almuerzo Ejecutivo",
  steps: [],
  items,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const makeRecipe = (id: string, unitPrice: number, costPerServing: number): Recipe =>
  ({ id, name: `Receta ${id}`, unitPrice, costPerServing } as unknown as Recipe)

// Cubre docs/90 (registro manual de ventas): no existía ninguna función que sumara
// el precio/costo de vender un MENÚ COMPLETO como una sola unidad — app/menus/
// page.tsx solo calcula el promedio por plato, que es un cálculo distinto.
describe("getMenuUnitPriceAndCost", () => {
  it("suma (no promedia) el precio y el costo de los ítems habilitados", () => {
    const recipes = [makeRecipe("r1", 100, 30), makeRecipe("r2", 80, 25)]
    const menu = makeMenu([makeItem({ id: "i1", recipeId: "r1" }), makeItem({ id: "i2", recipeId: "r2" })])

    const result = getMenuUnitPriceAndCost(menu, recipes)
    expect(result.price).toBe(180)
    expect(result.cost).toBe(55)
  })

  it("ignora los ítems deshabilitados", () => {
    const recipes = [makeRecipe("r1", 100, 30), makeRecipe("r2", 80, 25)]
    const menu = makeMenu([makeItem({ id: "i1", recipeId: "r1" }), makeItem({ id: "i2", recipeId: "r2", enabled: false })])

    const result = getMenuUnitPriceAndCost(menu, recipes)
    expect(result.price).toBe(100)
    expect(result.cost).toBe(30)
  })

  it("usa priceOverride en vez del precio de la receta cuando está puesto", () => {
    const recipes = [makeRecipe("r1", 100, 30)]
    const menu = makeMenu([makeItem({ id: "i1", recipeId: "r1", priceOverride: 65 })])

    const result = getMenuUnitPriceAndCost(menu, recipes)
    expect(result.price).toBe(65)
    expect(result.cost).toBe(30) // el costo real de la receta no cambia por un override de precio de venta
  })

  it("un menú sin ítems habilitados da precio y costo en cero, no un error", () => {
    const menu = makeMenu([])
    const result = getMenuUnitPriceAndCost(menu, [])
    expect(result).toEqual({ price: 0, cost: 0 })
  })
})
