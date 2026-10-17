import { describe, it, expect, beforeEach } from "vitest"
import { updateIngredientPriceAndRecalculate, applySubRecipePriceDecisions, recalculateDependentsOfSubRecipe } from "./recalculate"
import { syncSubRecipeToIngredient } from "./subrecipe/core"
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

// Regla de precio de docs/162: el precio de venta solo sube con el costo; si el costo baja
// se mantiene como precio escrito a mano y se informa el margen nuevo.
describe("lib/recalculate: regla de precio al cambiar el costo (docs/162)", () => {
  const businessId = "test-biz-precio"

  beforeEach(() => {
    localStorage.clear()
    saveIngredients(
      [
        {
          id: "pollo",
          name: "Pollo",
          category: "CARNES",
          unit: "gramos",
          pricing: { purchasePrice: 120, netContent: 1000, pricePerUnit: 0.12, lastUpdated: new Date().toISOString() },
          metadata: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 },
        } as unknown as Ingredient,
      ],
      businessId,
    )
    // 300 g × 0.12 = 36 de costo; Food Cost 30 % → precio 120
    saveRecipes(
      [
        {
          id: "plato",
          name: "Pollo a la plancha",
          classification: "Plato fuerte",
          yieldAmount: 1,
          totalCost: 36,
          costPerServing: 36,
          unitPrice: 120,
          pricingMethod: "food_cost",
          targetFoodCostPercent: 30,
          ingredients: [{ ingredientId: "pollo", quantity: 300 }],
        } as unknown as Recipe,
      ],
      businessId,
    )
  })

  it("si sube el ingrediente, sube el precio de la receta y lo guarda", async () => {
    const result = await updateIngredientPriceAndRecalculate(businessId, "pollo", 150) // costo 45 → 150
    expect(result.priceChanges).toEqual([
      expect.objectContaining({ kind: "raised", recipeName: "Pollo a la plancha", oldPrice: 120, newPrice: 150 }),
    ])
    expect(getRecipes(businessId)[0].unitPrice).toBe(150)
  })

  it("si baja el ingrediente, el precio se mantiene (como escrito a mano) y se informa el margen mayor", async () => {
    const result = await updateIngredientPriceAndRecalculate(businessId, "pollo", 100) // costo 30
    const change = result.priceChanges[0]
    expect(change.kind).toBe("kept")
    if (change.kind === "kept") {
      expect(change.price).toBe(120)
      expect(change.newMargin).toBeGreaterThan(change.oldMargin)
    }
    const saved = getRecipes(businessId)[0]
    expect(saved.unitPrice).toBe(120)
    expect(saved.customUnitPrice).toBe(120)
  })
})

