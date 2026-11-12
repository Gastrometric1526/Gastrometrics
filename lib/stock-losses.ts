/**
 * Pérdidas de inventario registradas a mano (docs/283): derrames, botellas rotas,
 * cortesías servidas sin pasar por el POS, vencidos u otras. Es la etapa 5 de la propuesta
 * de barra del dueño («control de derrames, cortesías y diferencias»), y sirve igual para
 * la cocina.
 *
 * - Registrar una pérdida resta del stock contado y queda en `stockLosses` del producto.
 * - El stock teórico la resta (lib/theoretical-stock.ts).
 * - Un conteo nuevo la pasa al registro como `lostSincePrevious` (por motivo) y la limpia,
 *   así la diferencia del conteo separa lo explicado (pérdidas) de lo que falta sin explicar.
 * Lo anulado en el POS (no se preparó, se perdió, cortesía) ya descuenta por su lado
 * (docs/275); esto es para lo que pasa fuera del POS.
 */

import type { InventoryItem, StockLoss, StockLossReason } from "@/types/inventory"
import { stockStatus } from "@/lib/inventory-status"

export const STOCK_LOSS_REASONS: StockLossReason[] = ["spill", "broken", "courtesy", "expired", "other"]

export function isStockLossReason(value: unknown): value is StockLossReason {
  return typeof value === "string" && (STOCK_LOSS_REASONS as string[]).includes(value)
}

/** Cambios que hay que guardar en el producto al registrar una pérdida, o null si no vale. */
export function applyStockLoss(
  item: Pick<InventoryItem, "currentStock" | "minStock" | "stockLosses">,
  input: { quantity: number; reason: StockLossReason; note?: string; by?: string; at?: string },
): Pick<InventoryItem, "currentStock" | "status" | "stockLosses"> | null {
  const quantity = Number(input.quantity)
  if (!Number.isFinite(quantity) || quantity <= 0 || !isStockLossReason(input.reason)) return null
  const current = item.currentStock ?? 0
  // Nunca deja el stock contado en negativo: si se pierde más de lo contado, se registra
  // lo que había (el resto saldrá como diferencia en el próximo conteo).
  const applied = Math.min(quantity, Math.max(current, 0))
  if (!(applied > 0)) return null
  const loss: StockLoss = {
    quantity: Number(applied.toFixed(4)),
    at: input.at ?? new Date().toISOString(),
    reason: input.reason,
    ...(input.note?.trim() ? { note: input.note.trim().slice(0, 140) } : {}),
    ...(input.by ? { by: input.by } : {}),
  }
  const nextStock = Number((current - applied).toFixed(4))
  return { currentStock: nextStock, status: stockStatus(nextStock, item.minStock), stockLosses: [...(item.stockLosses ?? []), loss] }
}

/** Pérdidas registradas después de un momento (ISO), en total. */
export function lostAfter(item: Pick<InventoryItem, "stockLosses">, fromAt: string): number {
  return (item.stockLosses ?? []).filter((l) => l.at > fromAt).reduce((sum, l) => sum + (l.quantity || 0), 0)
}

/** Pérdidas por motivo, para guardarlas en el registro de un conteo. */
export function lossesByReason(losses: StockLoss[] | undefined): Partial<Record<StockLossReason, number>> {
  const out: Partial<Record<StockLossReason, number>> = {}
  for (const l of losses ?? []) out[l.reason] = Number(((out[l.reason] ?? 0) + (l.quantity || 0)).toFixed(4))
  return out
}

export function sumLosses(byReason: Partial<Record<StockLossReason, number>> | undefined): number {
  return Object.values(byReason ?? {}).reduce((sum, n) => sum + (n || 0), 0)
}
