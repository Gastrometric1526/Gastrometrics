/**
 * Tipo de plato (pedido del dueño, docs/324): qué proteína lleva (res, cerdo, pollo, pescado,
 * mariscos, caza, embutido) y si es vegetariano o vegano, según la categoría y el nombre de sus
 * ingredientes, subrecetas incluidas. Cada ingrediente puede corregirse a mano (`dietOverride`).
 *
 * Lo que se muestra al cliente (carta y fichas) como «Vegano», «Vegetariano», «Sin gluten» o
 * «Sin alérgenos» es lo que la persona CONFIRMA en la Ficha Técnica (`recipe.dietClaims`), y solo
 * vale si los ingredientes no dicen lo contrario (`validClaims`). Las proteínas se muestran solas.
 */

import { getRecipeAllergens, type AllergenKey } from "@/lib/allergens"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

export const PROTEINS = ["beef", "pork", "poultry", "fish", "seafood", "game", "cured"] as const
export type Protein = (typeof PROTEINS)[number]

export type DietOverride = "plant" | "animal_product" | "meat"

const CATEGORY_PROTEIN: Record<string, Protein> = {
  RES: "beef",
  CERDO: "pork",
  AVES: "poultry",
  PESCADO: "fish",
  MARISCOS: "seafood",
  GAME: "game",
  EMBUTIDO: "cured",
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()

/** Palabras que delatan carne o pescado en otras categorías (caldos, grasas, gelatina…). */
const NAME_PROTEIN: [Protein, string[]][] = [
  ["pork", ["cerdo", "tocino", "manteca de cerdo", "chicharron", "jamon", "bacon", "pork", "lard", "ham", "porco", "toucinho", "banha", "presunto", "porc", "lardon", "jambon", "svin", "flaesk", "skinke", "猪", "培根", "火腿"]],
  ["beef", ["res", "carne de res", "caldo de res", "beef", "boeuf", "carne bovina", "oksekod", "牛肉"]],
  ["poultry", ["pollo", "gallina", "pavo", "caldo de pollo", "chicken", "turkey", "frango", "peru", "poulet", "dinde", "kylling", "kalkun", "鸡", "火鸡"]],
  ["fish", ["anchoa", "atun", "salsa de pescado", "fish sauce", "anchovy", "tuna", "anchova", "molho de peixe", "anchois", "fiskesauce", "鱼露", "鱼"]],
  ["seafood", ["camaron", "shrimp", "camarao", "crevette", "rejer", "虾"]],
  ["cured", ["chorizo", "salami", "salchicha", "mortadela", "sausage", "linguica", "saucisse", "polse", "香肠"]],
]
/** Producto animal que no es carne: lo vuelve no vegano, pero sí vegetariano. */
const NAME_ANIMAL_PRODUCT = ["miel", "honey", "mel", "gelatina", "gelatin", "gelatine", "蜂蜜", "明胶"]
const GELATIN = ["gelatina", "gelatin", "gelatine", "明胶"]

const hasWord = (name: string, word: string) => {
  if (/[一-鿿]/.test(word)) return name.includes(word)
  return new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(name)
}

export interface IngredientDiet {
  protein: Protein | null
  /** Lácteo, huevo, miel… (no es carne, pero no es vegano). */
  animalProduct: boolean
}

export function ingredientDiet(ing: Pick<Ingredient, "name" | "category"> & { allergens?: string[]; dietOverride?: DietOverride }): IngredientDiet {
  if (ing.dietOverride === "plant") return { protein: null, animalProduct: false }
  const name = norm(ing.name || "")
  let protein: Protein | null = CATEGORY_PROTEIN[ing.category || ""] ?? null
  // Excepciones vegetales: «leche de coco», «hamburguesa vegetal», «chorizo de soya»…
  const plantBased = /(vegetal|vegano|vegana|vegan|plant[- ]based|de soya|de soja|de coco|de almendra|de avena|tofu|seitan)/.test(name)
  if (!protein && !plantBased) protein = NAME_PROTEIN.find(([, words]) => words.some((w) => hasWord(name, norm(w))))?.[0] ?? null
  const allergens = new Set(ing.allergens ?? [])
  let animalProduct =
    !plantBased &&
    (ing.category === "LÁCTEOS Y DERIVADOS" || ing.category === "HUEVO" || allergens.has("milk") || allergens.has("eggs") || NAME_ANIMAL_PRODUCT.some((w) => hasWord(name, norm(w))))
  // La gelatina es de origen animal (cerdo o res): no es vegetariana.
  if (!protein && !plantBased && GELATIN.some((w) => hasWord(name, norm(w)))) protein = "pork"
  if (ing.dietOverride === "animal_product") return { protein: null, animalProduct: true }
  if (ing.dietOverride === "meat") return { protein: protein ?? "game", animalProduct: true }
  if (protein) animalProduct = true
  return { protein, animalProduct }
}

export interface RecipeDiet {
  proteins: Protein[]
  vegetarian: boolean
  vegan: boolean
  /** Ingredientes que impiden «vegetariano» y «vegano» (para explicarlo). */
  meatFrom: string[]
  animalFrom: string[]
}

export function recipeDiet(recipe: Pick<Recipe, "id" | "ingredients">, ingredients: Ingredient[], recipes: Recipe[], visited = new Set<string>()): RecipeDiet {
  const out: RecipeDiet = { proteins: [], vegetarian: true, vegan: true, meatFrom: [], animalFrom: [] }
  if (visited.has(recipe.id)) return out
  visited.add(recipe.id)
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const proteins = new Set<Protein>()
  for (const line of recipe.ingredients || []) {
    if (!line.ingredientId) continue
    const ing = byId.get(line.ingredientId)
    if (!ing) continue
    const subId = ing.recipeId || ing.recipeData?.originalRecipeId
    const sub = subId ? recipes.find((r) => r.id === subId) : undefined
    if (sub) {
      const d = recipeDiet(sub, ingredients, recipes, visited)
      d.proteins.forEach((p) => proteins.add(p))
      out.meatFrom.push(...d.meatFrom)
      out.animalFrom.push(...d.animalFrom)
      continue
    }
    const d = ingredientDiet(ing as Ingredient & { dietOverride?: DietOverride })
    if (d.protein) {
      proteins.add(d.protein)
      out.meatFrom.push(ing.name)
    } else if (d.animalProduct) out.animalFrom.push(ing.name)
  }
  out.proteins = PROTEINS.filter((p) => proteins.has(p))
  out.vegetarian = out.meatFrom.length === 0
  out.vegan = out.vegetarian && out.animalFrom.length === 0
  out.meatFrom = [...new Set(out.meatFrom)]
  out.animalFrom = [...new Set(out.animalFrom)]
  return out
}

/** Lo que la persona confirma en la Ficha Técnica. */
export interface DietClaims {
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  allergenFree?: boolean
  /** «Puede contener trazas de…» (contacto cruzado en la cocina). */
  mayContain?: AllergenKey[]
}

export interface ClaimCheck {
  vegan: boolean
  vegetarian: boolean
  glutenFree: boolean
  allergenFree: boolean
  /** Por qué no vale cada una que la persona marcó (ingredientes que lo contradicen). */
  conflicts: { claim: "vegan" | "vegetarian" | "glutenFree" | "allergenFree"; because: string[] }[]
}

/**
 * Qué declaraciones valen: solo lo que la persona confirmó Y los ingredientes permiten.
 * «Sin alérgenos» y «sin gluten» tampoco valen con trazas declaradas de ese alérgeno.
 */
export function validClaims(claims: DietClaims | undefined, diet: RecipeDiet, allergens: AllergenKey[], allergenSources: (key: AllergenKey) => string[] = () => []): ClaimCheck {
  const c = claims ?? {}
  const traces = new Set(c.mayContain ?? [])
  const conflicts: ClaimCheck["conflicts"] = []
  const vegan = !!c.vegan && diet.vegan
  if (c.vegan && !diet.vegan) conflicts.push({ claim: "vegan", because: [...diet.meatFrom, ...diet.animalFrom] })
  const vegetarian = (!!c.vegetarian || vegan) && diet.vegetarian
  if (c.vegetarian && !diet.vegetarian) conflicts.push({ claim: "vegetarian", because: diet.meatFrom })
  const hasGluten = allergens.includes("gluten")
  const glutenFree = !!c.glutenFree && !hasGluten && !traces.has("gluten")
  if (c.glutenFree && (hasGluten || traces.has("gluten"))) conflicts.push({ claim: "glutenFree", because: allergenSources("gluten") })
  const allergenFree = !!c.allergenFree && allergens.length === 0 && traces.size === 0
  if (c.allergenFree && (allergens.length > 0 || traces.size > 0)) conflicts.push({ claim: "allergenFree", because: allergens.flatMap((a) => allergenSources(a)) })
  return { vegan, vegetarian, glutenFree, allergenFree, conflicts }
}

/** Todo lo de un plato para mostrar, filtrar y exportar. */
export interface DishLabels {
  allergens: AllergenKey[]
  mayContain: AllergenKey[]
  proteins: Protein[]
  /** Calculado de los ingredientes (para filtrar en Mis Recetas). */
  diet: RecipeDiet
  /** Confirmado y válido (lo que se muestra al cliente). */
  claims: ClaimCheck
}

export function dishLabels(recipe: Recipe, ingredients: Ingredient[], recipes: Recipe[]): DishLabels {
  const allergens = getRecipeAllergens(recipe, ingredients, recipes)
  const diet = recipeDiet(recipe, ingredients, recipes)
  const claims = recipe.dietClaims
  const byId = new Map(ingredients.map((i) => [i.id, i]))
  const sources = (key: AllergenKey) =>
    (recipe.ingredients || []).map((l) => (l.ingredientId ? byId.get(l.ingredientId) : undefined)).filter((i): i is Ingredient => !!i && (i.allergens || []).includes(key)).map((i) => i.name)
  return {
    allergens,
    mayContain: (claims?.mayContain ?? []).filter((k) => !allergens.includes(k)),
    proteins: diet.proteins,
    diet,
    claims: validClaims(claims, diet, allergens, sources),
  }
}
