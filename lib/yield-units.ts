/**
 * Unidades de rendimiento y escalado (PAX), docs/313.
 *
 * Una receta rinde en una de cuatro clases de unidad, y cada una se escala distinto:
 *
 * | Clase      | Unidades            | Qué es el número del PAX           | Decimales |
 * |------------|---------------------|------------------------------------|-----------|
 * | porciones  | porciones           | personas (porciones) a servir      | no        |
 * | piezas     | un                  | piezas a producir (galletas, panes)| no        |
 * | masa       | g, kg, oz, lb       | nuevo rendimiento en esa unidad    | sí        |
 * | volumen    | ml, L               | nuevo rendimiento en esa unidad    | sí        |
 *
 * Reglas para no escalar algo físicamente incoherente:
 * 1. El objetivo debe ser mayor que 0.
 * 2. Porciones y piezas se escalan a números enteros (no hay 7.5 personas ni 2.3 galletas).
 * 3. La base del escalado es el rendimiento real de la receta. Si el campo Rendimiento está
 *    vacío, es el rendimiento calculado de sus ingredientes (`fallbackYield`), nunca «1».
 * 4. Los ingredientes contados en piezas («unidad»: huevos, latas, panes) se redondean hacia
 *    arriba a piezas enteras si la receta original los usa enteros, o a medias / cuartos si
 *    la receta ya usaba fracciones (½ limón). Nunca 2.37 huevos.
 */

import { fallbackYield } from "@/lib/yield-weight"

export type YieldKind = "portions" | "pieces" | "mass" | "volume"

const MASS = new Set(["g", "kg", "oz", "lb"])
const VOLUME = new Set(["ml", "L", "l"])

export function yieldUnitKind(unit: string | undefined | null): YieldKind {
  if (!unit || unit === "porciones") return "portions"
  if (unit === "un") return "pieces"
  if (MASS.has(unit)) return "mass"
  if (VOLUME.has(unit)) return "volume"
  return "portions"
}

/** Porciones y piezas: solo números enteros. */
export function isDiscreteYield(unit: string | undefined | null): boolean {
  const kind = yieldUnitKind(unit)
  return kind === "portions" || kind === "pieces"
}

/** Decimales que acepta el campo del PAX según la unidad. */
export function scaleTargetDecimals(unit: string | undefined | null): number {
  return isDiscreteYield(unit) ? 0 : 3
}

export type ScaleTargetError = "not_positive" | "not_whole" | "no_base"

/**
 * ¿Se puede escalar a este objetivo? `null` = sí. 0 o vacío no es error: es «sin escalar».
 */
export function scaleTargetError(target: number, unit: string | undefined | null, baseYield: number): ScaleTargetError | null {
  if (!target) return null
  if (!(target > 0) || !Number.isFinite(target)) return "not_positive"
  if (isDiscreteYield(unit) && Math.abs(target - Math.round(target)) > 1e-9) return "not_whole"
  if (!(baseYield > 0)) return "no_base"
  return null
}

/**
 * Rendimiento base para escalar: el declarado; si está vacío, el calculado de los
 * ingredientes en la unidad de la receta (regla 3). Antes caía en `servings` (siempre 1).
 */
export function scaleBaseYield(recipe: {
  yieldAmount?: number
  yieldUnit?: string
  servings?: number
  ingredients?: { quantity?: number; unit?: string; ingredientId?: string | null }[]
}): number {
  if (recipe.yieldAmount && recipe.yieldAmount > 0) return recipe.yieldAmount
  const computed = fallbackYield(recipe.ingredients, recipe.yieldUnit, 1)
  if (computed > 0) return computed
  return recipe.servings && recipe.servings > 0 ? recipe.servings : 1
}

/** Multiplicador ya validado: 1 (sin escalar) si el objetivo no es coherente. */
export function safeScaleMultiplier(target: number, unit: string | undefined | null, baseYield: number): number {
  if (!target || scaleTargetError(target, unit, baseYield)) return 1
  return target / baseYield
}

const COUNTABLE_UNITS = new Set(["unidad", "unidades", "un", "pieza", "piezas"])

export function isCountableIngredientUnit(unit: string | undefined | null): boolean {
  return Boolean(unit) && COUNTABLE_UNITS.has((unit as string).toLowerCase())
}

/**
 * Escalón de una línea en piezas (regla 4): entera si la receta original la usa entera; si
 * no, media pieza; si la original es menos de media pieza, un cuarto.
 */
export function countableStep(originalQuantity: number): number {
  if (Math.abs(originalQuantity - Math.round(originalQuantity)) < 1e-9) return 1
  if (originalQuantity >= 0.5 - 1e-9) return 0.5
  return 0.25
}

/**
 * Escalado de un plato de menú por porciones planeadas (docs/313). Las porciones solo
 * escalan recetas que rinden en porciones o piezas. Una receta que rinde 2 kg no se puede
 * escalar a «50 porciones» sin saber cuánto pesa una porción: antes daba 50 ÷ 2 = × 25
 * (50 kg). Ahí se pide la receta tal cual (× 1) y se avisa.
 */
export function servingsScale(
  recipe: Parameters<typeof scaleBaseYield>[0] | undefined,
  plannedServings: number | undefined,
): { multiplier: number; coherent: boolean } {
  if (plannedServings === undefined || !recipe) return { multiplier: 1, coherent: true }
  if (!isDiscreteYield(recipe.yieldUnit)) return { multiplier: 1, coherent: false }
  const base = scaleBaseYield(recipe)
  return plannedServings > 0 && base > 0 ? { multiplier: plannedServings / base, coherent: true } : { multiplier: 1, coherent: true }
}
