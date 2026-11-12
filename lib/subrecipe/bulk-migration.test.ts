import { describe, expect, it, vi } from "vitest"

vi.mock("../storage/recipes", () => ({
  getRecipes: () => [],
  ensureRecipesLoaded: async () => {},
  isSubRecipe: (r: { isSubRecipe?: boolean }) => !!r.isSubRecipe,
}))
vi.mock("../storage/ingredients", () => ({ getIngredients: () => [], saveIngredients: async () => {}, ensureIngredientsLoaded: async () => {} }))
vi.mock("./migration", () => ({
  migrateCompleteRecipe: async () => ({ success: true }),
  findSimilarIngredient: (ing: { name: string }, target: { name: string }[]) => target.find((t) => t.name.toLowerCase() === ing.name.toLowerCase()),
}))

import { looseIngredientsToCopy, planBulkMigration } from "./bulk-migration"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"

const r = (id: string, name: string, sub = false) => ({ id, name, isSubRecipe: sub }) as unknown as Recipe
const ing = (id: string, name: string, recipeId?: string) => ({ id, name, recipeId }) as unknown as Ingredient

describe("traer del espacio principal a un negocio (docs/284)", () => {
  it("migra primero las subrecetas y salta lo que el negocio ya tiene con el mismo nombre", () => {
    const source = [r("1", "Pollo a la plancha"), r("2", "Salsa de tomate", true), r("3", "Limonada"), r("4", "Jarabe simple", true)]
    const plan = planBulkMigration(source, ["1", "2", "3", "4"], [r("x", "  limonada ")])
    expect(plan.toMigrate.map((x) => x.id)).toEqual(["2", "4", "1"])
    expect(plan.alreadyThere.map((x) => x.id)).toEqual(["3"])
  })

  it("solo lleva las recetas elegidas", () => {
    const plan = planBulkMigration([r("1", "A"), r("2", "B")], ["2"], [])
    expect(plan.toMigrate.map((x) => x.id)).toEqual(["2"])
  })

  it("los ingredientes sueltos no incluyen los de subrecetas ni los que el negocio ya tiene", () => {
    const source = [ing("a", "Harina"), ing("b", "Azúcar"), ing("c", "Salsa de tomate", "rec-salsa")]
    const out = looseIngredientsToCopy(source, [ing("z", "harina")])
    expect(out.map((x) => x.id)).toEqual(["b"])
  })
})
