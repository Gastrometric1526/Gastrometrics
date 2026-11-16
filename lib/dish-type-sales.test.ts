import { describe, expect, it } from "vitest"
import { salesByDishType } from "./dish-type-sales"
import { dishLabels, type DishLabels } from "./diet"
import { computeDishOverview } from "./admin/dish-overview"
import type { DishPerformance } from "./sales-analytics"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

const ing = (id: string, name: string, category: string, extra: Partial<Ingredient> = {}) => ({ id, name, category, allergens: [], ...extra }) as unknown as Ingredient
const rec = (id: string, ids: string[], extra: Partial<Recipe> = {}) => ({ id, name: id, ingredients: ids.map((i) => ({ ingredientId: i, quantity: 1 })), ...extra }) as unknown as Recipe
const dish = (recipeId: string | null, revenue: number, qty: number, margin: number, tax = 0, linked = true) =>
  ({ recipeId, name: recipeId ?? "menú", quantitySold: qty, revenue, tax, theoreticalCost: 0, contributionMargin: margin, contributionMarginPercent: 0, unitPrice: 0, unitCost: 0, linked }) as DishPerformance

const ings = [ing("res", "Lomo", "RES"), ing("cam", "Camarón", "MARISCOS", { allergens: ["crustaceans"] }), ing("tom", "Tomate", "FRUTA"), ing("har", "Harina de trigo", "HARINA", { allergens: ["gluten"] }), ing("que", "Queso", "LÁCTEOS Y DERIVADOS", { allergens: ["milk"] })]
const recipes = [rec("mar-tierra", ["res", "cam"]), rec("ensalada", ["tom"]), rec("pizza", ["har", "que", "tom"])]

describe("ventas por tipo de plato (docs/325)", () => {
  const labels = new Map<string, DishLabels>(recipes.map((r) => [r.id, dishLabels(r, ings, recipes)]))
  // Cálculo a mano: neta mar y tierra 115 − 15 = 100; ensalada 50; pizza 50 → base 200.
  const res = salesByDishType([dish("mar-tierra", 115, 5, 40, 15), dish("ensalada", 50, 10, 30), dish("pizza", 50, 4, 20), dish(null, 70, 2, 0), dish("x", 99, 1, 0, 0, false)], labels)
  it("usa la venta neta de los platos con receta como base y deja fuera menús y sin vincular", () => {
    expect(res.recipeNet).toBe(200)
    expect(res.menuNet).toBe(70)
  })
  it("un plato cuenta en cada carne y el vegano también es vegetariano", () => {
    const by = Object.fromEntries(res.rows.map((r) => [r.key, r]))
    expect(by.beef).toMatchObject({ dishes: 1, units: 5, net: 100, share: 50, margin: 40 })
    expect(by.seafood.net).toBe(100)
    expect(by.vegetarian).toMatchObject({ dishes: 2, net: 100, share: 50 })
    expect(by.vegan).toMatchObject({ dishes: 1, net: 50, share: 25 })
    expect(by.gluten_free).toMatchObject({ dishes: 2, net: 150, share: 75 })
  })
})

describe("tipo de plato en /admin (docs/325)", () => {
  const row = (r: Recipe, owner: string) => ({ id: r.id, owner_id: owner, business_id: null, name: r.id, classification: "Platos fuertes", is_sub_recipe: false, data: r as unknown as Record<string, unknown> })
  const irow = (i: Ingredient, owner: string) => ({ id: i.id, owner_id: owner, business_id: null, name: i.name, category: i.category, data: i as unknown as Record<string, unknown> })
  it("cuenta platos, carnes, alérgenos y uso solo de cuentas confirmadas", () => {
    const o = computeDishOverview(
      new Set(["a"]),
      [...recipes.map((r) => row(r, "a")), row(rec("ajena", ["res"]), "b"), { ...row(rec("salsa", ["tom"]), "a"), is_sub_recipe: true }],
      [...ings.map((i) => irow(i, "a")), irow(ing("h2", "Harina", "HARINA"), "a")],
    )
    expect(o.dishes).toBe(3)
    expect(o.vegetarian).toBe(2)
    expect(o.vegan).toBe(1)
    expect(o.withMeat).toBe(1)
    expect(o.withAllergens).toBe(2)
    expect(o.proteins.find((p) => p.key === "beef")).toMatchObject({ dishes: 1, accounts: 1 })
    expect(o.allergens.map((a) => a.key)).toEqual(["gluten", "crustaceans", "milk"])
    expect(o.ingredients).toBe(6)
    expect(o.ingredientsWithAllergens).toBe(3)
    // «Harina» sin gluten marcado y «Camarón» (Mariscos también sugiere moluscos).
    expect(o.ingredientsPending).toBe(2)
    expect(o.accountsMarkingAllergens).toBe(1)
  })
})
