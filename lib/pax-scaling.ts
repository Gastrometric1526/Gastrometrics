import type { RecipeIngredient } from "@/types/recipe"
import { unitAbbreviations, type Ingredient } from "@/types/ingredient"
import { unitFactor } from "@/lib/unit-change"

/**
 * Modificador de PAX de la Ficha Técnica (docs/189): una sola regla para la pantalla, el
 * PDF y el guardado.
 *
 * multiplicador = personas pedidas ÷ rendimiento de la receta.
 *
 * Cada cantidad se redondea SIEMPRE hacia arriba (decisión del dueño: nunca quedarse
 * corto en cocina), con un escalón que depende de la unidad:
 * - kilogramos, litros, libras y galones: 0.001 (un gramo / mililitro). Antes el escalón
 *   era 0.1 para todo y 0.01 kg de sal se volvía 0.1 kg (10 veces más).
 * - gramos, mililitros, onzas, onzas líquidas y unidad: 0.1.
 *
 * Se descuenta un margen mínimo de error de coma flotante antes de redondear: 0.1 × 3 en
 * JavaScript es 0.30000000000000004 y con Math.ceil directo salía 0.4.
 */
const LARGE_UNITS = new Set(["kilogramos", "litros", "libras", "galones", "kg", "l", "lb", "gal"])

export function paxStep(unit: string | undefined): number {
  return unit && LARGE_UNITS.has(unit) ? 0.001 : 0.1
}

export function paxMultiplierFor(paxModifier: number, baseYield: number): number {
  return paxModifier > 0 && baseYield > 0 ? paxModifier / baseYield : 1
}

export function roundUpToStep(value: number, step: number): number {
  if (!(value > 0)) return 0
  const steps = Math.ceil(value / step - 1e-9)
  const decimals = step >= 1 ? 0 : Math.round(-Math.log10(step))
  return Number((steps * step).toFixed(decimals))
}

/** Cantidad de una línea escalada al PAX (sin cambio si el multiplicador es 1). */
export function scaleLineQuantity(quantity: number, unit: string | undefined, multiplier: number): number {
  if (multiplier === 1) return quantity
  const scaled = quantity * multiplier
  // El escalón nunca pasa del 10 % de la cantidad (docs/190): con 0.1 fijo, 0.002 g de
  // azafrán se volvían 0.1 g (50 veces más). Sigue redondeando siempre hacia arriba.
  let step = paxStep(unit)
  while (step > scaled / 10 && step > 1e-6) step /= 10
  return roundUpToStep(scaled, step)
}

/** Línea escalada con su extensión recalculada a partir de la cantidad redondeada. */
export function scaleRecipeLine(line: RecipeIngredient, multiplier: number): RecipeIngredient {
  if (multiplier === 1) return line
  const quantity = scaleLineQuantity(line.quantity, line.unit, multiplier)
  return { ...line, quantity, extension: quantity * (line.unitCost || 0) }
}

/**
 * «Restaurar receta original»: la copia guardada al escalar puede tener precios viejos
 * (la cascada de precios actualiza la receta, no la copia) o una unidad que el
 * ingrediente ya no usa. Se ponen al día con el ingrediente actual (docs/189).
 */
export function refreshSnapshotLines(lines: RecipeIngredient[], ingredients: Ingredient[]): RecipeIngredient[] {
  return lines.map((line) => {
    const ingredient = line.ingredientId ? ingredients.find((i) => i.id === line.ingredientId) : undefined
    if (!ingredient) return line
    const f = line.unit && line.unit !== ingredient.unit ? unitFactor(line.unit, ingredient.unit) : 1
    // Unidades que no se convierten entre sí (unidad ↔ kg): se deja la línea como estaba.
    if (!f) return line
    const quantity = Math.round(line.quantity * f * 1e6) / 1e6
    const unitCost = ingredient.pricing?.pricePerUnit ?? line.unitCost
    return {
      ...line,
      quantity,
      unit: ingredient.unit,
      measure: unitAbbreviations[ingredient.unit] || ingredient.unit,
      unitCost,
      costPerMeasure: unitCost,
      extension: quantity * (unitCost || 0),
    }
  })
}
