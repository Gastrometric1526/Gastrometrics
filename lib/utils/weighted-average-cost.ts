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

  const weightedAverageCost =
    previousWeightedAverageQuantity > 0
      ? (previousWeightedAverageQuantity * (previousWeightedAverageCost ?? pricePerUnitThisPurchase) +
          purchasedQuantity * pricePerUnitThisPurchase) /
        (previousWeightedAverageQuantity + purchasedQuantity)
      : pricePerUnitThisPurchase

  return {
    weightedAverageCost,
    weightedAverageQuantity: previousWeightedAverageQuantity + purchasedQuantity,
  }
}
