/**
 * Reglas puras del POS propio (docs/268), probadas en pos.test.ts. La pantalla vive en
 * app/salon y components/pos; el guardado en lib/storage/pos.ts.
 *
 * Al cobrar, la cuenta se convierte en una cuenta del registro manual del día
 * (`mergeSaleIntoDay`), con las mismas funciones que el registro manual
 * (lib/manual-sales.ts → buildImportLines): el descuento se reparte en las líneas, la
 * propina no es venta y los extras van como modificadores (costo e inventario teórico).
 */

import { buildImportLines, emptyTicket, ticketsToSave, type DraftTicket } from "@/lib/manual-sales"
import { modifiersUnitCost } from "@/lib/pos-modifiers"
import type { SaleModifier } from "@/lib/pos-modifiers"
import type { FloorPlan, FloorTable, PosConfig, PosExtra, PosOrder, PosOrderExtra, PosOrderItem, PosPayment, TableShape } from "@/types/pos"
import type { SalesImport, SalesImportLine, SalesTicket } from "@/types/sales-import"

/** Tamaño del lienzo del plano, en unidades (se dibuja a escala con un SVG). */
export const FLOOR_W = 1000
export const FLOOR_H = 640
/** Las mesas se acomodan en una cuadrícula de este paso. */
export const FLOOR_GRID = 20

const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

/** Ajusta a la cuadrícula y mantiene la mesa dentro del lienzo. Puro. */
export function snapTable(table: FloorTable): FloorTable {
  const w = clamp(Math.round(table.w / FLOOR_GRID) * FLOOR_GRID, 60, 400)
  const h = clamp(Math.round(table.h / FLOOR_GRID) * FLOOR_GRID, 60, 400)
  return {
    ...table,
    w,
    h,
    x: clamp(Math.round(table.x / FLOOR_GRID) * FLOOR_GRID, 0, FLOOR_W - w),
    y: clamp(Math.round(table.y / FLOOR_GRID) * FLOOR_GRID, 0, FLOOR_H - h),
    seats: clamp(Math.round(table.seats) || 1, 1, 20),
  }
}

/** Tamaño de una mesa nueva según su forma. */
export function shapeSize(shape: TableShape, seats: number): { w: number; h: number } {
  if (shape === "rect") return { w: Math.max(160, Math.ceil(seats / 2) * 60), h: 100 }
  if (shape === "round") return { w: seats > 4 ? 140 : 100, h: seats > 4 ? 140 : 100 }
  return { w: seats > 4 ? 140 : 100, h: seats > 4 ? 140 : 100 }
}

/** Plano de inicio: un área con 6 mesas de 4 sillas. */
export function defaultFloorPlan(areaName: string, newId: () => string, now = new Date()): FloorPlan {
  const areaId = newId()
  const tables: FloorTable[] = []
  for (let i = 0; i < 6; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    tables.push({ id: newId(), areaId, label: String(i + 1), shape: i % 2 ? "round" : "square", seats: 4, x: 100 + col * 300, y: 120 + row * 260, w: 120, h: 120 })
  }
  return { areas: [{ id: areaId, name: areaName }], tables, updatedAt: now.toISOString() }
}

/** El siguiente número libre de mesa («7» si ya hay 1…6). */
export function nextTableLabel(plan: FloorPlan): string {
  const used = new Set(plan.tables.map((t) => t.label.trim()))
  for (let n = 1; n < 1000; n++) if (!used.has(String(n))) return String(n)
  return String(plan.tables.length + 1)
}

/**
 * Posición de cada silla alrededor de la mesa, en unidades del lienzo. Mesas redondas: en
 * círculo. Cuadradas y rectangulares: repartidas por los lados largos primero. Puro.
 */
