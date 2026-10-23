import { describe, expect, it, vi } from "vitest"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"

// Harina: saco de 1000 g a L30. Receta A rinde 4 porciones con 400 g; receta B igual.
const harina = {
  id: "harina",
  name: "Harina",
  unit: "gramos",
  category: "HARINA",
  pricing: { purchasePrice: 30, netContent: 1000, pricePerUnit: 0.03 },
} as unknown as Ingredient
const recipe = (id: string): Recipe =>
  ({ id, name: id, yieldAmount: 4, ingredients: [{ id: "l", ingredientId: "harina", quantity: 400, unit: "gramos", unitCost: 0.03 }] }) as unknown as Recipe

vi.mock("./storage/recipes", () => ({ getRecipes: () => [recipe("A"), recipe("B")] }))
vi.mock("./storage/ingredients", () => ({ getIngredients: () => [harina] }))

import { buildPurchaseOrderData } from "./purchase-orders"

describe("Multiplicador de la orden de compra (docs/189)", () => {
  it("10 personas con una receta de 4 porciones = ×2.5 → 1000 g de harina, L30", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["A"], compaxByRecipeId: { A: 2.5 } })
    expect(r.items[0].quantity).toBeCloseTo(1000, 9)
    expect(r.totalCost).toBeCloseTo(30, 9)
  })

  it("un plato en 0 porciones no se compra (antes el 0 se volvía 1 y pedía la receta completa)", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["A", "B"], compaxByRecipeId: { A: 2.5, B: 0 } })
    expect(r.items[0].quantity).toBeCloseTo(1000, 9)
    expect(r.recipesSummary.map((s) => s.recipeId)).toEqual(["A"])
  })

  it("sin multiplicador se pide la receta una vez (400 g)", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["A"] })
    expect(r.items[0].quantity).toBeCloseTo(400, 9)
  })
})
