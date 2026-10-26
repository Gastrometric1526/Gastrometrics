/**
 * MEP — Mise en place de un menú (docs/202). Pedido del dueño: un documento alineado con el
 * menú que diga qué producir: primero las preparaciones base (sub-recetas) que usan los
 * platos, después cada plato, cada uno con «para cuánto» y, al abrirlo, sus ingredientes,
 * cantidades y procedimiento ya escalados.
 *
 * Puro (sin base de datos), cubierto por lib/mep.test.ts. Mismas reglas que el resto de la app:
 * - Porciones de cada plato: MenuItem.plannedQuantity, si no Menu.plannedServings, si no el
 *   rendimiento de la receta (×1). Igual que generateMenuIngredientList (lib/menus.ts).
 * - Escalado: multiplicador = porciones ÷ rendimiento; cada cantidad se redondea hacia arriba
 *   con la regla del PAX (lib/pax-scaling.ts, docs/189–190), igual que la Ficha Técnica.
 * - Sub-recetas: usar 150 g de una salsa que rinde 1000 g consume el 15 % de la salsa (mismo
 *   criterio que lib/recipe-consumption.ts). Se suman entre todos los platos que la usan y se
 *   expanden en cualquier nivel; las más profundas van primero (se preparan antes).
 */

import type { Recipe, RecipeIngredient } from "@/types/recipe"
import { classifications } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { Menu } from "@/lib/types/menus"
import { paxStep, roundUpToStep, scaleRecipeLine } from "@/lib/pax-scaling"

export interface MepEntry {
  /** Clave estable para marcar «Listo»: `prep:<id>` o `dish:<id>`. */
  key: string
  recipeId: string
  name: string
  kind: "prep" | "dish"
  /** Clasificación de la Ficha Técnica = área de la cocina (Línea caliente, Línea fría…). */
  classification: string
  /** Paso del menú (solo platos): nombre y orden. */
  stepName: string | null
  stepOrder: number
  /** Cuánto producir, en la unidad de rendimiento de la receta (porciones, kg, L…). */
  amount: number
  yieldUnit: string
  baseYield: number
  multiplier: number
  /** Preparaciones: platos (o preparaciones) que la usan. */
  usedBy: string[]
  /** Profundidad de una preparación (1 = la usa un plato directo; 2 = la usa otra preparación…). */
  depth: number
  lines: RecipeIngredient[]
  procedure: string[]
  observations: string[]
}

export interface MepResult {
  preps: MepEntry[]
  dishes: MepEntry[]
  /** Platos del menú cuya receta ya no existe (borrada o de otro negocio). */
  missingRecipeIds: string[]
}

const MAX_DEPTH = 10

const baseYieldOf = (r: Pick<Recipe, "yieldAmount">) => (r.yieldAmount && r.yieldAmount > 0 ? r.yieldAmount : 1)

function subRecipeIdOf(ingredient: Ingredient | undefined): string | null {
  if (!ingredient) return null
  return ingredient.recipeId || ingredient.recipeData?.originalRecipeId || null
}

function cleanList(list: string[] | undefined): string[] {
  return (list ?? []).map((s) => (s ?? "").trim()).filter(Boolean)
}

function entryFor(recipe: Recipe, kind: MepEntry["kind"], amount: number, extra: Partial<MepEntry> = {}): MepEntry {
  const baseYield = baseYieldOf(recipe)
  const multiplier = amount / baseYield
  return {
    key: `${kind}:${recipe.id}`,
    recipeId: recipe.id,
    name: recipe.name,
    kind,
    classification: recipe.classification || "",
    stepName: null,
    stepOrder: 0,
    amount,
    yieldUnit: recipe.yieldUnit || "porciones",
    baseYield,
    multiplier,
    usedBy: [],
    depth: 0,
    lines: (recipe.ingredients ?? []).filter((l) => l.quantity > 0).map((l) => scaleRecipeLine(l, multiplier)),
    procedure: cleanList(recipe.procedure),
    observations: cleanList(recipe.observations),
    ...extra,
  }
}

