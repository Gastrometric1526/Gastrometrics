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

/**
 * Semáforo con el stock teórico cuando lo hay (docs/237): último conteo + recibido − consumido
 * por las ventas. Antes el semáforo miraba solo lo contado: un producto podía verse normal
 * aunque las ventas desde el conteo ya lo hubieran agotado. Sin stock teórico (sin conteo o
 * sin movimientos) se usa lo contado, como siempre.
 */
export function effectiveStockStatus(
  currentStock: number | null | undefined,
  minStock: number | null | undefined,
  theoretical?: number | null,
): StockStatus {
  return stockStatus(typeof theoretical === "number" && Number.isFinite(theoretical) ? theoretical : currentStock, minStock)
}

/** Orden sugerida: repone hasta el doble del mínimo y nunca menos que el mínimo. */
export function suggestedRestockQuantity(currentStock: number | null | undefined, minStock: number): number {
  return Math.max(minStock * 2 - (currentStock || 0), minStock)
}
