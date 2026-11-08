import { beforeEach, describe, expect, it, vi } from "vitest"

// Almacén en memoria por negocio, en lugar de Supabase.
const store: Record<string, { ingredients: any[]; recipes: any[] }> = {}
const bucket = (id: string) => (store[id] ??= { ingredients: [], recipes: [] })

vi.mock("../storage/ingredients", () => ({
  getIngredients: (b: string) => bucket(b).ingredients,
  saveIngredients: async (list: any[], b: string) => {
    bucket(b).ingredients = list
  },
  ensureIngredientsLoaded: async () => {},
}))
vi.mock("../storage/recipes", () => ({
  getRecipes: (b: string) => bucket(b).recipes,
  saveRecipes: async (list: any[], b: string) => {
    bucket(b).recipes = list
  },
  ensureRecipesLoaded: async () => {},
  isSubRecipe: () => false,
}))
vi.mock("./core", () => ({ syncSubRecipeToIngredient: () => {} }))

import { migrateCompleteRecipe } from "./migration"

const ing = (id: string, name: string, supplier: string, price: number) => ({
  id,
  name,
  category: "Vegetales",
  unit: "gramos",
  supplier,
  pricing: { purchasePrice: price, netContent: 1000, pricePerUnit: price / 1000, lastUpdated: "2026-11-01" },
  metadata: { createdAt: "", updatedAt: "", version: 1 },
})

describe("migrar una receta del espacio principal a un negocio (docs/263)", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
  })

  it("une cada línea a su propio ingrediente aunque dos se llamen igual", async () => {
    bucket("main").ingredients = [ing("t1", "Tomate", "Proveedor A", 30), ing("t2", "Tomate", "Proveedor B", 45), ing("s1", "Sal", "", 10)]
    const recipe = {
      id: "r1",
      name: "Salsa",
      ingredients: [
        { id: "l1", ingredientId: "t1", name: "Tomate", quantity: 500 },
        { id: "l2", ingredientId: "t2", name: "Tomate", quantity: 300 },
        { id: "l3", ingredientId: "s1", name: "Sal", quantity: 5 },
      ],
      metadata: { createdAt: "", updatedAt: "", version: 3 },
    } as any
    const res = await migrateCompleteRecipe(recipe, "main", "neg-1")
    expect(res.success).toBe(true)
    const target = bucket("neg-1")
    expect(target.ingredients).toHaveLength(3)
    const byId = new Map(target.ingredients.map((i) => [i.id, i]))
    const lines = res.migratedRecipe!.ingredients
    expect(byId.get(lines[0].ingredientId!)?.supplier).toBe("Proveedor A")
    expect(byId.get(lines[1].ingredientId!)?.supplier).toBe("Proveedor B")
    // Ninguna línea apunta a un ingrediente del espacio de origen.
    expect(lines.every((l: any) => byId.has(l.ingredientId))).toBe(true)
    // Sin la nota «Migrado desde <id>» en español: el origen queda en metadata.
    expect(target.ingredients.every((i) => !String(i.notes || "").includes("Migrado"))).toBe(true)
    expect(res.migratedRecipe!.metadata.migratedFrom).toBe("main")
    expect(target.recipes).toHaveLength(1)
  })

  it("reutiliza el ingrediente que ya existe igual en el negocio", async () => {
    bucket("main").ingredients = [ing("t1", "Tomate", "Proveedor A", 30)]
    bucket("neg-1").ingredients = [{ ...ing("x9", "Tomate", "Proveedor A", 30) }]
    const recipe = { id: "r1", name: "Salsa", ingredients: [{ id: "l1", ingredientId: "t1", name: "Tomate", quantity: 500 }], metadata: { createdAt: "", updatedAt: "", version: 1 } } as any
    const res = await migrateCompleteRecipe(recipe, "main", "neg-1")
    expect(bucket("neg-1").ingredients).toHaveLength(1)
    expect(res.migratedRecipe!.ingredients[0].ingredientId).toBe("x9")
  })
})