export function buildMep(menu: Menu, recipes: Recipe[], ingredients: Ingredient[]): MepResult {
  const recipesById = new Map(recipes.map((r) => [r.id, r]))
  const ingredientsById = new Map(ingredients.map((i) => [i.id, i]))
  const stepsById = new Map((menu.steps ?? []).map((s) => [s.id, s]))

  // 1) Platos: suma de porciones por receta (un plato puede repetirse en varios pasos).
  const dishAmounts = new Map<string, { amount: number; stepName: string | null; stepOrder: number }>()
  const missing = new Set<string>()
  for (const item of menu.items ?? []) {
    if (!item.enabled) continue
    const recipe = recipesById.get(item.recipeId)
    if (!recipe) {
      missing.add(item.recipeId)
      continue
    }
    const amount = item.plannedQuantity ?? menu.plannedServings ?? baseYieldOf(recipe)
    if (!(amount > 0)) continue
    const step = stepsById.get(item.stepId)
    const prev = dishAmounts.get(recipe.id)
    if (prev) prev.amount += amount
    else dishAmounts.set(recipe.id, { amount, stepName: step?.name ?? null, stepOrder: step?.order ?? 999 })
  }

  const dishes: MepEntry[] = []
  for (const [recipeId, info] of dishAmounts) {
    const recipe = recipesById.get(recipeId) as Recipe
    dishes.push(entryFor(recipe, "dish", info.amount, { stepName: info.stepName, stepOrder: info.stepOrder }))
  }
  dishes.sort((a, b) => a.stepOrder - b.stepOrder || a.name.localeCompare(b.name))

  // 2) Preparaciones base: recorre las sub-recetas de cada plato en cualquier nivel.
  const preps = new Map<string, { amount: number; usedBy: Set<string>; depth: number; unit: string }>()
  const walk = (recipe: Recipe, multiplier: number, parentName: string, depth: number) => {
    if (depth > MAX_DEPTH || !(multiplier > 0)) return
    for (const line of recipe.ingredients ?? []) {
      if (!line.ingredientId || !(line.quantity > 0)) continue
      const subId = subRecipeIdOf(ingredientsById.get(line.ingredientId))
      const sub = subId ? recipesById.get(subId) : undefined
      if (!sub || sub.id === recipe.id) continue
      const used = line.quantity * multiplier // en la unidad de la línea = unidad de rendimiento de la sub-receta
      const prev = preps.get(sub.id)
      if (prev) {
        prev.amount += used
        prev.usedBy.add(parentName)
        prev.depth = Math.max(prev.depth, depth)
      } else {
        preps.set(sub.id, { amount: used, usedBy: new Set([parentName]), depth, unit: line.unit })
      }
      walk(sub, used / baseYieldOf(sub), sub.name, depth + 1)
    }
  }
  for (const dish of dishes) walk(recipesById.get(dish.recipeId) as Recipe, dish.multiplier, dish.name, 1)

  const prepEntries: MepEntry[] = []
  for (const [recipeId, info] of preps) {
    const recipe = recipesById.get(recipeId) as Recipe
    // Hacia arriba con el escalón del PAX (nunca más del 10 % de la cantidad), como la Ficha.
    let step = paxStep(info.unit)
    while (step > info.amount / 10 && step > 1e-6) step /= 10
    const amount = roundUpToStep(info.amount, step)
    // La unidad es la de las líneas que la usan (la del ingrediente-sub-receta).
    prepEntries.push(entryFor(recipe, "prep", amount, { usedBy: Array.from(info.usedBy), depth: info.depth, yieldUnit: info.unit || recipe.yieldUnit || "g" }))
  }
  // Las más profundas primero: se necesitan para preparar las de arriba.
  prepEntries.sort((a, b) => b.depth - a.depth || a.name.localeCompare(b.name))

  return { preps: prepEntries, dishes, missingRecipeIds: Array.from(missing) }
}

/** Platos agrupados por paso del menú, en orden. */
export function groupDishesByStep(dishes: MepEntry[]): { stepName: string | null; dishes: MepEntry[] }[] {
  const groups: { stepName: string | null; dishes: MepEntry[] }[] = []
  for (const dish of dishes) {
    const last = groups[groups.length - 1]
    if (last && last.stepName === dish.stepName) last.dishes.push(dish)
    else groups.push({ stepName: dish.stepName, dishes: [dish] })
  }
  return groups
}

/** Cantidad legible: sin ceros de más (2.400 → 2.4), punto decimal siempre (docs/129). */
export function formatMepAmount(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const rounded = Math.round(value * 1000) / 1000
  return String(rounded)
}

/**
 * Agrupa por área de la cocina = clasificación de la Ficha Técnica (pedido del dueño: imprimir
 * la MEP de cada sección y dársela a su equipo). Las áreas van en el orden de la lista de
 * clasificaciones de la app; sin clasificación, al final. Dentro de cada área, las
 * preparaciones base primero y luego los platos (el orden de `entries`).
 */
export function groupByArea(entries: MepEntry[]): { area: string; entries: MepEntry[] }[] {
  const order = new Map<string, number>(classifications.map((c, i) => [c, i]))
  const groups = new Map<string, MepEntry[]>()
  for (const e of entries) {
    const list = groups.get(e.classification)
    if (list) list.push(e)
    else groups.set(e.classification, [e])
  }
  const rank = (area: string) => (area ? order.get(area) ?? classifications.length : classifications.length + 1)
  return Array.from(groups.entries())
    .map(([area, list]) => ({ area, entries: [...list].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "prep" ? -1 : 1)) }))
    .sort((a, b) => rank(a.area) - rank(b.area) || a.area.localeCompare(b.area))
}
