// Bebidas y barra (docs/136). No es un módulo aparte: una bebida es un ingrediente con
// categoría de barra, un trago es una ficha técnica con clasificación de barra, y una
// copa de vino es una mini-ficha de una sola línea. Todo lo demás (ventas, menús, stock
// teórico, órdenes de compra, Menu Engineering) funciona igual que con la comida.

import type { Ingredient } from "@/types/ingredient"

export const BEVERAGE_INGREDIENT_CATEGORIES = [
  "ALCOHOL",
  "BEBIDAS",
  "DESTILADOS",
  "VINOS",
  "CERVEZA DE BARRIL",
  "CERVEZA EMBOTELLADA",
  "REFRESCOS Y MIXERS",
] as const

export function isBeverageCategory(category: string | null | undefined): boolean {
  return !!category && (BEVERAGE_INGREDIENT_CATEGORIES as readonly string[]).includes(category)
}

export const BAR_CLASSIFICATIONS = {
  cocktails: "Barra - Cócteles (Bar)",
  wine: "Barra - Vinos (Sommellerie)",
  beer: "Barra - Cervezas (Bar)",
  non_alcoholic: "Barra - Sin alcohol (Bar)",
  coffee: "Barra - Café y té (Caféterie)",
} as const

export type BarKind = keyof typeof BAR_CLASSIFICATIONS

export function getBarKind(classification: string | null | undefined): BarKind | null {
  if (!classification) return null
  const entry = (Object.entries(BAR_CLASSIFICATIONS) as [BarKind, string][]).find(([, value]) => value === classification)
  return entry ? entry[0] : null
}

export function isBarClassification(classification: string | null | undefined): boolean {
  return getBarKind(classification) !== null
}

// Pour cost objetivo por tipo de bebida (valor por defecto al elegir una clasificación de
// barra) y el rango típico que se muestra como ayuda. Fuentes en docs/136: Backbar,
// Buyers Edge, Provi (2026) — destilados/cócteles 15–22 %, barril 20–22 %, embotellada
// 24–28 %, vino por copa 25–35 %.
export const DEFAULT_BEVERAGE_COST_TARGET: Record<BarKind, number> = {
  cocktails: 20,
  wine: 30,
  beer: 24,
  non_alcoholic: 15,
  coffee: 20,
}

export const BEVERAGE_COST_TARGET_RANGE: Record<BarKind, string> = {
  cocktails: "15–22%",
  wine: "25–35%",
  beer: "20–28%",
  non_alcoholic: "10–20%",
  coffee: "15–25%",
}

// Paso de menú (recipeSteps) que le corresponde a cada tipo de bebida — la mini-ficha de
// "Vender por copa" lo usa como Paso, y el asistente de menús sugiere por él (docs/137).
export const BAR_KIND_MENU_STEP: Record<BarKind, string> = {
  cocktails: "Cócteles",
  wine: "Vinos",
  beer: "Cervezas",
  non_alcoholic: "Bebidas sin alcohol",
  coffee: "Café",
}

export const DRINKS_MENU_STEPS = ["Cócteles", "Vinos", "Cervezas", "Bebidas sin alcohol"]

export function getBarKindForIngredientCategory(category: string): BarKind {
  if (category === "VINOS") return "wine"
  if (category === "CERVEZA DE BARRIL" || category === "CERVEZA EMBOTELLADA") return "beer"
  if (category === "REFRESCOS Y MIXERS" || category === "BEBIDAS") return "non_alcoholic"
  return "cocktails"
}

// ─── Volumen ───────────────────────────────────────────────────────────────────────

const ML_PER_UNIT: Record<string, number> = {
  mililitros: 1,
  litros: 1000,
  "onzas líquidas": 29.5735,
  galones: 3785.41,
}

/** ml que hay en 1 unidad del ingrediente, o null si su unidad no es de volumen. */
export function mlPerIngredientUnit(unit: string): number | null {
  return ML_PER_UNIT[unit] ?? null
}

/**
 * Contenido físico de un envase (botella, lata, barril) en la unidad del ingrediente.
 * La merma reduce `pricing.netContent` para que el costo por unidad la incluya; lo que
 * hay físicamente en el envase es `originalNetContent`. El inventario cuenta envases
 * físicos, así que usa este valor (docs/136).
 */
