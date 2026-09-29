// Alérgenos (docs/137). Se marcan en cada ingrediente y la receta los hereda sola, sub-recetas
// incluidas — nunca se escriben a mano en la receta, así no quedan desactualizados. Lista: los
// 14 alérgenos de declaración obligatoria del Reglamento (UE) 1169/2011, que es la referencia
// más usada también fuera de Europa.

import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const

export type AllergenKey = (typeof ALLERGENS)[number]

/** Clave de traducción de un alérgeno (lib/i18n/translations.ts). */
export function allergenLabelKey(key: AllergenKey): `allergen_${AllergenKey}` {
  return `allergen_${key}`
}

export function isAllergenKey(value: string): value is AllergenKey {
  return (ALLERGENS as readonly string[]).includes(value)
}

/**
 * Alérgenos de una receta: la unión de los de sus ingredientes. Si una línea es una
 * sub-receta (ingrediente con recipeId), se suman también los alérgenos de esa receta,
 * recursivamente. `visited` evita ciclos si una sub-receta se usara a sí misma.
 * Devuelve las claves en el orden de ALLERGENS.
 */
export function getRecipeAllergens(
  recipe: Pick<Recipe, "id" | "ingredients">,
  ingredients: Ingredient[],
  recipes: Recipe[],
  visited: Set<string> = new Set(),
): AllergenKey[] {
  if (visited.has(recipe.id)) return []
  visited.add(recipe.id)
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]))
  const found = new Set<AllergenKey>()
  for (const line of recipe.ingredients || []) {
    if (!line.ingredientId) continue
    const ingredient = byId.get(line.ingredientId)
    if (!ingredient) continue
    for (const key of ingredient.allergens || []) if (isAllergenKey(key)) found.add(key)
    const subRecipeId = ingredient.recipeId || ingredient.recipeData?.originalRecipeId
    const subRecipe = subRecipeId ? recipes.find((r) => r.id === subRecipeId) : undefined
    if (subRecipe) for (const key of getRecipeAllergens(subRecipe, ingredients, recipes, visited)) found.add(key)
  }
  return ALLERGENS.filter((key) => found.has(key))
}
