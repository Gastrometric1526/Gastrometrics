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
import type { FloorPlan, FloorTable, PosConfig, PosExtra, PosOrder, PosOrderExtra, PosOrderItem, PosPayment, PosVoid, PosVoidReason, TableShape } from "@/types/pos"
import type { SalesImport, SalesImportLine, SalesTicket, SalesTicketVoid } from "@/types/sales-import"

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
  // Un extra sin nombre (recién agregado en Ajustes) no se ofrece todavía (docs/278).
  return config.extras.filter((e) => e.name.trim() && (e.classifications.length === 0 || (!!classification && e.classifications.includes(classification))))
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
  // Las anulaciones del pedido (docs/275) van con el primer cobro; el resto del pedido sigue sin ellas.
  const voids = (order.voids ?? []).map(ticketVoid)
  const ticket: SalesTicket = { ...saved, pos: true, kitchenMinutes: kitchenMinutes(charged), ...(voids.length ? { voids } : {}) }
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
  // Idempotente (docs/275): si la cuenta ya está en el día (cobro repetido tras un error), no se suma otra vez.
  if (day && dayHasTicket(day, sale.ticket.id)) return day
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


// ─── Confiabilidad del POS (docs/275) ───────────────────────────────────────────

/** ¿La cuenta ya está en el registro del día? */
export function dayHasTicket(day: Pick<SalesImport, "tickets">, ticketId: string): boolean {
  return (day.tickets ?? []).some((t) => t.id === ticketId)
}

/**
 * Id de la cuenta de un cobro: fijo para la misma versión del pedido. Si el cobro se repite
 * (se cayó la conexión justo después de guardar la venta), el registro del día ya la tiene y
 * no se suma dos veces (`mergeSaleIntoDay`).
 */
export function posTicketId(order: Pick<PosOrder, "id" | "rev">): string {
  return `pos-${order.id}-${order.rev ?? 0}`
}

function ticketVoid(v: PosVoid): SalesTicketVoid {
  const made = v.reason !== "not_made"
  return {
    name: v.name,
    quantity: v.quantity,
    reason: v.reason,
    cost: made ? Math.round(v.unitCost * v.quantity * 100) / 100 : 0,
    value: Math.round(v.unitPrice * v.quantity * 100) / 100,
    recipeId: v.sourceType === "recipe" ? v.refId : null,
    menuId: v.sourceType === "menu" ? v.refId : null,
    extras: v.extras.filter((e) => e.recipeId).map((e) => ({ recipeId: e.recipeId, quantity: e.quantity })),
  }
}

/**
 * Anula un plato ya mandado a cocina (o listo, o servido) con su motivo. Sale de la cuenta y
 * queda en `voids`, que llega a Reportes al cobrar. Lo nuevo (sin mandar) se quita con «−».
 */
export function voidItem(
  order: PosOrder,
  itemId: string,
  reason: PosVoidReason,
  recipes: { id: string; costPerServing?: number }[],
  newId: () => string,
  now = new Date(),
): PosOrder {
  const item = order.items.find((i) => i.id === itemId)
  if (!item || item.status === "new") return order
  const at = now.toISOString()
  const entry: PosVoid = {
    id: newId(),
    itemId: item.id,
    sourceType: item.sourceType,
    refId: item.refId,
    name: item.name,
    seat: item.seat,
    quantity: item.quantity,
    unitPrice: itemUnitPrice(item),
    unitCost: itemUnitCost(item, recipes),
    extras: item.extras,
    reason,
    at,
  }
  return { ...order, items: order.items.filter((i) => i.id !== itemId), voids: [...(order.voids ?? []), entry], updatedAt: at }
}

const sameItem = (a: PosOrderItem, b: PosOrderItem) =>
  a.quantity === b.quantity && a.status === b.status && a.seat === b.seat && (a.note || "") === (b.note || "") && extrasKey(a.extras) === extrasKey(b.extras)

/**
 * Junta mi cambio con el de otro aparato (docs/275). `base` es el pedido como estaba cuando
 * empecé a cambiarlo, `mine` mi versión y `theirs` la que ya está guardada. Sobre la de ellos:
 * - agrego los platos que agregué yo;
 * - quito los que quité yo (solo si siguen sin mandar a cocina);
 * - en los platos que cambié aplico mi cambio (la cantidad, como diferencia; el estado, el mío);
 * - las anulaciones se suman sin repetir;
 * - comensales, mesero y «pidió la cuenta», si los cambié yo.
 * Nunca se pierde un plato que el otro aparato agregó.
 */
export function mergeOrderEdit(base: PosOrder | null, mine: PosOrder, theirs: PosOrder): PosOrder {
  const baseItems = new Map((base?.items ?? []).map((i) => [i.id, i]))
  const mineItems = new Map(mine.items.map((i) => [i.id, i]))
  let items = theirs.items
    .filter((i) => {
      const removedByMe = baseItems.has(i.id) && !mineItems.has(i.id)
      return !(removedByMe && i.status === "new")
    })
    .filter((i) => !(mine.voids ?? []).some((v) => v.itemId === i.id))
    .map((i) => {
      const m = mineItems.get(i.id)
      const b = baseItems.get(i.id)
      if (!m || !b || sameItem(m, b)) return i
      const quantity = Math.max(1, i.quantity + (m.quantity - b.quantity))
      const statusChanged = m.status !== b.status
      return {
        ...i,
        quantity,
        seat: m.seat !== b.seat ? m.seat : i.seat,
        note: (m.note || "") !== (b.note || "") ? m.note : i.note,
        extras: extrasKey(m.extras) !== extrasKey(b.extras) ? m.extras : i.extras,
        status: statusChanged ? m.status : i.status,
        sentAt: statusChanged ? m.sentAt : i.sentAt,
        readyAt: statusChanged ? m.readyAt : i.readyAt,
      }
    })
  const added = mine.items.filter((i) => !baseItems.has(i.id) && !items.some((x) => x.id === i.id))
  items = [...items, ...added]
  const voids = [...(theirs.voids ?? [])]
  for (const v of mine.voids ?? []) if (!voids.some((x) => x.id === v.id)) voids.push(v)
  const pick = <K extends "guests" | "waiter" | "status">(k: K) => (base && mine[k] !== base[k] ? mine[k] : theirs[k])
  return {
    ...theirs,
    items,
    voids,
    guests: pick("guests"),
    waiter: pick("waiter"),
    status: pick("status"),
    updatedAt: mine.updatedAt > theirs.updatedAt ? mine.updatedAt : theirs.updatedAt,
  }
}
