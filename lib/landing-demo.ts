/**
 * Borrador de la demo interactiva de la landing (components/landing-recipe-demo.tsx) —
 * tipo y constantes compartidas con lib/landing-demo-carryover.ts, que lo convierte en
 * datos reales (Ingredientes + Mis Recetas) apenas la persona crea una cuenta. Ver el
 * comentario de cabecera de landing-recipe-demo.tsx para el porqué de cada campo.
 */

export interface DemoIngredient {
  id: string
  name: string
  purchasePrice: number
  netContent: number
}

export interface DemoRecipeLine {
  id: string
  ingredientId: string
  quantity: number
}

export interface DemoDraft {
  dishName: string
  ingredients: DemoIngredient[]
  recipeLines: DemoRecipeLine[]
  salePrice: number
  step: 1 | 2
  startedAt: number
}

export const LANDING_DEMO_STORAGE_KEY = "gm_landing_demo_v1"
export const LANDING_DEMO_EXPIRY_MS = 10 * 60 * 1000

export function unitCostOf(ingredient: Pick<DemoIngredient, "purchasePrice" | "netContent">): number {
  return ingredient.purchasePrice / Math.max(0.01, ingredient.netContent)
}

export function emptyLandingDemoDraft(): DemoDraft {
  return {
    dishName: "",
    ingredients: [{ id: "i1", name: "", purchasePrice: 0, netContent: 1 }],
    recipeLines: [],
    salePrice: 0,
    step: 1,
    startedAt: Date.now(),
  }
}

/** Lee el borrador si existe y todavía no expiró — null si no hay nada usable. */
export function readLandingDemoDraft(): DemoDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LANDING_DEMO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoDraft
    if (Date.now() - parsed.startedAt > LANDING_DEMO_EXPIRY_MS) {
      window.localStorage.removeItem(LANDING_DEMO_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearLandingDemoDraft(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(LANDING_DEMO_STORAGE_KEY)
}
