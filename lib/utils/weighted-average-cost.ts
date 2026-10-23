// Costo promedio ponderado (método de costo móvil) para compras de inventario.
// Extraído de components/inventory/register-inventory-modal.tsx para poder cubrirlo
// con una prueba unitaria directa — la cantidad comprada se infiere como el
// incremento de stock entre lo que había antes de la compra y lo que hay después.
export interface WeightedAverageCostInput {
  previousStock: number
  newStock: number
  purchasePrice: number
  netContent: number
  previousWeightedAverageCost: number | undefined
  previousWeightedAverageQuantity: number
}

export interface WeightedAverageCostResult {
  weightedAverageCost: number | undefined
  weightedAverageQuantity: number
}

export function computeWeightedAverageCost({
  previousStock,
  newStock,
  purchasePrice,
  netContent,
  previousWeightedAverageCost,
  previousWeightedAverageQuantity,
}: WeightedAverageCostInput): WeightedAverageCostResult {
  const purchasedQuantity = Math.max(0, newStock - previousStock)

  if (purchasedQuantity <= 0) {
    return {
      weightedAverageCost: previousWeightedAverageCost,
      weightedAverageQuantity: previousWeightedAverageQuantity,
    }
  }

  const pricePerUnitThisPurchase = purchasePrice / (netContent || 1)

  // Costo promedio móvil (docs/187): lo que había en stock ANTES de la compra, a su costo
  // promedio, más lo comprado a su precio, entre el stock nuevo. BUG CORREGIDO: antes se
  // ponderaba contra TODO lo comprado en la historia (nunca se restaba lo consumido), así
  // que las compras viejas pesaban para siempre y el promedio casi no se movía.
  const onHand = Math.max(0, previousStock)
  const weightedAverageCost =
    onHand > 0 && previousWeightedAverageCost !== undefined
      ? (onHand * previousWeightedAverageCost + purchasedQuantity * pricePerUnitThisPurchase) / (onHand + purchasedQuantity)
      : pricePerUnitThisPurchase

  return {
    weightedAverageCost,
    // Se conserva el campo por compatibilidad: ahora es el stock sobre el que se calculó.
    weightedAverageQuantity: onHand + purchasedQuantity,
  }
}
