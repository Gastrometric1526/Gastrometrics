/**
 * Rendimiento en peso estimado de una receta (docs/208). Antes la Ficha y el PDF sumaban las
 * cantidades crudas de todas las líneas mezclando unidades (0.16 kg + 1 pan + 1 queso = «2»),
 * y el PDF además las tomaba como gramos («0 g»). Ahora se convierte todo a gramos (1 ml ≈ 1 g,
 * como el resto de la app) y las piezas («unidad») no se suman porque no tienen peso conocido.
 */
const GRAMS_PER_UNIT: Record<string, number> = {
  gramos: 1,
  kilogramos: 1000,
  mililitros: 1,
  litros: 1000,
  onzas: 28.349523125,
  "onzas líquidas": 29.5735295625,
  libras: 453.59237,
  galones: 3785.411784,
}

export function estimateYieldWeightGrams(lines: { quantity?: number; unit?: string }[] | undefined, multiplier = 1): number {
  let grams = 0
  for (const l of lines ?? []) {
    const factor = GRAMS_PER_UNIT[(l.unit || "").toLowerCase()]
    if (factor && (l.quantity ?? 0) > 0) grams += (l.quantity as number) * factor
  }
  return grams * multiplier
}

/** «450 g» o «1.25 kg» (punto decimal siempre, docs/129). */
export function formatYieldWeight(grams: number): string {
  if (!(grams > 0)) return ""
  return grams >= 1000 ? `${(Math.round(grams / 10) / 100).toFixed(2)} kg` : `${Math.round(grams)} g`
}

/** Gramos (o ml, 1 ml ≈ 1 g) por unidad de rendimiento de la receta. */
const GRAMS_PER_YIELD_UNIT: Record<string, number> = { g: 1, kg: 1000, ml: 1, L: 1000, oz: 28.349523125, lb: 453.59237 }

/**
 * Rendimiento cuando el campo «Rendimiento» queda vacío (subrecetas), docs/307. Antes era la
 * suma cruda de las cantidades: 500 g + 1 kg = 501 y el costo unitario salía mal. Ahora se
 * convierte a gramos y se expresa en la unidad de rendimiento de la receta (kg → ÷ 1 000). Si
 * ninguna línea tiene peso conocido (solo piezas), se suman las piezas, como antes.
 */
export function fallbackYield(
  lines: { quantity?: number; unit?: string; ingredientId?: string | null }[] | undefined,
  yieldUnit: string | undefined,
  multiplier = 1,
): number {
  const used = (lines ?? []).filter((l) => l.ingredientId && (l.quantity ?? 0) > 0)
  const grams = estimateYieldWeightGrams(used, multiplier)
  // Porciones o unidades con el Rendimiento vacío (docs/320): la receta completa es 1. Antes
  // se devolvían los gramos como si fueran porciones (1 500 g → «1 500 un»).
  if (grams > 0 && (yieldUnit === "porciones" || yieldUnit === "un")) return multiplier
  if (grams > 0) return grams / (GRAMS_PER_YIELD_UNIT[yieldUnit || "g"] ?? 1)
  return used.reduce((sum, l) => sum + (l.quantity as number), 0) * multiplier
}
