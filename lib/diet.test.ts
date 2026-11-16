import { describe, expect, it } from "vitest"
import { dishLabels, ingredientDiet, recipeDiet } from "./diet"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

const ing = (id: string, name: string, category: string, extra: Partial<Ingredient> = {}) => ({ id, name, category, allergens: [], ...extra }) as unknown as Ingredient
const rec = (id: string, ids: string[], extra: Partial<Recipe> = {}) => ({ id, name: id, ingredients: ids.map((i) => ({ ingredientId: i, quantity: 1 })), ...extra }) as unknown as Recipe

describe("tipo de plato (docs/324)", () => {
  it("proteína por categoría y por nombre", () => {
    expect(ingredientDiet(ing("a", "Lomo", "RES")).protein).toBe("beef")
    expect(ingredientDiet(ing("b", "Caldo de pollo", "SECOS Y ABARROTES")).protein).toBe("poultry")
    expect(ingredientDiet(ing("c", "Gelatina sin sabor", "REPOSTERÍA")).protein).toBe("pork")
    expect(ingredientDiet(ing("d", "Chorizo de soya", "EMBUTIDO", { dietOverride: "plant" } as never)).protein).toBe(null)
    expect(ingredientDiet(ing("e", "Leche de coco", "LÁCTEOS Y DERIVADOS")).animalProduct).toBe(false)
  })
  it("vegano, vegetariano y con carne, también a través de subrecetas", () => {
    const ings = [ing("t", "Tomate", "FRUTA"), ing("q", "Queso", "LÁCTEOS Y DERIVADOS", { allergens: ["milk"] }), ing("p", "Pechuga", "AVES"), ing("s", "Salsa base", "Sub Receta / produccion (Mise en place)", { recipeId: "salsa" } as never)]
    const salsa = rec("salsa", ["t", "q"])
    expect(recipeDiet(rec("ensalada", ["t"]), ings, [])).toMatchObject({ vegan: true, vegetarian: true })
    expect(recipeDiet(rec("pizza", ["s"]), ings, [salsa])).toMatchObject({ vegan: false, vegetarian: true, animalFrom: ["Queso"] })
    expect(recipeDiet(rec("pollo", ["p", "t"]), ings, [])).toMatchObject({ vegetarian: false, proteins: ["poultry"] })
  })
  it("una declaración solo vale si los ingredientes no la contradicen", () => {
    const ings = [ing("h", "Harina de trigo", "HARINA", { allergens: ["gluten"] }), ing("t", "Tomate", "FRUTA")]
    const pan = dishLabels(rec("pan", ["h"], { dietClaims: { vegan: true, glutenFree: true, allergenFree: true } }), ings, [])
    expect(pan.claims).toMatchObject({ vegan: true, glutenFree: false, allergenFree: false })
    expect(pan.claims.conflicts.find((c) => c.claim === "glutenFree")?.because).toEqual(["Harina de trigo"])
    const ens = dishLabels(rec("ens", ["t"], { dietClaims: { allergenFree: true, mayContain: ["peanuts"] } }), ings, [])
    expect(ens.claims.allergenFree).toBe(false) // con trazas declaradas no es «sin alérgenos»
    expect(ens.mayContain).toEqual(["peanuts"])
  })
})
