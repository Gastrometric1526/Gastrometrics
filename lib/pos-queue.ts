/**
 * Cola del POS sin conexión (docs/275). Si un cambio de pedido no se pudo guardar porque se
 * cayó la conexión, queda aquí (en el aparato) con la versión de la que partió, y se reintenta
 * al volver la conexión. Mientras tanto la pantalla lo sigue mostrando encima de lo leído.
 */

import type { PosOrder } from "@/types/pos"

export interface QueuedOrder {
  /** Pedido como estaba antes del primer cambio sin guardar (para juntar con otros aparatos). */
  base: PosOrder | null
  /** Último estado que quiero guardar. */
  mine: PosOrder
  queuedAt: string
}

const key = (businessId: string) => `gm_pos_queue:${businessId || "main"}`

export function readQueue(businessId: string): Record<string, QueuedOrder> {
  try {
    const raw = localStorage.getItem(key(businessId))
    return raw ? (JSON.parse(raw) as Record<string, QueuedOrder>) : {}
  } catch {
    return {}
  }
}

function writeQueue(businessId: string, queue: Record<string, QueuedOrder>): void {
  try {
    if (Object.keys(queue).length === 0) localStorage.removeItem(key(businessId))
    else localStorage.setItem(key(businessId), JSON.stringify(queue))
  } catch {}
}

/** Pone (o actualiza) un pedido en la cola; conserva la base del primer cambio. */
export function enqueueOrder(businessId: string, base: PosOrder | null, mine: PosOrder, now = new Date()): void {
  const queue = readQueue(businessId)
  const prev = queue[mine.id]
  queue[mine.id] = { base: prev ? prev.base : base, mine, queuedAt: prev?.queuedAt ?? now.toISOString() }
  writeQueue(businessId, queue)
}

export function dequeueOrder(businessId: string, orderId: string): void {
  const queue = readQueue(businessId)
  delete queue[orderId]
  writeQueue(businessId, queue)
}

/** Lo leído del servidor con los cambios en cola encima (para que la pantalla no «vuelva atrás»). */
export function overlayQueued(orders: PosOrder[], queue: Record<string, QueuedOrder>): PosOrder[] {
  const ids = new Set(orders.map((o) => o.id))
  const out = orders.map((o) => queue[o.id]?.mine ?? o)
  for (const q of Object.values(queue)) if (!ids.has(q.mine.id) && !q.base) out.push(q.mine)
  return out
}
