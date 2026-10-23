/**
 * Semáforo de stock y reposición sugerida (docs/190): una sola regla para Inventario,
 * los registros de conteo y la orden sugerida por stock bajo (antes la condición estaba
 * copiada en cinco lugares).
 *
 * - Sin contar (null): normal.
 * - stock ≤ mínimo: crítico.
 * - stock ≤ 2 × mínimo: bajo.
 * - si no: normal.
 */
export type StockStatus = "normal" | "low" | "critical"

export function stockStatus(currentStock: number | null | undefined, minStock: number | null | undefined): StockStatus {
  if (currentStock === null || currentStock === undefined || !Number.isFinite(currentStock)) return "normal"
  const min = minStock || 0
  if (currentStock <= min) return "critical"
  if (currentStock <= min * 2) return "low"
  return "normal"
}

/** Orden sugerida: repone hasta el doble del mínimo y nunca menos que el mínimo. */
export function suggestedRestockQuantity(currentStock: number | null | undefined, minStock: number): number {
  return Math.max(minStock * 2 - (currentStock || 0), minStock)
}
