/**
 * /admin → «Toda la app» → «Tipo de plato» (pedido del dueño, docs/325): qué platos tienen las
 * cuentas (con res, cerdo, pollo…, vegetarianos, veganos), cuántos llevan alérgenos y cuánto se
 * usa la función de alérgenos (marcados, sugerencias pendientes y lo confirmado en la Ficha).
 * Solo cuentas con el correo confirmado (docs/201). Usa las mismas funciones que la app
 * (`dishLabels`, `pendingSuggestions`), así lo que ve el dueño es lo que ven las personas.
 */

import { ALLERGENS, type AllergenKey } from "@/lib/allergens"
import { pendingSuggestions } from "@/lib/allergen-suggest"
import { dishLabels, PROTEINS, type Protein } from "@/lib/diet"
import { isBeverageRecipe } from "@/lib/beverage"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

export type RecipeRowLite = { id: string; owner_id: string; business_id: string | null; name: string; classification: string | null; is_sub_recipe: boolean | null; data: Record<string, unknown> | null }
export type IngredientRowLite = { id: string; owner_id: string; business_id: string | null; name: string; category: string; data: Record<string, unknown> | null }

export interface DishOverview {
  dishes: number
  accountsWithDishes: number
  proteins: { key: Protein; dishes: number; accounts: number }[]
  vegetarian: number
  vegan: number
  withMeat: number
  glutenFree: number
  withAllergens: number
  allergens: { key: AllergenKey; dishes: number }[]
  /** Lo que las personas confirmaron en la Ficha (y vale). */
  confirmed: { vegan: number; vegetarian: number; glutenFree: number; allergenFree: number; traces: number }
  accountsConfirming: number
  ingredients: number
  ingredientsWithAllergens: number
  ingredientsPending: number
  ingredientsOverride: number
  accountsMarkingAllergens: number
}

type OwnedRecipe = Recipe & { __owner: string }

export function computeDishOverview(confirmedIds: Set<string>, recipeRows: RecipeRowLite[], ingredientRows: IngredientRowLite[]): DishOverview {
  const ingredients = ingredientRows
    .filter((r) => confirmedIds.has(r.owner_id))
    .map((r) => ({ ...(r.data as Partial<Ingredient>), id: r.id, name: r.name, category: r.category }) as Ingredient)
  const recipes = recipeRows
    .filter((r) => confirmedIds.has(r.owner_id))
    .map((r) => ({ ...(r.data as Partial<Recipe>), id: r.id, name: r.name, classification: r.classification, isSubRecipe: !!r.is_sub_recipe, __owner: r.owner_id }) as OwnedRecipe)

  const proteinDishes = new Map<Protein, number>()
  const proteinAccounts = new Map<Protein, Set<string>>()
  const allergenDishes = new Map<AllergenKey, number>()
  const accountsWithDishes = new Set<string>()
  const accountsConfirming = new Set<string>()
  const o: DishOverview = {
    dishes: 0,
    accountsWithDishes: 0,
    proteins: [],
    vegetarian: 0,
    vegan: 0,
    withMeat: 0,
    glutenFree: 0,
    withAllergens: 0,
    allergens: [],
    confirmed: { vegan: 0, vegetarian: 0, glutenFree: 0, allergenFree: 0, traces: 0 },
    accountsConfirming: 0,
    ingredients: 0,
    ingredientsWithAllergens: 0,
    ingredientsPending: 0,
    ingredientsOverride: 0,
    accountsMarkingAllergens: 0,
  }

  for (const r of recipes) {
    // Platos de comida: sin subrecetas ni bebidas.
    if (r.isSubRecipe || isBeverageRecipe(r)) continue
    const l = dishLabels(r, ingredients, recipes)
    o.dishes++
    accountsWithDishes.add(r.__owner)
    for (const p of l.proteins) {
      proteinDishes.set(p, (proteinDishes.get(p) ?? 0) + 1)
      const s = proteinAccounts.get(p) ?? new Set<string>()
      s.add(r.__owner)
      proteinAccounts.set(p, s)
    }
    if (l.diet.vegetarian) o.vegetarian++
    else o.withMeat++
    if (l.diet.vegan) o.vegan++
    if (!l.allergens.includes("gluten") && !l.mayContain.includes("gluten")) o.glutenFree++
    if (l.allergens.length > 0) o.withAllergens++
    for (const a of l.allergens) allergenDishes.set(a, (allergenDishes.get(a) ?? 0) + 1)
    const c = l.claims
    if (c.vegan) o.confirmed.vegan++
    if (c.vegetarian) o.confirmed.vegetarian++
    if (c.glutenFree) o.confirmed.glutenFree++
    if (c.allergenFree) o.confirmed.allergenFree++
    if (l.mayContain.length > 0) o.confirmed.traces++
    if (c.vegan || c.vegetarian || c.glutenFree || c.allergenFree || l.mayContain.length > 0) accountsConfirming.add(r.__owner)
  }

  const marking = new Set<string>()
  const ownerOf = new Map(ingredientRows.map((r) => [r.id, r.owner_id]))
  for (const i of ingredients) {
    // Las subrecetas usadas como ingrediente heredan sus alérgenos: no se cuentan aquí.
    if (i.recipeId || i.recipeData) continue
    o.ingredients++
    if ((i.allergens ?? []).length > 0) {
      o.ingredientsWithAllergens++
      const owner = ownerOf.get(i.id)
      if (owner) marking.add(owner)
    }
    if (pendingSuggestions(i).length > 0) o.ingredientsPending++
    if (i.dietOverride) o.ingredientsOverride++
  }

  o.accountsWithDishes = accountsWithDishes.size
  o.accountsConfirming = accountsConfirming.size
  o.accountsMarkingAllergens = marking.size
  o.proteins = PROTEINS.map((key) => ({ key, dishes: proteinDishes.get(key) ?? 0, accounts: proteinAccounts.get(key)?.size ?? 0 })).sort((a, b) => b.dishes - a.dishes)
  o.allergens = ALLERGENS.map((key) => ({ key, dishes: allergenDishes.get(key) ?? 0 }))
    .filter((a) => a.dishes > 0)
    .sort((a, b) => b.dishes - a.dishes)
  return o
}
