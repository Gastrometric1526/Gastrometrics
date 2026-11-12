// Bebidas y barra (docs/136). No es un módulo aparte: una bebida es un ingrediente con
// categoría de barra, un trago es una ficha técnica con clasificación de barra, y una
// copa de vino es una mini-ficha de una sola línea. Todo lo demás (ventas, menús, stock
// teórico, órdenes de compra, Menu Engineering) funciona igual que con la comida.

import type { Ingredient } from "@/types/ingredient"
import type { BeverageMode, Recipe, RecipeIngredient } from "@/types/recipe"
import { unitAbbreviations } from "@/types/ingredient"

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

// ─── Ficha Técnica de Bebidas (docs/272) ──────────────────────────────────────────
// No es otro sistema de recetas: es la misma Ficha Técnica (mismo motor de costo,
// cascada de subrecetas, ventas, menús, POS, inventario y reportes) con un formulario
// propio para bebidas. `recipe.beverage` guarda cómo se vende y los datos de servicio.


/** ¿Es una bebida? Con `beverage` o con clasificación de barra (recetas de antes de docs/272). */
export function isBeverageRecipe(recipe: Pick<Recipe, "classification" | "beverage"> | null | undefined): boolean {
  return !!recipe && (!!recipe.beverage || isBarClassification(recipe.classification))
}

/** Modalidad de venta de una bebida, o null si es comida. */
export function beverageModeOf(recipe: Pick<Recipe, "classification" | "beverage"> | null | undefined): BeverageMode | null {
  if (!recipe) return null
  if (recipe.beverage?.mode) return recipe.beverage.mode
  return isBarClassification(recipe.classification) ? "prepared" : null
}

/** Métodos de preparación de barra (textos en `bebidas_method_<clave>`). */
export const BEVERAGE_METHODS = ["shaken", "stirred", "built", "blended", "layered", "brewed"] as const
export type BeverageMethod = (typeof BEVERAGE_METHODS)[number]

/**
 * Agua que suma el hielo según el método (docs/286), valores de referencia de barra:
 * agitado ~25 %, revuelto ~20 %, directo ~10 %, licuado ~30 %; en capas y preparado
 * (café, té) no se diluye. Sirve para elegir el vaso, no es una medida exacta.
 */
export const DILUTION_BY_METHOD: Record<BeverageMethod, number> = { shaken: 0.25, stirred: 0.2, built: 0.1, blended: 0.3, layered: 0, brewed: 0 }

/**
 * Volumen de una bebida preparada, por servicio (docs/286): suma los ml de las líneas cuyo
 * ingrediente está en una unidad de volumen (las de peso, como la hierbabuena, no cuentan) y,
 * con el método, estima lo que se sirve con la dilución del hielo.
 */
export function preparedVolume(
  lines: Pick<RecipeIngredient, "ingredientId" | "quantity">[],
  ingredientsById: Map<string, Pick<Ingredient, "unit">>,
  servings: number,
  method?: string | null,
): { liquidMl: number; servedMl: number | null } | null {
  let total = 0
  for (const line of lines) {
    const ing = line.ingredientId ? ingredientsById.get(line.ingredientId) : undefined
    const ml = ing ? mlPerIngredientUnit(ing.unit) : null
    if (ml && line.quantity > 0) total += line.quantity * ml
  }
  if (!(total > 0)) return null
  const per = total / Math.max(1, servings || 1)
  const dilution = method && method in DILUTION_BY_METHOD ? DILUTION_BY_METHOD[method as BeverageMethod] : null
  return { liquidMl: Math.round(per), servedMl: dilution === null ? null : Math.round(per * (1 + dilution)) }
}

/**
 * Línea única de una bebida por medida o por envase: `servingMl` ml del ingrediente
 * (o el envase entero con null), con el costo por servicio de `computeServingCost`.
 * La usan la Ficha Técnica de Bebidas y «Vender por copa o botella», así las dos dan
 * exactamente el mismo costo.
 */
export function buildServingLine(
  ingredient: Pick<Ingredient, "id" | "name" | "category" | "unit" | "originalNetContent" | "pricing">,
  servingMl: number | null,
  lineId: string,
): { line: RecipeIngredient; serving: ServingCost } | null {
  const serving = computeServingCost(ingredient, servingMl)
  if (!serving) return null
  return {
    serving,
    line: {
      id: lineId,
      ingredientId: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      quantity: serving.quantity,
      unit: ingredient.unit,
      measure: unitAbbreviations[ingredient.unit as keyof typeof unitAbbreviations] || ingredient.unit,
      cost: 0,
      unitCost: ingredient.pricing.pricePerUnit,
      costPerMeasure: ingredient.pricing.pricePerUnit,
      extension: serving.cost,
    },
  }
}

