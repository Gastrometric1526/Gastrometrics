/**
 * Carta del POS (docs/271): de dónde se eligen los platos al tomar un pedido.
 * Cada menú creado es una carta (sus platos activos, agrupados por paso, más el menú
 * completo como un solo producto), y «Mis Recetas» trae todas las recetas que no son
 * subrecetas, agrupadas por clasificación. Reemplaza el interruptor «Platos en la carta».
 */

import type { Menu } from "@/lib/types/menus"
import type { Recipe } from "@/types/recipe"
import { currentUnitPrice } from "@/lib/recipe-pricing"
import { getMenuUnitPriceAndCost } from "@/lib/menus"

export interface PosSellable {
  key: string
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  /** Grupo dentro de la carta: el paso del menú o la clasificación de la receta. */
  category: string
  price: number
  cost: number
  image?: string
  classification: string | null
}

export interface PosCarta {
  /** "recipes" o el id del menú. */
  id: string
  name: string
  kind: "menu" | "recipes"
  items: PosSellable[]
}

export const RECIPES_CARTA = "recipes"

type CartaRecipe = Recipe

function recipeCost(r: CartaRecipe): number {
  return r.costPerServing ?? (r.totalCost || 0) / (r.yieldAmount > 0 ? r.yieldAmount : 1)
}

function fromRecipe(r: CartaRecipe, key: string, category: string, price: number): PosSellable {
  return {
    key,
    sourceType: "recipe",
    refId: r.id,
    name: r.name,
    category,
    price,
    cost: recipeCost(r),
    image: r.image || undefined,
    classification: r.classification || null,
  }
}

export function buildCartas(
  menus: Menu[],
  recipes: CartaRecipe[],
  labels: { recipes: string; other: string; wholeMenu: string },
): PosCarta[] {
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const cartas: PosCarta[] = []

  for (const m of [...menus].sort((a, b) => a.name.localeCompare(b.name))) {
    const steps = new Map((m.steps ?? []).map((s) => [s.id, s]))
    const items: PosSellable[] = []
    const enabled = m.items
      .filter((it) => it.enabled && byId.has(it.recipeId))
      .sort((a, b) => (steps.get(a.stepId)?.order ?? 999) - (steps.get(b.stepId)?.order ?? 999))
    for (const it of enabled) {
      const r = byId.get(it.recipeId) as CartaRecipe
      const price = typeof it.priceOverride === "number" ? it.priceOverride : currentUnitPrice(r)
      items.push(fromRecipe(r, `menu:${m.id}:${it.id}`, steps.get(it.stepId)?.name || labels.other, price))
    }
    if (enabled.length === 0) continue
    const whole = getMenuUnitPriceAndCost(m, recipes)
    items.unshift({
      key: `menu:${m.id}`,
      sourceType: "menu",
      refId: m.id,
      name: m.name,
      category: labels.wholeMenu,
      price: whole.price,
      cost: whole.cost,
      classification: null,
    })
    cartas.push({ id: m.id, name: m.name, kind: "menu", items })
  }

  const all = recipes
    .filter((r) => !r.isSubRecipe)
    .map((r) => fromRecipe(r, `recipe:${r.id}`, r.classification || labels.other, currentUnitPrice(r)))
    .sort((a, b) => a.name.localeCompare(b.name))
  cartas.push({ id: RECIPES_CARTA, name: labels.recipes, kind: "recipes", items: all })
  return cartas
}

/** Grupos de una carta en el orden en que aparecen (el del menú) o alfabético (recetas). */
export function cartaCategories(carta: PosCarta): string[] {
  const seen = [...new Set(carta.items.map((i) => i.category))]
  return carta.kind === "recipes" ? seen.sort((a, b) => a.localeCompare(b)) : seen
}
