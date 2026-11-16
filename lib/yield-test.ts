/**
 * Prueba de rendimiento por cortes (docs/322), la «butcher test» de los libros de control de
 * costos: se pesa la pieza que compraste y cada parte que sale de ella.
 *
 * - Útil: lo que va a tus recetas (el lomo limpio, los filetes).
 * - Subproducto: lo que no va a la receta pero aprovechas y tiene valor (huesos para caldo,
 *   recortes para molida). Su valor se descuenta del costo de lo útil.
 * - Desecho: grasa, piel, lo que se bota. Lo que no se pesó (sangre, agua) también es desecho.
 *
 * Fórmulas (todas en la misma unidad de peso):
 *   rendimiento % = peso útil ÷ peso comprado × 100
 *   valor de subproductos = Σ peso × valor por unidad
 *   costo real por unidad útil = (precio pagado − valor de subproductos) ÷ peso útil
 *   merma para tus recetas = 1 − precio pagado ÷ (costo real por unidad útil × peso comprado)
 * La última es la merma que, puesta en el ingrediente, da en las recetas exactamente el costo
 * real por unidad útil (precio ÷ (contenido × (1 − merma))). Sin subproductos es 100 − rendimiento.
 * Tope 95 %, como la merma escrita a mano (docs/278).
 */

export type YieldPartKind = "usable" | "byproduct" | "waste"

export interface YieldPart {
  name: string
  weight: number
  kind: YieldPartKind
  /** Solo subproductos: cuánto vale cada unidad de peso. */
  valuePerUnit?: number
}

export interface YieldTestInput {
  /** Peso de la pieza comprada. */
  grossWeight: number
  /** Lo que pagaste por esa pieza. */
  pricePaid: number
  parts: YieldPart[]
}

export interface YieldTestResult {
  usableWeight: number
  byproductWeight: number
  wasteWeight: number
  /** Peso que no se registró (gross − suma de partes); cuenta como desecho. */
  unweighed: number
  yieldPercent: number
  byproductValue: number
  /** Precio de compra por unidad, antes de la prueba. */
  pricePerGrossUnit: number
  /** (precio − subproductos) ÷ peso útil. null si no hay peso útil. */
  costPerUsableUnit: number | null
  /** Merma a poner en el ingrediente, en %, con 2 decimales. null si no se puede calcular. */
  mermaPercent: number | null
  /** true si la suma de las partes pasa del peso comprado. */
  partsExceedGross: boolean
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const r4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000

export function computeYieldTest(input: YieldTestInput): YieldTestResult {
  const gross = Math.max(0, input.grossWeight || 0)
  const price = Math.max(0, input.pricePaid || 0)
  let usable = 0
  let byproduct = 0
  let waste = 0
  let byValue = 0
  for (const p of input.parts) {
    const w = Math.max(0, p.weight || 0)
    if (p.kind === "usable") usable += w
    else if (p.kind === "byproduct") {
      byproduct += w
      byValue += w * Math.max(0, p.valuePerUnit || 0)
    } else waste += w
  }
  const weighed = usable + byproduct + waste
  const unweighed = Math.max(0, gross - weighed)
  const yieldPercent = gross > 0 ? (usable / gross) * 100 : 0
  const costPerUsable = usable > 0 ? Math.max(0, price - byValue) / usable : null
  let merma: number | null = null
  if (costPerUsable !== null && costPerUsable > 0 && gross > 0 && price > 0) {
    merma = (1 - price / (costPerUsable * gross)) * 100
    merma = Math.min(95, Math.max(0, merma))
  } else if (costPerUsable !== null && gross > 0 && price === 0) {
    merma = Math.min(95, Math.max(0, 100 - yieldPercent))
  }
  return {
    usableWeight: r4(usable),
    byproductWeight: r4(byproduct),
    wasteWeight: r4(waste + unweighed),
    unweighed: r4(unweighed),
    yieldPercent: r2(yieldPercent),
    byproductValue: r2(byValue),
    pricePerGrossUnit: gross > 0 ? r4(price / gross) : 0,
    costPerUsableUnit: costPerUsable === null ? null : r4(costPerUsable),
    mermaPercent: merma === null ? null : r2(merma),
    partsExceedGross: weighed > gross + 1e-9,
  }
}