/** Ingredientes que sirven para vender por medida/envase: los de barra primero, luego el resto. */
export function sortForBeverageSource<T extends Pick<Ingredient, "name" | "category">>(ingredients: T[]): T[] {
  return [...ingredients].sort((a, b) => {
    const da = isBeverageCategory(a.category) ? 0 : 1
    const db = isBeverageCategory(b.category) ? 0 : 1
    return da - db || a.name.localeCompare(b.name)
  })
}

/**
 * Por medida / por envase: el producto es el ingrediente de la única línea. Al migrar una
 * receta a otro negocio la línea se vuelve a unir con los ingredientes del destino, así que
 * el producto se toma de ahí (docs/272); sin esto la copia quedaba sin producto elegido.
 */
export function withBeverageSourceFromLine<T extends Pick<Recipe, "beverage" | "ingredients">>(recipe: T): T {
  const b = recipe.beverage
  if (!b || (b.mode !== "measure" && b.mode !== "package")) return recipe
  return { ...recipe, beverage: { ...b, sourceIngredientId: recipe.ingredients[0]?.ingredientId ?? null } }
}

// ─── Medidas en la unidad de la base de datos (docs/273) ──────────────────────────
// Si la bebida está guardada en onzas líquidas o galones, las medidas se ofrecen en onzas;
// si está en ml o L, en ml. El servicio se guarda siempre en ml (`servingMl`).

export type ServingUnit = "ml" | "oz"
export const ML_PER_FL_OZ = 29.5735

export function servingUnitFor(unit: string): ServingUnit {
  return unit === "onzas líquidas" || unit === "galones" ? "oz" : "ml"
}

export interface ServingOption {
  key: string
  ml: number
  /** Clave del texto (ya trae la cantidad: «Copa 150 ml», «Copa 5 oz»). */
  labelKey: string
}

const OZ_OPTIONS: Record<string, [string, number][]> = {
  VINOS: [["glass_5oz", 5], ["glass_6oz", 6]],
  "CERVEZA DE BARRIL": [["pint_16oz", 16], ["glass_12oz", 12]],
  "CERVEZA EMBOTELLADA": [["glass_12oz", 12]],
  "REFRESCOS Y MIXERS": [["glass_8oz", 8], ["glass_12oz", 12]],
  BEBIDAS: [["glass_8oz", 8], ["glass_12oz", 12]],
}

/** Medidas de servicio para una bebida, en la unidad en que está guardada. */
export function getServingOptions(category: string, unit: string): ServingOption[] {
  if (mlPerIngredientUnit(unit) === null) return []
  if (servingUnitFor(unit) === "ml") {
    return getServingPresets(category)
      .filter((p) => p.ml !== null)
      .map((p) => ({ key: p.key, ml: p.ml as number, labelKey: `bebidas_serving_${p.key}` }))
  }
  const list = OZ_OPTIONS[category] ?? [["shot_15oz", 1.5], ["double_3oz", 3]]
  return list.map(([key, oz]) => ({ key, ml: oz * ML_PER_FL_OZ, labelKey: `bev_serving_${key}` }))
}

/** ml del servicio → cantidad en la unidad de la bebida (ml u oz). */
export function mlToServingUnit(ml: number, unit: ServingUnit): number {
  return unit === "oz" ? Math.round((ml / ML_PER_FL_OZ) * 10) / 10 : Math.round(ml)
}

/** Cantidad en la unidad de la bebida → ml. */
export function servingUnitToMl(amount: number, unit: ServingUnit): number {
  return unit === "oz" ? amount * ML_PER_FL_OZ : amount
}

/** «150 ml» o «5 oz». */
export function formatServingAmount(ml: number, unit: ServingUnit): string {
  return `${mlToServingUnit(ml, unit)} ${unit}`
}

/** ¿Es esta la opción elegida? (los ml de una opción en onzas no son enteros). */
export function sameServing(a: number | null | undefined, b: number | null | undefined): boolean {
  return typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 0.05
}
