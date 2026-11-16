/**
 * Filtros de Mis Recetas por alérgenos y tipo de plato (docs/324). Usan lo calculado de los
 * ingredientes (`DishLabels`, lib/diet.ts): «vegetariano» = ningún ingrediente con carne o
 * pescado; «sin gluten» = sin gluten heredado ni trazas declaradas; «con res» = alguna línea de res.
 */

import type { AllergenKey } from "@/lib/allergens"
import type { DishLabels, Protein } from "@/lib/diet"
import type { DietIconKey } from "@/lib/diet-icons"

type Label = "diet_vegetarian" | "diet_vegan" | "diet_gluten_free" | "diet_allergen_free"

export interface DietFilterDef {
  id: string
  kind: "all" | "claim" | "without" | "protein"
  icon?: DietIconKey
  label?: Label
  allergen?: AllergenKey
  protein?: Protein
}

const WITHOUT: AllergenKey[] = ["milk", "eggs", "tree_nuts", "peanuts", "soy", "fish", "crustaceans", "molluscs", "sesame"]
const WITH: Protein[] = ["beef", "pork", "poultry", "fish", "seafood", "game", "cured"]

export const DIET_FILTERS: DietFilterDef[] = [
  { id: "all", kind: "all" },
  { id: "vegetarian", kind: "claim", icon: "vegetarian", label: "diet_vegetarian" },
  { id: "vegan", kind: "claim", icon: "vegan", label: "diet_vegan" },
  { id: "gluten_free", kind: "claim", icon: "gluten_free", label: "diet_gluten_free" },
  { id: "allergen_free", kind: "claim", icon: "allergen_free", label: "diet_allergen_free" },
  ...WITHOUT.map((a): DietFilterDef => ({ id: `without_${a}`, kind: "without", icon: a, allergen: a })),
  ...WITH.map((p): DietFilterDef => ({ id: `with_${p}`, kind: "protein", icon: p, protein: p })),
]

export type DietFilter = string

export function matchesDietFilter(l: DishLabels, filter: DietFilter): boolean {
  if (filter === "all") return true
  if (filter === "vegetarian") return l.diet.vegetarian
  if (filter === "vegan") return l.diet.vegan
  if (filter === "gluten_free") return !l.allergens.includes("gluten") && !l.mayContain.includes("gluten")
  if (filter === "allergen_free") return l.allergens.length === 0 && l.mayContain.length === 0
  if (filter.startsWith("without_")) {
    const a = filter.slice(8) as AllergenKey
    return !l.allergens.includes(a) && !l.mayContain.includes(a)
  }
  if (filter.startsWith("with_")) return l.proteins.includes(filter.slice(5) as Protein)
  return true
}
