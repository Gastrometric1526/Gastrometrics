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

/** Cuánto del precio (que ya incluye el ISV) es impuesto. */
export function taxIncludedIn(price: number, isvPercent: number): number {
  const rate = clampPct(isvPercent, 100) / 100
  if (!(price > 0) || rate === 0) return 0
  return price - price / (1 + rate)
}