export function seatPositions(table: FloorTable): { seat: number; x: number; y: number }[] {
  const cx = table.x + table.w / 2
  const cy = table.y + table.h / 2
  const out: { seat: number; x: number; y: number }[] = []
  if (table.shape === "round") {
    const r = Math.max(table.w, table.h) / 2 + 18
    for (let i = 0; i < table.seats; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / table.seats
      out.push({ seat: i + 1, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    }
    return out
  }
  const wide = table.w >= table.h
  const perLong = Math.ceil(table.seats / 2)
  const longSides = table.seats <= 2 ? 1 : 2
  let seat = 1
  for (let side = 0; side < 2 && seat <= table.seats; side++) {
    const count = side === 0 ? (longSides === 1 ? table.seats : perLong) : table.seats - perLong
    for (let i = 0; i < count && seat <= table.seats; i++) {
      const f = (i + 1) / (count + 1)
      if (wide) out.push({ seat: seat++, x: table.x + table.w * f, y: side === 0 ? table.y - 18 : table.y + table.h + 18 })
      else out.push({ seat: seat++, x: side === 0 ? table.x - 18 : table.x + table.w + 18, y: table.y + table.h * f })
    }
  }
  return out
}

// ============== PEDIDOS ==============

/** Precio de una unidad con sus extras. */
export function itemUnitPrice(item: Pick<PosOrderItem, "unitPrice" | "extras">): number {
  return round2(item.unitPrice + item.extras.reduce((s, e) => s + e.price * e.quantity, 0))
}

/** Extras como modificadores (lib/pos-modifiers.ts), para el costo y el inventario teórico. */
export function extrasAsModifiers(extras: PosOrderExtra[]): SaleModifier[] {
  return extras.map((e) => ({ name: e.name, recipeId: e.recipeId, quantity: e.quantity, price: e.price }))
}

/** Minutos promedio entre «Mandar a cocina» y «Listo» de los platos que pasaron por cocina. */
export function kitchenMinutes(items: PosOrderItem[]): number | null {
  const spans = items
    .filter((i) => i.sentAt && i.readyAt)
    .map((i) => (Date.parse(i.readyAt as string) - Date.parse(i.sentAt as string)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0)
  return spans.length ? Math.round((spans.reduce((s, m) => s + m, 0) / spans.length) * 10) / 10 : null
}

/** Costo de una unidad con el costo de sus extras unidos a una receta. */
export function itemUnitCost(item: Pick<PosOrderItem, "unitCost" | "extras">, recipes: { id: string; costPerServing?: number }[]): number {
  return item.unitCost + modifiersUnitCost(extrasAsModifiers(item.extras), recipes)
}

export function itemTotal(item: PosOrderItem): number {
  return round2(item.quantity * itemUnitPrice(item))
}

/** Total de la cuenta, o solo de las sillas pedidas (0 = lo de la mesa). */
export function orderTotal(order: Pick<PosOrder, "items">, seats: number[] | null = null): number {
  return round2(itemsForSeats(order.items, seats).reduce((s, i) => s + itemTotal(i), 0))
}

export function itemsForSeats(items: PosOrderItem[], seats: number[] | null): PosOrderItem[] {
  if (!seats) return items
  return items.filter((i) => seats.includes(i.seat ?? 0))
}

/** Sillas con algo pedido, en orden (0 = lo de la mesa). */
export function seatsInOrder(order: Pick<PosOrder, "items">): number[] {
  return [...new Set(order.items.map((i) => i.seat ?? 0))].sort((a, b) => a - b)
}

const extrasKey = (extras: PosOrderExtra[]) =>
  extras
    .map((e) => `${e.extraId}x${e.quantity}`)
    .sort()
    .join(",")

/**
 * Agrega un plato. Si ya hay uno igual sin mandar a cocina (misma silla, extras y nota),
 * suma la cantidad en vez de repetir la línea.
 */
export function addOrderItem(order: PosOrder, item: PosOrderItem, now = new Date()): PosOrder {
  const same = order.items.find(
    (i) =>
      i.status === "new" &&
      i.sourceType === item.sourceType &&
      i.refId === item.refId &&
      i.seat === item.seat &&
      i.unitPrice === item.unitPrice &&
      (i.note || "") === (item.note || "") &&
      extrasKey(i.extras) === extrasKey(item.extras),
  )
  const items = same ? order.items.map((i) => (i === same ? { ...i, quantity: i.quantity + item.quantity } : i)) : [...order.items, item]
  return { ...order, items, updatedAt: now.toISOString() }
}

/** Cambia la cantidad; en 0 se quita la línea. Solo se edita lo que no se mandó a cocina. */
export function setItemQuantity(order: PosOrder, itemId: string, quantity: number, now = new Date()): PosOrder {
  const items = order.items.flatMap((i) => {
    if (i.id !== itemId || i.status !== "new") return [i]
    return quantity > 0 ? [{ ...i, quantity: Math.round(quantity) }] : []
  })
  return { ...order, items, updatedAt: now.toISOString() }
}

/** Manda a cocina todo lo anotado. */
export function sendToKitchen(order: PosOrder, now = new Date()): PosOrder {
  const at = now.toISOString()
  return { ...order, items: order.items.map((i) => (i.status === "new" ? { ...i, status: "sent", sentAt: at } : i)), updatedAt: at }
}

export function pendingCount(order: Pick<PosOrder, "items">): number {
  return order.items.filter((i) => i.status === "new").length
}

/** Cocina marca un plato listo (o lo vuelve a «en cocina»). */
export function setItemStatus(order: PosOrder, itemId: string, status: "sent" | "ready" | "served", now = new Date()): PosOrder {
  const at = now.toISOString()
  return {
    ...order,
    items: order.items.map((i) => (i.id === itemId ? { ...i, status, readyAt: status === "sent" ? null : i.readyAt ?? at } : i)),
    updatedAt: at,
  }
}

/** Lo que cocina tiene que preparar: pedidos con platos en cocina, el más antiguo primero. */
export function kitchenQueue(orders: PosOrder[]): { order: PosOrder; items: PosOrderItem[]; since: string }[] {
  return orders
    .map((order) => {
      const items = order.items.filter((i) => i.status === "sent" || i.status === "ready")
      const since = items.reduce((m, i) => (i.sentAt && (!m || i.sentAt < m) ? i.sentAt : m), "")
      return { order, items, since }
    })
    .filter((g) => g.items.some((i) => i.status === "sent"))
    .sort((a, b) => a.since.localeCompare(b.since))
}

/** Estado de una mesa para el color del plano. */
export type TableStatus = "free" | "busy" | "ready" | "bill"

export function tableStatus(order: PosOrder | undefined): TableStatus {
  if (!order || order.items.length === 0) return order ? "busy" : "free"
  if (order.status === "bill") return "bill"
  if (order.items.some((i) => i.status === "ready")) return "ready"
  return "busy"
}

/** Minutos desde una fecha ISO (para «hace 12 min» en cocina). */
export function minutesSince(iso: string | null, now = new Date()): number {
  if (!iso) return 0
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 60000))
}

// ============== EXTRAS Y CARTA ==============

/** Extras que se ofrecen para un plato según su clasificación. */
export function extrasFor(config: PosConfig, classification: string | null | undefined): PosExtra[] {
  return config.extras.filter((e) => e.classifications.length === 0 || (!!classification && e.classifications.includes(classification)))
}

export function emptyConfig(now = new Date()): PosConfig {
  return { extras: [], hidden: [], updatedAt: now.toISOString() }
}

// ============== COBRO ==============

/**
 * Una cuenta cobrada como cuenta del registro manual (mismo formato que docs/215). Se cobra
 * toda la cuenta o solo las sillas elegidas; lo que queda sigue en el pedido.
 */
export function buildPosSale(
  order: PosOrder,
  pay: PosPayment,
  recipes: { id: string; costPerServing?: number }[],
  isoDate: string,
  ticketId: string,
  now = new Date(),
): { ticket: SalesTicket; lines: SalesImportLine[]; remaining: PosOrderItem[] } {
  const charged = itemsForSeats(order.items, pay.seats)
  const remaining = pay.seats ? order.items.filter((i) => !charged.includes(i)) : []
  const hh = String(now.getHours()).padStart(2, "0")
  const mm = String(now.getMinutes()).padStart(2, "0")
  const seatsGuests = pay.seats ? pay.seats.filter((s) => s > 0).length || null : order.guests
  const draft: DraftTicket = {
    ...emptyTicket(ticketId, {
      channel: order.channel,
      table: order.tableLabel,
      guests: seatsGuests,
      time: `${hh}:${mm}`,
      waiter: order.waiter,
      payment: pay.payment,
      discount: pay.discount,
      tip: pay.tip,
      note: pay.seats ? pay.seats.map((s) => (s === 0 ? "mesa" : `silla ${s}`)).join(", ") : null,
    }),
    items: charged.map((i) => ({
      id: i.id,
      sourceType: i.sourceType,
      refId: i.refId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: itemUnitPrice(i),
      unitCost: itemUnitCost(i, recipes),
    })),
  }
  const byId = new Map(charged.map((i) => [i.id, i]))
  const lines = buildImportLines([draft], isoDate).map((l) => {
    const item = byId.get(l.id)
    return item && item.extras.length ? { ...l, modifiers: extrasAsModifiers(item.extras) } : l
  })
  const [saved] = ticketsToSave([draft])
  const ticket: SalesTicket = { ...saved, pos: true, kitchenMinutes: kitchenMinutes(charged) }
  return { ticket, lines, remaining }
}

/**
 * Suma la cuenta cobrada al registro manual del día (o crea uno). Conserva el cuadre de caja
 * y recalcula los totales.
 */
export function mergeSaleIntoDay(
  day: SalesImport | null,
  sale: { ticket: SalesTicket; lines: SalesImportLine[] },
  ctx: { id: string; businessId: string; isoDate: string; fileName: string; now?: Date },
): SalesImport {
  const lines = [...(day?.lines ?? []), ...sale.lines]
  const tickets = [...(day?.tickets ?? []), sale.ticket]
  return {
    ...(day ?? {}),
    id: day?.id ?? ctx.id,
    businessId: day?.businessId ?? ctx.businessId,
    fileName: day?.fileName ?? ctx.fileName,
    importedAt: day?.importedAt ?? (ctx.now ?? new Date()).toISOString(),
    periodStart: day?.periodStart ?? ctx.isoDate,
    periodEnd: day?.periodEnd ?? ctx.isoDate,
    totalRevenue: round2(lines.reduce((s, l) => s + l.revenue, 0)),
    totalTheoreticalCost: round2(lines.reduce((s, l) => s + l.theoreticalCost, 0)),
    lineCount: lines.length,
    unmatchedDishNames: day?.unmatchedDishNames ?? [],
    lines,
    tickets,
    source: "manual",
  }
}

/**
 * Resumen del servicio (docs/273): cuántas mesas hay libres, ocupadas, con platos listos y
 * pidiendo la cuenta, y cuánto suma lo que está abierto (mesas del área y para llevar).
 */
export function serviceSummary(
  tables: { id: string }[],
  ordersByTable: Map<string, PosOrder>,
  takeaways: PosOrder[] = [],
): Record<TableStatus, number> & { openTotal: number } {
  const out = { free: 0, busy: 0, ready: 0, bill: 0, openTotal: 0 }
  for (const table of tables) {
    const order = ordersByTable.get(table.id)
    out[tableStatus(order)] += 1
    if (order) out.openTotal += orderTotal(order)
  }
  for (const order of takeaways) out.openTotal += orderTotal(order)
  return out
}
