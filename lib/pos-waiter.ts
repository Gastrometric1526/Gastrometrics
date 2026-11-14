/**
 * El POS pensado para el mesero con el celular en la mano (pedido del dueño, docs/302):
 * «que sea súper intuitivo para ser utilizado por un mesero que esté yendo a una mesa,
 * ordenando, facturando». Reglas puras, probadas en pos-waiter.test.ts:
 *
 * - quién entra directo al POS (invitado que solo tiene el POS) y quién puede cambiar el
 *   plano y los extras (el dueño o quien administra el equipo);
 * - el vuelto en efectivo;
 * - las mesas como tarjetas grandes (estado, total, minutos, platos listos);
 * - qué platos se acaban de poner «listos» (para avisar al mesero);
 * - el recibo (pre-cuenta o pagado) y la factura que salen del cobro.
 */

import { itemsForSeats, itemTotal, itemUnitPrice, minutesSince, orderTotal, tableStatus, type TableStatus } from "@/lib/pos"
import type { FeatureKey } from "@/lib/plans"
import { withoutParts } from "@/lib/team-parts"
import type { Invoice, InvoiceLineItem } from "@/types/invoice"
import type { PosOrder, PosOrderItem, PosPayment } from "@/types/pos"
import type { PaymentMethod } from "@/types/sales-import"

const round2 = (n: number) => Math.round(n * 100) / 100

// ─── Quién usa el POS ─────────────────────────────────────────────────────────

/**
 * Permisos que acompañan al POS sin cambiar el trabajo del mesero: el POS necesita el
 * registro manual de ventas (lib/team-access.ts) y el cuadre de caja y el historial son
 * del mismo turno. Con solo esto, la persona entra directo al POS.
 */
const WAITER_FEATURES: FeatureKey[] = ["pos", "manual_sales", "cash_up", "sales_history"]

/** ¿El invitado solo trabaja en el POS? Entonces la app lo lleva directo al salón. */
export function isPosOnlyMember(features: readonly string[] | null | undefined): boolean {
  if (!features) return false
  const list = withoutParts(features).filter((f) => f !== "access_v2")
  return list.includes("pos") && list.every((f) => (WAITER_FEATURES as string[]).includes(f))
}

// Ajustes del POS: desde docs/303 es la parte «pos.settings» de Equipo (lib/team-parts.ts).

// ─── Cobro ────────────────────────────────────────────────────────────────────

/** Vuelto en efectivo: null si todavía no alcanza (o no se anotó lo recibido). */
export function cashChange(total: number, received: number | null | undefined): number | null {
  if (received == null || !Number.isFinite(received) || received <= 0) return null
  const change = round2(received - total)
  return change >= 0 ? change : null
}

/**
 * Billetes para cobrar rápido en efectivo: el total exacto y los siguientes montos
 * redondos que lo cubren (sin repetir). `steps` son los escalones de la moneda.
 */
export function quickCashAmounts(total: number, steps: number[] = [50, 100, 500]): number[] {
  if (!(total > 0)) return []
  const out = [round2(total)]
  for (const step of steps) {
    const next = Math.ceil(total / step) * step
    if (next > total && !out.includes(next)) out.push(next)
  }
  return out.slice(0, 4)
}

/** Propina como porcentaje del subtotal (con el descuento ya restado), redondeada a 2 decimales. */
export function tipFromPercent(base: number, percent: number): number {
  if (!(base > 0) || !(percent > 0)) return 0
  return round2((base * percent) / 100)
}

// ─── Mesas en tarjetas ────────────────────────────────────────────────────────

export interface TableTileInfo {
  status: TableStatus
  total: number
  /** Minutos desde que se abrió la mesa (0 si está libre). */
  minutes: number
  /** Platos listos para llevar a la mesa. */
  ready: number
  /** Platos anotados que todavía no se mandaron a cocina. */
  pending: number
}

export function tableTile(order: PosOrder | undefined, now = new Date()): TableTileInfo {
  if (!order) return { status: "free", total: 0, minutes: 0, ready: 0, pending: 0 }
  return {
    status: tableStatus(order),
    total: orderTotal(order),
    minutes: minutesSince(order.openedAt, now),
    ready: order.items.filter((i) => i.status === "ready").reduce((s, i) => s + i.quantity, 0),
    pending: order.items.filter((i) => i.status === "new").reduce((s, i) => s + i.quantity, 0),
  }
}

// ─── Aviso «listo para servir» ────────────────────────────────────────────────

/** Ids de los platos que están listos ahora mismo. */
export function readyItemIds(orders: PosOrder[]): Set<string> {
  const out = new Set<string>()
  for (const o of orders) for (const i of o.items) if (i.status === "ready") out.add(i.id)
  return out
}

