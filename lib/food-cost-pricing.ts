// Precio por el método Food Cost % (docs/155): precio = costo unitario ÷ % objetivo, y
// encima el ISV como impuesto sobre el precio (el precio sugerido ya lo incluye). El
// método GastroMetrics (6 rubros) mantiene el ISV como un rubro % del costo, decisión del
// dueño — esto solo aplica a Food Cost.

const clampPct = (pct: number, max: number) => Math.min(Math.max(Number(pct) || 0, 0), max)

/** Precio antes de comisión y redondeo: costo ÷ food cost objetivo, más el ISV. */
export function foodCostBasePrice(unitCost: number, targetFoodCostPercent: number, isvPercent: number): number {
  if (!(unitCost > 0) || !(targetFoodCostPercent > 0)) return 0
  const net = unitCost / (targetFoodCostPercent / 100)
  return net * (1 + clampPct(isvPercent, 100) / 100)
}

/**
 * Precio que cubre la comisión de la app de delivery o la tarjeta (docs/137, docs/235): la
 * comisión se cobra sobre el precio completo, impuesto incluido, así que el precio se divide
 * entre (1 − comisión × (1 + ISV incluido)). Así, después del impuesto y la comisión queda lo
 * mismo que sin comisión. Sin ISV en el precio (6 rubros, donde el ISV es un rubro sobre el
 * costo) es base ÷ (1 − comisión). Antes siempre se dividía entre (1 − comisión) y, con ISV,
 * quedaba menos de lo prometido. La comisión se limita a 90 % y el divisor a un mínimo de 0.1.
 */
export function coverCommission(basePrice: number, commissionPercent: number, isvIncludedPercent = 0): number {
  const fraction = clampPct(commissionPercent, 90) / 100
  if (!(basePrice > 0) || fraction === 0) return basePrice
  const divisor = Math.max(1 - fraction * (1 + clampPct(isvIncludedPercent, 100) / 100), 0.1)
  return basePrice / divisor
}

/** Cuánto del precio (que ya incluye el ISV) es impuesto. */
export function taxIncludedIn(price: number, isvPercent: number): number {
  const rate = clampPct(isvPercent, 100) / 100
  if (!(price > 0) || rate === 0) return 0
  return price - price / (1 + rate)
}
