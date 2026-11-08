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

describe("elegir qué hacer con cada ingrediente al migrar (docs/264)", () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
  })

  it("propone usar el del mismo nombre y deja fuera los que ya existen igual", async () => {
    const { planIngredientMigration } = await import("./migration")
    const source = [ing("t1", "Tomate", "A", 30), ing("s1", "Sal", "", 10), ing("q1", "Queso", "", 90)]
    const target = [ing("x1", "Tomate", "Mercado", 25), ing("x2", "Sal", "", 10)]
    const recipe = { ingredients: [{ ingredientId: "t1" }, { ingredientId: "s1" }, { ingredientId: "q1" }] } as any
    const rows = planIngredientMigration(recipe, source as any, target as any)
    expect(rows.find((r) => r.sourceId === "s1")?.exactId).toBe("x2")
    expect(rows.find((r) => r.sourceId === "t1")?.sameName.map((i) => i.id)).toEqual(["x1"])
    expect(rows.find((r) => r.sourceId === "q1")?.sameName).toEqual([])
  })

  it("une al ingrediente elegido del negocio y copia el resto", async () => {
    bucket("main").ingredients = [ing("t1", "Tomate", "A", 30), ing("q1", "Queso", "", 90)]
    bucket("neg-1").ingredients = [ing("x1", "Tomate", "Mercado", 25)]
    const recipe = {
      id: "r1",
      name: "Pizza",
      ingredients: [
        { id: "l1", ingredientId: "t1", name: "Tomate", quantity: 200 },
        { id: "l2", ingredientId: "q1", name: "Queso", quantity: 150 },
      ],
      metadata: { createdAt: "", updatedAt: "", version: 1 },
    } as any
    const res = await migrateCompleteRecipe(recipe, "main", "neg-1", undefined, { ingredientChoices: { t1: "x1", q1: "copy" } })
    const lines = res.migratedRecipe!.ingredients
    expect(lines[0].ingredientId).toBe("x1")
    const target = bucket("neg-1").ingredients
    expect(target).toHaveLength(2) // Tomate del negocio + Queso copiado; no un segundo Tomate
    expect(target.find((i) => i.id === lines[1].ingredientId)?.name).toBe("Queso")
    expect(res.migratedRecipe!.id).not.toBe("r1") // la copia tiene su propio id
  })
})

describe("costo con los precios del negocio (docs/264)", () => {
  it("al unir al Tomate del negocio, la línea vale su precio", async () => {
    for (const k of Object.keys(store)) delete store[k]
    bucket("main").ingredients = [ing("t1", "Tomate", "A", 30)]
    bucket("neg-1").ingredients = [ing("x1", "Tomate", "Mercado", 25)]
    const recipe = { id: "r1", name: "Salsa", yieldAmount: 4, ingredients: [{ id: "l1", ingredientId: "t1", name: "Tomate", quantity: 200, extension: 6 }], metadata: { createdAt: "", updatedAt: "", version: 1 } } as any
    const res = await migrateCompleteRecipe(recipe, "main", "neg-1", undefined, { ingredientChoices: { t1: "x1" } })
    // 200 g × 25/1000 = 5; 4 porciones → 1.25
    expect(res.migratedRecipe!.totalCost).toBeCloseTo(5)
    expect(res.migratedRecipe!.costPerServing).toBeCloseTo(1.25)
  })
})

vi.mock("../storage/businesses", () => ({ getAllBusinesses: () => [{ id: "neg-1" }] }))

describe("copia sincronizada con su original (docs/264)", () => {
  it("al guardar la original, la copia se actualiza con su mismo id y las uniones elegidas", async () => {
    for (const k of Object.keys(store)) delete store[k]
    const { syncMigratedCopies } = await import("./migration")
    bucket("main").ingredients = [ing("t1", "Tomate", "A", 30), ing("q1", "Queso", "", 90)]
    bucket("neg-1").ingredients = [ing("x1", "Tomate", "Mercado", 25)]
    const original = { id: "r1", name: "Pizza", yieldAmount: 1, ingredients: [{ id: "l1", ingredientId: "t1", name: "Tomate", quantity: 200 }], procedure: ["Hornear"], metadata: { createdAt: "", updatedAt: "", version: 1 } } as any
    bucket("main").recipes = [original]
    const first = await migrateCompleteRecipe(original, "main", "neg-1", undefined, { ingredientChoices: { t1: "x1" }, keepSynced: true })
    const copyId = first.migratedRecipe!.id
    expect(first.migratedRecipe!.metadata.syncedFrom?.ingredientMap).toEqual({ t1: "x1" })

    // Se edita la original: más tomate, un ingrediente nuevo y otro procedimiento.
    const edited = { ...original, procedure: ["Hornear 12 min"], ingredients: [{ id: "l1", ingredientId: "t1", name: "Tomate", quantity: 300 }, { id: "l2", ingredientId: "q1", name: "Queso", quantity: 100 }] }
    const n = await syncMigratedCopies(edited, "main")
    expect(n).toBe(1)
    const copies = bucket("neg-1").recipes
    expect(copies).toHaveLength(1)
    const copy = copies[0]
    expect(copy.id).toBe(copyId)
    expect(copy.procedure).toEqual(["Hornear 12 min"])
    expect(copy.ingredients[0].ingredientId).toBe("x1") // sigue unida al Tomate del negocio
    expect(bucket("neg-1").ingredients.some((i) => i.name === "Queso")).toBe(true) // el nuevo se copió
    // 300 g × 25/1000 + 100 g × 90/1000 = 7.5 + 9 = 16.5
    expect(copy.totalCost).toBeCloseTo(16.5)
  })

  it("sin la casilla, la copia queda independiente y no se toca", async () => {
    for (const k of Object.keys(store)) delete store[k]
    const { syncMigratedCopies } = await import("./migration")
    bucket("main").ingredients = [ing("t1", "Tomate", "A", 30)]
    const original = { id: "r1", name: "Salsa", yieldAmount: 1, ingredients: [{ id: "l1", ingredientId: "t1", name: "Tomate", quantity: 100 }], metadata: { createdAt: "", updatedAt: "", version: 1 } } as any
    await migrateCompleteRecipe(original, "main", "neg-1")
    const n = await syncMigratedCopies({ ...original, name: "Salsa nueva" }, "main")
    expect(n).toBe(0)
    expect(bucket("neg-1").recipes[0].name).toBe("Salsa")
  })
})