/**
 * Platos que pasaron a «listo» desde la última vez que se miró (`before`), agrupados por
 * mesa. Con `waiter`, solo las mesas de ese mesero (o sin mesero anotado).
 */
export function newlyReady(
  before: Set<string>,
  orders: PosOrder[],
  waiter: string | null = null,
): { order: PosOrder; items: PosOrderItem[] }[] {
  const mine = (o: PosOrder) => !waiter || !o.waiter || o.waiter.trim().toLowerCase() === waiter.trim().toLowerCase()
  return orders
    .filter(mine)
    .map((order) => ({ order, items: order.items.filter((i) => i.status === "ready" && !before.has(i.id)) }))
    .filter((g) => g.items.length > 0)
}

// ─── Recibo y factura ─────────────────────────────────────────────────────────

export interface PosReceiptLine {
  quantity: number
  name: string
  extras: string[]
  note: string | null
  amount: number
}

export interface PosReceipt {
  /** false = pre-cuenta (todavía no se cobró). */
  paid: boolean
  tableLabel: string
  areaName: string | null
  waiter: string | null
  guests: number | null
  /** Sillas cobradas (cuenta dividida), o null si es toda la cuenta. */
  seats: number[] | null
  at: string
  lines: PosReceiptLine[]
  subtotal: number
  discount: number
  tip: number
  total: number
  payment: PaymentMethod | null
  received: number | null
  change: number | null
}

/**
 * Recibo de una cuenta: con `pay`, lo que se cobró (toda la cuenta o las sillas elegidas);
 * sin `pay`, la pre-cuenta de todo lo que hay en la mesa. Mismos montos que el cobro
 * (`itemTotal`, `orderTotal`), nunca otra fórmula.
 */
export function buildPosReceipt(
  order: PosOrder,
  pay: (PosPayment & { received?: number | null }) | null,
  now = new Date(),
): PosReceipt {
  const items = itemsForSeats(order.items, pay?.seats ?? null)
  const subtotal = orderTotal({ items })
  const discount = pay ? Math.min(Math.max(pay.discount, 0), subtotal) : 0
  const tip = pay ? Math.max(pay.tip, 0) : 0
  const total = round2(subtotal - discount + tip)
  const received = pay?.payment === "cash" ? pay.received ?? null : null
  return {
    paid: !!pay,
    tableLabel: order.tableLabel,
    areaName: order.areaName,
    waiter: order.waiter,
    guests: order.guests,
    seats: pay?.seats ?? null,
    at: now.toISOString(),
    lines: items.map((i) => ({
      quantity: i.quantity,
      name: i.name,
      extras: i.extras.map((e) => (e.quantity > 1 ? `${e.quantity} × ${e.name}` : e.name)),
      note: i.note,
      amount: itemTotal(i),
    })),
    subtotal,
    discount: round2(discount),
    tip: round2(tip),
    total,
    payment: pay?.payment ?? null,
    received,
    change: received != null ? cashChange(total, received) : null,
  }
}

/**
 * Factura de una cuenta ya cobrada en el POS (docs/302). La venta ya quedó en el registro
 * del día al cobrar, así que la factura lleva `posTicketId` y Facturas NO la vuelve a
 * sumar como venta. Precios finales (sin impuesto encima: el precio de la carta ya es el que
 * paga el cliente); el descuento va aparte y la propina en las notas.
 */
export function posInvoice(
  receipt: PosReceipt,
  input: {
    id: string
    number: string
    businessId: string
    posTicketId: string
    clientName: string
    clientTaxId?: string
    clientEmail?: string
    notes?: string
    issueDate: string
    newId: () => string
  },
): Invoice {
  const items: InvoiceLineItem[] = receipt.lines.map((l) => ({
    id: input.newId(),
    description: l.extras.length ? `${l.name} (+ ${l.extras.join(", ")})` : l.name,
    quantity: l.quantity,
    unitPrice: round2(l.amount / l.quantity),
    amount: l.amount,
  }))
  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0))
  const now = new Date().toISOString()
  return {
    id: input.id,
    businessId: input.businessId,
    number: input.number,
    status: "paid",
    issueDate: input.issueDate,
    clientName: input.clientName.trim(),
    clientTaxId: input.clientTaxId?.trim() || undefined,
    clientEmail: input.clientEmail?.trim() || undefined,
    items,
    taxPercent: 0,
    discount: receipt.discount > 0 ? receipt.discount : undefined,
    notes: input.notes?.trim() || undefined,
    subtotal,
    taxAmount: 0,
    total: round2(subtotal - receipt.discount),
    posTicketId: input.posTicketId,
    metadata: { createdAt: now, updatedAt: now, version: 1 },
  }
}

/** Precio por unidad de una línea del pedido con sus extras (re-exportado para la pantalla). */
export { itemUnitPrice }
