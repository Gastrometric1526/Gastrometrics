/**
 * Punto de equilibrio (docs/314, pedido del dueño). Una sola definición para el simulador de
 * escenarios del negocio y para Reportes:
 *
 *   Margen de contribución por plato = venta neta (sin ISV) − comisión − costo del plato
 *                                     (`unitMarginAmount`, igual que la Ficha Técnica)
 *   Platos para el equilibrio      = Costos fijos ÷ Margen de contribución por plato
 *   Venta neta para el equilibrio   = Platos × Venta neta por plato
 *                                   = Costos fijos ÷ (Margen de contribución ÷ Venta neta)
 *   Cubiertos (comensales)         = Platos ÷ Platos por comensal (solo si se anotan comensales)
 *
 * Unidad: «plato» es cada plato vendido (una línea × su cantidad); un menú vendido cuenta como
 * un plato. Antes el simulador usaba el precio CON el ISV incluido y sin la comisión, así que
 * el margen por plato salía de más y el equilibrio, de menos.
 *
 * Costos fijos: los gastos mensuales del negocio (alquiler, servicios, operación, marketing,
 * personal, otros), prorrateados al período. Si el margen por plato es 0 o negativo, no hay
 * equilibrio posible: se devuelve `null`, nunca un número.
 */

export interface BreakEvenInput {
  fixedCosts: number
  /** Margen de contribución por plato (venta neta − comisión − costo). */
  contributionPerUnit: number
  /** Venta neta (sin ISV) por plato. */
  netPricePerUnit: number
  /** Platos por comensal, si se conocen (platos vendidos ÷ comensales anotados). */
  unitsPerCover?: number | null
}

export interface BreakEvenResult {
  units: number
  netRevenue: number
  covers: number | null
  /** Margen de contribución ÷ venta neta. */
  contributionRatio: number
}

export function breakEven({ fixedCosts, contributionPerUnit, netPricePerUnit, unitsPerCover }: BreakEvenInput): BreakEvenResult | null {
  if (!(contributionPerUnit > 0) || !(netPricePerUnit > 0) || !(fixedCosts >= 0)) return null
  const units = fixedCosts / contributionPerUnit
  return {
    units,
    netRevenue: units * netPricePerUnit,
    covers: unitsPerCover && unitsPerCover > 0 ? units / unitsPerCover : null,
    contributionRatio: contributionPerUnit / netPricePerUnit,
  }
}

/**
 * Equilibrio con los datos reales de un período (Reportes): margen y venta neta de los platos
 * con receta, platos vendidos y comensales anotados.
 */
export function breakEvenFromPeriod(params: {
  fixedCosts: number
  linkedNetRevenue: number
  linkedContribution: number
  dishesSold: number
  guests: number
}): BreakEvenResult | null {
  const { fixedCosts, linkedNetRevenue, linkedContribution, dishesSold, guests } = params
  if (!(dishesSold > 0)) return null
  return breakEven({
    fixedCosts,
    contributionPerUnit: linkedContribution / dishesSold,
    netPricePerUnit: linkedNetRevenue / dishesSold,
    unitsPerCover: guests > 0 ? dishesSold / guests : null,
  })
}
