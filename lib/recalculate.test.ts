import { describe, it, expect, beforeEach } from "vitest"
import { updateIngredientPriceAndRecalculate } from "./recalculate"
import { saveIngredients } from "./storage/ingredients"
import { saveRecipes, getRecipes } from "./storage/recipes"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

// Cubre dos bugs reales corregidos en sesiones anteriores dentro de esta misma función
// (ver comentarios "BUG CORREGIDO" en lib/recalculate.ts):
// 1. pricePerUnit debe ser purchasePrice / netContent (costo por gramo/unidad), no el
//    precio del paquete completo tal cual.
// 2. El costo de receta debe sumar quantity * pricePerUnit, no quantity * purchasePrice.
describe("lib/recalculate: cascada de precio de ingrediente a costo de receta", () => {
  const businessId = "test-biz"

  beforeEach(() => {
    localStorage.clear()
  })

  function seedIngredient(overrides: Partial<Ingredient["pricing"]> = {}): Ingredient {
    const ingredient = {
      id: "ing-1",
      name: "Harina",
      category: "HARINA",
      unit: "gramos",
      pricing: {
        purchasePrice: 45,
        netContent: 1000,
        pricePerUnit: 0.045,
        lastUpdated: new Date().toISOString(),
        ...overrides,
      },
      supplier: "Proveedor Test",
      metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 },
    } as unknown as Ingredient
    saveIngredients([ingredient], businessId)
    return ingredient
  }

  function seedRecipe(quantityOfIngredient: number): Recipe {
    const recipe = {
      id: "recipe-1",
      name: "Pan casero",
      classification: "Panadería (Boulangerie)",
      yieldAmount: 4,
      totalCost: 0,
      costPerServing: 0,
      ingredients: [{ ingredientId: "ing-1", quantity: quantityOfIngredient }],
    } as unknown as Recipe
    saveRecipes([recipe], businessId)
    return recipe
  }

  it("pricePerUnit se calcula como precio de compra dividido entre contenido neto, no el precio del paquete tal cual", async () => {
    seedIngredient()
    seedRecipe(500)

    const result = await updateIngredientPriceAndRecalculate(businessId, "ing-1", 60)

    // 60 (nuevo precio del paquete) / 1000 (contenido neto en g) = 0.06 por gramo
    expect(result.affectedRecipes[0].newCost).toBeCloseTo(500 * 0.06, 5)
  })

  it("el costo de receta NO se calcula multiplicando la cantidad por el precio del paquete completo", async () => {
    seedIngredient()
    seedRecipe(500)

    const result = await updateIngredientPriceAndRecalculate(businessId, "ing-1", 60)

    // Si el bug reapareciera, esto daria 500 * 60 = 30000, un costo absurdo para 500g de harina.
    expect(result.affectedRecipes[0].newCost).not.toBeCloseTo(500 * 60, 0)
    expect(result.affectedRecipes[0].newCost).toBeLessThan(100)
  })

  it("persiste el nuevo costo en la receta guardada, no solo en el resultado devuelto", async () => {
    seedIngredient()
    seedRecipe(200)

    await updateIngredientPriceAndRecalculate(businessId, "ing-1", 50)

    const recipes = getRecipes(businessId)
    // 50 / 1000 = 0.05 por gramo; 200g * 0.05 = 10
    expect(recipes[0].totalCost).toBeCloseTo(10, 5)
    // costPerServing es el campo real que usa el resto de la app (Ficha Técnica, PDFs,
    // Estadísticas) — no unitCost, que no existe en Recipe (ver BUG CORREGIDO en
    // lib/recalculate.ts).
    expect(recipes[0].costPerServing).toBeCloseTo(10 / 4, 5) // yieldAmount = 4
  })

  it("una receta que no usa el ingrediente modificado no cambia de costo", async () => {
    seedIngredient()
    const untouchedRecipe = {
      id: "recipe-2",
      name: "Ensalada",
      classification: "Línea fría (Garde-manger / Cuisine froide)",
      yieldAmount: 2,
      totalCost: 15,
      costPerServing: 7.5,
      ingredients: [{ ingredientId: "ing-otro", quantity: 100 }],
    } as unknown as Recipe
    saveRecipes([untouchedRecipe], businessId)

    const result = await updateIngredientPriceAndRecalculate(businessId, "ing-1", 999)

    expect(result.affectedRecipes).toHaveLength(0)
    expect(getRecipes(businessId)[0].totalCost).toBe(15)
  })
})
