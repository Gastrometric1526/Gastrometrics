import { describe, it, expect } from "vitest"
import { getRecipeAllergens } from "./allergens"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

const ing = (id: string, allergens: string[], recipeId?: string) => ({ id, name: id, allergens, recipeId }) as unknown as Ingredient
const rec = (id: string, ingredientIds: string[]) =>
  ({ id, ingredients: ingredientIds.map((ingredientId) => ({ ingredientId })) }) as unknown as Recipe

describe("getRecipeAllergens (docs/137)", () => {
  it("une los alérgenos de los ingredientes, en el orden oficial y sin repetir", () => {
    const ingredients = [ing("harina", ["gluten"]), ing("leche", ["milk"]), ing("mantequilla", ["milk"])]
    expect(getRecipeAllergens(rec("pan", ["leche", "harina", "mantequilla"]), ingredients, [])).toEqual(["gluten", "milk"])
  })

  it("hereda los alérgenos de una sub-receta", () => {
    const ingredients = [ing("huevo", ["eggs"]), ing("aceite", []), ing("mayonesa", [], "r-mayo"), ing("pan", ["gluten"])]
    const recipes = [rec("r-mayo", ["huevo", "aceite"])]
    expect(getRecipeAllergens(rec("sandwich", ["pan", "mayonesa"]), ingredients, recipes)).toEqual(["gluten", "eggs"])
  })

  it("no se cuelga si una sub-receta se usa a sí misma, e ignora claves desconocidas", () => {
    const ingredients = [ing("fondo", ["celery", "xyz"], "r-fondo")]
    const recipes = [rec("r-fondo", ["fondo"])]
    expect(getRecipeAllergens(rec("r-fondo", ["fondo"]), ingredients, recipes)).toEqual(["celery"])
  })

  it("sin ingredientes con alérgenos devuelve una lista vacía", () => {
    expect(getRecipeAllergens(rec("agua", ["x"]), [ing("x", [])], [])).toEqual([])
  })
})