export function getPackageContent(ingredient: Pick<Ingredient, "originalNetContent" | "pricing">): number {
  return ingredient.originalNetContent || ingredient.pricing?.netContent || 0
}

// ─── Servir por copa / botella ───────────────────────────────────────────────────

export type ServingPresetKey = "shot" | "double" | "glass_150" | "glass_125" | "carafe_500" | "pint" | "half_liter" | "can_330" | "glass_250" | "package"

export interface ServingPreset {
  key: ServingPresetKey
  ml: number | null // null = el envase completo
}

export function getServingPresets(category: string): ServingPreset[] {
  switch (category) {
    case "VINOS":
      return [
        { key: "glass_150", ml: 150 },
        { key: "glass_125", ml: 125 },
        { key: "carafe_500", ml: 500 },
        { key: "package", ml: null },
      ]
    case "CERVEZA DE BARRIL":
      return [
        { key: "pint", ml: 473 },
        { key: "half_liter", ml: 500 },
        { key: "can_330", ml: 330 },
      ]
    case "CERVEZA EMBOTELLADA":
      return [{ key: "package", ml: null }]
    case "REFRESCOS Y MIXERS":
    case "BEBIDAS":
      return [
        { key: "package", ml: null },
        { key: "glass_250", ml: 250 },
      ]
    default:
      return [
        { key: "shot", ml: 45 },
        { key: "double", ml: 90 },
        { key: "package", ml: null },
      ]
  }
}

export interface ServingCost {
  /** Cantidad de la línea de receta, en la unidad del ingrediente. */
  quantity: number
  /** Costo de un servicio (incluye la merma de barra del ingrediente, si tiene). */
  cost: number
  /** Servicios que salen de un envase, ya descontada la merma. null si no aplica. */
  servingsPerPackage: number | null
}

/**
 * Costo de servir `servingMl` de una bebida (o el envase entero si es null). Usa el mismo
 * costo por unidad que la ficha técnica (`pricing.pricePerUnit`, que ya incluye la merma).
 * Vender la botella entera no lleva merma: se usa el contenido neto, así el costo es el
 * precio de compra y el stock teórico descuenta exactamente un envase.
 */
export function computeServingCost(
  ingredient: Pick<Ingredient, "unit" | "originalNetContent" | "pricing">,
  servingMl: number | null,
): ServingCost | null {
  const pricePerUnit = ingredient.pricing?.pricePerUnit || 0
  const netContent = ingredient.pricing?.netContent || 0
  if (servingMl === null) {
    if (netContent <= 0) return null
    return { quantity: netContent, cost: netContent * pricePerUnit, servingsPerPackage: 1 }
  }
  const mlPerUnit = mlPerIngredientUnit(ingredient.unit)
  if (!mlPerUnit || servingMl <= 0) return null
  const quantity = servingMl / mlPerUnit
  return {
    quantity,
    cost: quantity * pricePerUnit,
    servingsPerPackage: netContent > 0 ? netContent / quantity : null,
  }
}

/** Precio que deja el pour cost objetivo: costo ÷ %. Sin redondear. */
export function priceForTargetCost(cost: number, targetPercent: number): number {
  if (!(cost > 0) || !(targetPercent > 0)) return 0
  return cost / (targetPercent / 100)
}

// ─── Conteo de barra (Fases 2 y 4) ─────────────────────────────────────────────────

/** Envases (con decimales) que representa una cantidad en la unidad del ingrediente. */
export function toPackages(quantity: number, packageContent: number): number | null {
  if (!(packageContent > 0)) return null
  return quantity / packageContent
}

export interface BottleWeights {
  /** Peso de una botella llena, sin abrir, en gramos. */
  fullG: number
  /** Peso de la misma botella vacía, en gramos. */
  emptyG: number
}

/**
 * Fracción de botella que queda según su peso: (peso − vacía) ÷ (llena − vacía).
 * No necesita la densidad del líquido. Se limita a 0–1. null si los pesos no sirven.
 */
export function bottleFractionFromWeight(weightG: number, weights: BottleWeights | null | undefined): number | null {
  if (!weights) return null
  const span = weights.fullG - weights.emptyG
  if (!(span > 0) || !Number.isFinite(weightG)) return null
  return Math.min(1, Math.max(0, (weightG - weights.emptyG) / span))
}
