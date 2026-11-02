import { describe, it, expect, beforeEach } from "vitest"
import { previewIngredientCostChanges, recalculateAfterIngredientChanges } from "./recalculate"
import { saveIngredients, getIngredients } from "./storage/ingredients"
import { saveRecipes, getRecipes } from "./storage/recipes"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

// Merma encendida o apagada (docs/228): cambia el costo por unidad sin tocar el precio de
// compra, y las fichas deben recalcularse (antes quedaban con el costo viejo).
describe("lib/recalculate: merma → recetas", () => {
  const businessId = "test-merma"

  beforeEach(() => {
    localStorage.clear()
  })

  const ing = (id: string, pricePerUnit: number, netContent = 1000): Ingredient =>
    ({
      id,
      name: id,
      category: "VERDURAS",
      unit: "gramos",
      pricing: { purchasePrice: pricePerUnit * netContent, netContent, pricePerUnit, lastUpdated: "" },
      supplier: "",
      metadata: { createdAt: "", updatedAt: "", version: 1 },
    }) as unknown as Ingredient

  const recipe = (id: string, items: [string, number][]): Recipe =>
    ({
      id,
      name: `Receta ${id}`,
      classification: "Platos fuertes",
      yieldAmount: 1,
      totalCost: items.reduce((sum, [, q]) => sum + q * 0.01, 0),
      costPerServing: items.reduce((sum, [, q]) => sum + q * 0.01, 0),
      unitPrice: 50,
      ingredients: items.map(([ingredientId, quantity]) => ({ ingredientId, quantity })),
    }) as unknown as Recipe

  function seed() {
    saveIngredients([ing("tomate", 0.01), ing("sal", 0.01)], businessId)
    saveRecipes([recipe("r1", [["tomate", 500]]), recipe("r2", [["sal", 10]])], businessId)
  }

  // Merma del 20 % en el tomate: 800 g útiles del mismo kilo → 0.0125 por gramo.
  const withMerma = () => [{ ...ing("tomate", 0.0125, 800), merma: { enabled: true } } as unknown as Ingredient, ing("sal", 0.01)]

  it("la vista previa lista solo las recetas que cambian y no guarda nada", () => {
    seed()
    const preview = previewIngredientCostChanges(businessId, withMerma())
    expect(preview.affectedRecipes.map((r) => r.recipeId)).toEqual(["r1"])
    expect(preview.affectedRecipes[0].oldCost).toBeCloseTo(5)
    expect(preview.affectedRecipes[0].newCost).toBeCloseTo(6.25)
    expect(getRecipes(businessId).find((r) => r.id === "r1")?.totalCost).toBeCloseTo(5)
    expect(getIngredients(businessId).find((i) => i.id === "tomate")?.pricing.pricePerUnit).toBeCloseTo(0.01)
  })

  it("sin cambios de costo no hay recetas afectadas", () => {
    seed()
    expect(previewIngredientCostChanges(businessId, getIngredients(businessId)).affectedRecipes).toEqual([])
  })

  it("al guardar recalcula y persiste; al apagarla vuelve al costo original", async () => {
    seed()
    const before = getIngredients(businessId).map((i) => ({ ...i, pricing: { ...i.pricing } }))
    const on = withMerma()
    await saveIngredients(on, businessId)
    const resOn = await recalculateAfterIngredientChanges(businessId, before, on)
    expect(resOn.affectedRecipes.map((r) => r.recipeId)).toEqual(["r1"])
    expect(getRecipes(businessId).find((r) => r.id === "r1")?.totalCost).toBeCloseTo(6.25)

    const off = [ing("tomate", 0.01), ing("sal", 0.01)]
    await saveIngredients(off, businessId)
    await recalculateAfterIngredientChanges(businessId, on, off)
    expect(getRecipes(businessId).find((r) => r.id === "r1")?.totalCost).toBeCloseTo(5)
  })
})