// docs/164: cascada completa (ingrediente → sub-receta → platos que la usan) y la pregunta
// por el precio de venta escrito a mano de las sub-recetas.
describe("lib/recalculate: cascada por sub-recetas y precio de sub-recetas (docs/164)", () => {
  const businessId = "test-biz-subreceta"
  const now = () => new Date().toISOString()

  function seed(subRecipeExtra: Partial<Recipe> = {}) {
    localStorage.clear()
    saveIngredients(
      [
        {
          id: "tomate",
          name: "Tomate",
          category: "VEGETAL",
          unit: "gramos",
          pricing: { purchasePrice: 20, netContent: 1000, pricePerUnit: 0.02, lastUpdated: now() },
          metadata: { createdAt: now(), updatedAt: now(), version: 1 },
        } as unknown as Ingredient,
        {
          id: "salsa-ing",
          name: "Salsa de tomate",
          category: "Sub Receta / produccion (Mise en place)",
          unit: "unidad",
          recipeId: "salsa",
          pricing: { purchasePrice: 2, netContent: 10, pricePerUnit: 2, lastUpdated: now() },
          metadata: { createdAt: now(), updatedAt: now(), version: 1 },
        } as unknown as Ingredient,
      ],
      businessId,
    )
    saveRecipes(
      [
        {
          // 1000 g × 0.02 = 20 → 10 porciones de 2. Precio de venta escrito a mano: 10.
          id: "salsa",
          name: "Salsa de tomate",
          classification: "Sub Receta / produccion (Mise en place)",
          yieldAmount: 10,
          yieldUnit: "porciones",
          totalCost: 20,
          costPerServing: 2,
          unitPrice: 10,
          customUnitPrice: 10,
          pricingMethod: "food_cost",
          targetFoodCostPercent: 30,
          ingredients: [{ ingredientId: "tomate", quantity: 1000 }],
          ...subRecipeExtra,
        } as unknown as Recipe,
        {
          // Lleva salsa, no tomate suelto: 2 porciones × 2 = 4 de costo → precio 15.
          id: "pasta",
          name: "Pasta pomodoro",
          classification: "Plato fuerte",
          yieldAmount: 1,
          totalCost: 4,
          costPerServing: 4,
          unitPrice: 15,
          pricingMethod: "food_cost",
          targetFoodCostPercent: 30,
          ingredients: [{ ingredientId: "salsa-ing", quantity: 2 }],
        } as unknown as Recipe,
      ],
      businessId,
    )
  }

  const recipe = (id: string) => getRecipes(businessId).find((r) => r.id === id)!

  it("recalcula los platos que usan la sub-receta, no solo la sub-receta", async () => {
    seed()
    const result = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    expect(recipe("salsa").totalCost).toBeCloseTo(40, 5)
    expect(recipe("pasta").totalCost).toBeCloseTo(8, 5) // 2 × (40 ÷ 10)
    expect(recipe("pasta").unitPrice).toBe(30) // 8 ÷ 0.30 = 26.67 → 30
    expect(result.priceChanges).toContainEqual(expect.objectContaining({ kind: "raised", recipeName: "Pasta pomodoro" }))
  })

  it("«Preguntarme» (por defecto): la sub-receta queda pendiente y su precio no cambia", async () => {
    seed()
    const result = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    expect(result.pendingSubRecipePrices).toEqual([
      { recipeId: "salsa", recipeName: "Salsa de tomate", currentPrice: 10, suggestedPrice: 15 },
    ])
    expect(recipe("salsa").customUnitPrice).toBe(10)
    expect(result.priceChanges.some((c) => c.recipeId === "salsa")).toBe(false)
  })

  it("«Actualizar siempre»: sube el precio de la sub-receta sin preguntar", async () => {
    seed({ subRecipePriceUpdate: "always" })
    const result = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    expect(result.pendingSubRecipePrices).toEqual([])
    expect(recipe("salsa").customUnitPrice).toBe(15)
    expect(recipe("salsa").unitPrice).toBe(15)
    expect(result.priceChanges).toContainEqual(expect.objectContaining({ kind: "raised", recipeId: "salsa", newPrice: 15 }))
  })

  it("«No actualizar nunca»: solo cambia el costo", async () => {
    seed({ subRecipePriceUpdate: "never" })
    const result = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    expect(result.pendingSubRecipePrices).toEqual([])
    expect(recipe("salsa").customUnitPrice).toBe(10)
    expect(recipe("salsa").totalCost).toBeCloseTo(40, 5)
  })

  it("una sub-receta sin precio escrito a mano no se pregunta", async () => {
    seed({ customUnitPrice: undefined })
    const result = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    expect(result.pendingSubRecipePrices).toEqual([])
  })

  it("aceptar con «Recordar» sube el precio y guarda «siempre»; rechazar guarda «nunca»", async () => {
    seed()
    const result = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    const accepted = await applySubRecipePriceDecisions(businessId, result.pendingSubRecipePrices, ["salsa"], true)
    expect(accepted).toEqual([expect.objectContaining({ kind: "raised", recipeId: "salsa", oldPrice: 10, newPrice: 15 })])
    expect(recipe("salsa").customUnitPrice).toBe(15)
    expect(recipe("salsa").subRecipePriceUpdate).toBe("always")

    seed()
    const again = await updateIngredientPriceAndRecalculate(businessId, "tomate", 40)
    const rejected = await applySubRecipePriceDecisions(businessId, again.pendingSubRecipePrices, [], true)
    expect(rejected).toEqual([])
    expect(recipe("salsa").customUnitPrice).toBe(10)
    expect(recipe("salsa").subRecipePriceUpdate).toBe("never")
  })

  it("guardar una sub-receta recalcula los platos que la usan", async () => {
    seed()
    const salsa = { ...recipe("salsa"), totalCost: 30, costPerServing: 3 }
    saveRecipes(getRecipes(businessId).map((r) => (r.id === "salsa" ? salsa : r)), businessId)
    syncSubRecipeToIngredient(salsa, businessId)
    const result = await recalculateDependentsOfSubRecipe(businessId, "salsa")
    expect(result).not.toBeNull()
    expect(recipe("pasta").totalCost).toBeCloseTo(6, 5) // 2 × 3
    expect(recipe("pasta").unitPrice).toBe(20) // 6 ÷ 0.30 = 20
  })
})
