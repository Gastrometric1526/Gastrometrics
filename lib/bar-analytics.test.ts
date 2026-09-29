import { describe, it, expect } from "vitest"
import { computeCOGSByArea, filterDishesByArea, splitSalesByArea } from "./bar-analytics"
import { BAR_CLASSIFICATIONS } from "./beverage"
import type { DishPerformance } from "./sales-analytics"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventorySnapshot } from "@/types/inventory"
import type { PurchaseOrder } from "@/types/purchase-order"

const recipe = (id: string, classification: string) => ({ id, classification }) as unknown as Recipe
const dish = (recipeId: string | null, revenue: number, theoreticalCost: number): DishPerformance => ({
  recipeId,
  name: recipeId || "combo",
  quantitySold: 1,
  revenue,
  theoreticalCost,
  contributionMargin: revenue - theoreticalCost,
  contributionMarginPercent: 0,
  unitPrice: revenue,
  unitCost: theoreticalCost,
})

const recipes = [recipe("steak", "Parrilla (Grillardin)"), recipe("gin-tonic", BAR_CLASSIFICATIONS.cocktails)]

describe("splitSalesByArea (docs/136)", () => {
  it("separa ventas, costo % y mezcla entre cocina y barra", () => {
    const split = splitSalesByArea([dish("steak", 300, 96), dish("gin-tonic", 100, 20), dish(null, 100, 40)], recipes)
    expect(split.bar.revenue).toBe(100)
    expect(split.bar.costPercent).toBeCloseTo(20, 6)
    expect(split.kitchen.revenue).toBe(400) // la línea sin receta queda en cocina
    expect(split.kitchen.costPercent).toBeCloseTo(34, 6)
    expect(split.bar.mixPercent).toBeCloseTo(20, 6)
  })

  it("filtra platos por área para Menu Engineering", () => {
    const dishes = [dish("steak", 300, 96), dish("gin-tonic", 100, 20)]
    expect(filterDishesByArea(dishes, recipes, "bar").map((d) => d.recipeId)).toEqual(["gin-tonic"])
    expect(filterDishesByArea(dishes, recipes, "all")).toHaveLength(2)
  })
})

describe("computeCOGSByArea", () => {
  const snapshot = (date: string, wineMl: number, beefG: number): InventorySnapshot => ({
    id: date,
    date,
    type: "final",
    modifiedItems: 2,
    totalValue: 0,
    items: [
      { id: "w", name: "Malbec", category: "VINOS", quantity: wineMl, unit: "mililitros", price: 20, totalPrice: 0, netContent: 750 },
      { id: "b", name: "Lomo", category: "RES", quantity: beefG, unit: "gramos", price: 10, totalPrice: 0, netContent: 1000 },
    ],
  })
  const ingredients = [{ name: "Malbec", category: "VINOS" }, { name: "Lomo", category: "RES" }] as unknown as Ingredient[]
  const order = {
    id: "po",
    name: "",
    number: 1,
    date: "2026-09-10",
    recipes: [],
    total: 70,
    items: [
      { name: "Malbec", totalQuantity: 0, unit: "", costPerUnit: 0, purchaseCost: 40, quantityToBuy: 0, supplier: "" },
      { name: "Lomo", totalQuantity: 0, unit: "", costPerUnit: 0, purchaseCost: 30, quantityToBuy: 0, supplier: "" },
    ],
  } as PurchaseOrder

  it("inicial + compras − final, por área", () => {
    const result = computeCOGSByArea({
      snapshots: [snapshot("2026-09-01", 1500, 5000), snapshot("2026-09-30", 750, 2000)],
      purchaseOrders: [order],
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      ingredients,
    })
    expect(result.hasFullData).toBe(true)
    expect(result.bar).toBeCloseTo(40 + 40 - 20, 6) // 2 → 1 botella, más 2 compradas
    expect(result.kitchen).toBeCloseTo(50 + 30 - 20, 6)
  })

  it("sin dos conteos en el período no inventa un costo real", () => {
    const result = computeCOGSByArea({
      snapshots: [snapshot("2026-09-01", 1500, 5000)],
      purchaseOrders: [],
      periodStart: "2026-09-01",
      periodEnd: "2026-09-30",
      ingredients,
    })
    expect(result.hasFullData).toBe(false)
  })
})
