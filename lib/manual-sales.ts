/**
 * Registro manual de ventas por mesas (pedido del dueño, docs/215): «mejóralo para el
 * ingreso manual y hazlo más detallado por mesas».
 *
 * Parte pura (probada en manual-sales.test.ts):
 * - armar las líneas que se guardan a partir de las cuentas (el descuento de cada cuenta se
 *   reparte en proporción en el `revenue` de sus líneas, así Finanzas, Menu Engineering y el
 *   historial siguen leyendo lo mismo);
 * - volver a abrir un registro guardado como cuentas (los anteriores a docs/215 quedan como
 *   una sola cuenta sin mesa);
 * - el detalle por mesa, canal, mesero, forma de pago y hora;
 * - los platos más vendidos para cargarlos de un toque.
 */

import { toIsoDate } from "@/lib/date-format"
import type { PaymentMethod, SalesChannel, SalesImport, SalesImportLine, SalesTicket } from "@/types/sales-import"

export const SALES_CHANNELS: SalesChannel[] = ["dine_in", "takeaway", "delivery", "bar"]
export const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "transfer", "other"]

/** Un plato o menú dentro de una cuenta, mientras se edita. */
export interface DraftItem {
  id: string
  sourceType: "recipe" | "menu"
  refId: string
  name: string
  quantity: number
  unitPrice: number
  unitCost: number
}

export interface DraftTicket extends SalesTicket {
  items: DraftItem[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function emptyTicket(id: string, overrides: Partial<SalesTicket> = {}): DraftTicket {
  return { id, channel: "dine_in", table: null, guests: null, time: null, waiter: null, payment: null, discount: 0, tip: 0, note: null, items: [], ...overrides }
}

export function ticketSubtotal(ticket: Pick<DraftTicket, "items">): number {
  return round2(ticket.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0))
}

/** El descuento nunca pasa del subtotal ni es negativo. */
export function ticketDiscount(ticket: DraftTicket): number {
  return Math.min(Math.max(ticket.discount || 0, 0), ticketSubtotal(ticket))
}

export function ticketTotal(ticket: DraftTicket): number {
  return round2(ticketSubtotal(ticket) - ticketDiscount(ticket))
}

/** Agrega un plato a la cuenta; si ya estaba con el mismo precio, suma la cantidad. */
export function addItem(ticket: DraftTicket, item: DraftItem): DraftTicket {
  const same = ticket.items.find((i) => i.sourceType === item.sourceType && i.refId === item.refId && i.unitPrice === item.unitPrice)
  if (same) return { ...ticket, items: ticket.items.map((i) => (i === same ? { ...i, quantity: i.quantity + item.quantity } : i)) }
  return { ...ticket, items: [...ticket.items, item] }
}

/**
 * Líneas a guardar. Cada línea lleva su `ticketId`; el descuento de la cuenta se resta del
 * `revenue` en proporción a cada línea (el resto del redondeo va a la última).
 */
export function buildImportLines(tickets: DraftTicket[], isoDate: string): SalesImportLine[] {
  const out: SalesImportLine[] = []
  for (const ticket of tickets) {
    const subtotal = ticketSubtotal(ticket)
    const discount = ticketDiscount(ticket)
    let given = 0
    ticket.items.forEach((item, index) => {
      const gross = round2(item.quantity * item.unitPrice)
      const isLast = index === ticket.items.length - 1
      const share = subtotal > 0 ? (isLast ? round2(discount - given) : round2((gross / subtotal) * discount)) : 0
      given = round2(given + share)
      out.push({
        id: item.id,
        rawDishName: item.name,
        recipeId: item.sourceType === "recipe" ? item.refId : null,
        menuId: item.sourceType === "menu" ? item.refId : null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        revenue: round2(gross - share),
        theoreticalCost: item.quantity * item.unitCost,
        date: isoDate,
        ticketId: ticket.id,
      })
    })
  }
  return out
}

/** Las cuentas sin platos no se guardan. */
export function ticketsToSave(tickets: DraftTicket[]): SalesTicket[] {
  return tickets
    .filter((t) => t.items.length > 0)
    .map(({ items: _items, ...t }) => ({ ...t, discount: ticketDiscount({ ...t, items: _items }), tip: Math.max(t.tip || 0, 0) }))
}

/** Un registro guardado, como cuentas para editarlo. Sin cuentas (anterior a docs/215) = una sola cuenta. */
export function draftTicketsFromImport(imp: SalesImport, newId: () => string): DraftTicket[] {
  const toItem = (l: SalesImportLine): DraftItem => {
    const sourceType: "recipe" | "menu" = l.menuId ? "menu" : "recipe"
    return {
      id: l.id,
      sourceType,
      refId: (sourceType === "menu" ? l.menuId : l.recipeId) || "",
      name: l.rawDishName,
      quantity: l.quantity,
      unitPrice: l.unitPrice ?? (l.quantity > 0 ? l.revenue / l.quantity : 0),
      unitCost: l.quantity > 0 ? l.theoreticalCost / l.quantity : 0,
    }
  }
  const tickets = imp.tickets ?? []
  if (tickets.length === 0) return [{ ...emptyTicket(newId()), items: imp.lines.map(toItem) }]
  const known = new Set(tickets.map((t) => t.id))
  const drafts: DraftTicket[] = tickets.map((t) => ({ ...emptyTicket(t.id), ...t, items: imp.lines.filter((l) => l.ticketId === t.id).map(toItem) }))
  const orphans = imp.lines.filter((l) => !l.ticketId || !known.has(l.ticketId))
  if (orphans.length) drafts.push({ ...emptyTicket(newId()), items: orphans.map(toItem) })
  return drafts
}

/** «1 cuenta» / «3 cuentas». */
export function ticketsCount(n: number, t: (key: string) => string): string {
  return n === 1 ? t("ventas_summary_ticket_one") : t("ventas_summary_tickets").replace("{n}", String(n))
}

/** Nombre corto de una cuenta: «Mesa 5», o el canal si no tiene mesa. */
export function ticketLabel(ticket: Pick<SalesTicket, "table" | "channel">, t: (key: string) => string): string {
  if (ticket.table) return t("ventas_ticket_table_label").replace("{table}", ticket.table)
  return t(`ventas_channel_${ticket.channel}`)
}

// ─── Detalle por mesas ────────────────────────────────────────────────────────

export interface GroupRow {
  key: string
  tickets: number
  guests: number
  revenue: number
  /** Venta promedio por cuenta. */
  avgTicket: number
  share: number
}

export interface TicketInsights {
  tickets: number
  /** Cuentas con comensales anotados (para el gasto por persona). */
  guests: number
  revenue: number
  avgTicket: number
  /** Venta ÷ comensales, solo de las cuentas que los anotaron. */
  perGuest: number | null
  tips: number
  discounts: number
  byTable: GroupRow[]
  byChannel: GroupRow[]
  byWaiter: GroupRow[]
  byPayment: GroupRow[]
  /** Hora del día (0–23) → cuentas y venta. */
  byHour: GroupRow[]
}

/** Detalle de las cuentas de los registros manuales con mesas (los anteriores no tienen cuentas). */
export function summarizeTickets(imports: SalesImport[], opts: { from?: string; to?: string } = {}): TicketInsights {
  type Acc = { tickets: number; guests: number; revenue: number }
  const groups = { table: new Map<string, Acc>(), channel: new Map<string, Acc>(), waiter: new Map<string, Acc>(), payment: new Map<string, Acc>(), hour: new Map<string, Acc>() }
  let tickets = 0
  let revenue = 0
  let tips = 0
  let discounts = 0
  let guestRevenue = 0
  let guests = 0
  const add = (map: Map<string, Acc>, key: string | null, rev: number, g: number) => {
    if (!key) return
    const acc = map.get(key) ?? { tickets: 0, guests: 0, revenue: 0 }
    acc.tickets += 1
    acc.guests += g
    acc.revenue += rev
    map.set(key, acc)
  }
  for (const imp of imports) {
    if (imp.source !== "manual" || !imp.tickets?.length) continue
    // Día local (periodStart es la medianoche local en UTC; cortar el texto falla al este de UTC).
    const day = toIsoDate(new Date(imp.periodStart || imp.importedAt))
    if (opts.from && day < opts.from) continue
    if (opts.to && day > opts.to) continue
    for (const tk of imp.tickets) {
      const lines = imp.lines.filter((l) => l.ticketId === tk.id)
      if (lines.length === 0) continue
      const rev = round2(lines.reduce((s, l) => s + l.revenue, 0))
      const g = tk.guests && tk.guests > 0 ? tk.guests : 0
      tickets += 1
      revenue += rev
      tips += tk.tip || 0
      discounts += tk.discount || 0
      if (g) {
        guestRevenue += rev
        guests += g
      }
      add(groups.table, tk.table, rev, g)
      add(groups.channel, tk.channel, rev, g)
      add(groups.waiter, tk.waiter, rev, g)
      add(groups.payment, tk.payment, rev, g)
      add(groups.hour, tk.time && /^\d{1,2}:/.test(tk.time) ? String(Number(tk.time.split(":")[0])) : null, rev, g)
    }
  }
  const rows = (map: Map<string, Acc>, sort: "revenue" | "hour" | "table" = "revenue"): GroupRow[] =>
    [...map.entries()]
      .map(([key, a]) => ({ key, tickets: a.tickets, guests: a.guests, revenue: round2(a.revenue), avgTicket: a.tickets ? round2(a.revenue / a.tickets) : 0, share: revenue > 0 ? round2((a.revenue / revenue) * 100) : 0 }))
      .sort((a, b) =>
        sort === "hour"
          ? Number(a.key) - Number(b.key)
          : sort === "table"
            ? b.revenue - a.revenue || a.key.localeCompare(b.key, undefined, { numeric: true })
            : b.revenue - a.revenue,
      )
  return {
    tickets,
    guests,
    revenue: round2(revenue),
    avgTicket: tickets ? round2(revenue / tickets) : 0,
    perGuest: guests ? round2(guestRevenue / guests) : null,
    tips: round2(tips),
    discounts: round2(discounts),
    byTable: rows(groups.table, "table"),
    byChannel: rows(groups.channel),
    byWaiter: rows(groups.waiter),
    byPayment: rows(groups.payment),
    byHour: rows(groups.hour, "hour"),
  }
}

/** Mesas y meseros ya usados (para sugerirlos), las mesas en orden natural: 1, 2, 10, Terraza. */
export function knownTablesAndWaiters(imports: SalesImport[]): { tables: string[]; waiters: string[] } {
  const tables = new Set<string>()
  const waiters = new Set<string>()
  for (const imp of imports) for (const tk of imp.tickets ?? []) {
    if (tk.table) tables.add(tk.table)
    if (tk.waiter) waiters.add(tk.waiter)
  }
  const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  return { tables: [...tables].sort(natural), waiters: [...waiters].sort(natural) }
}

/** Lo más vendido en los registros manuales, para cargarlo de un toque. */
export function topSoldRefs(imports: SalesImport[], limit = 8): { sourceType: "recipe" | "menu"; refId: string; quantity: number }[] {
  const totals = new Map<string, { sourceType: "recipe" | "menu"; refId: string; quantity: number }>()
  for (const imp of imports) {
    if (imp.source !== "manual") continue
    for (const l of imp.lines) {
      const sourceType = l.menuId ? "menu" : "recipe"
      const refId = l.menuId || l.recipeId
      if (!refId) continue
      const key = `${sourceType}:${refId}`
      const acc = totals.get(key) ?? { sourceType, refId, quantity: 0 }
      acc.quantity += l.quantity
      totals.set(key, acc)
    }
  }
  return [...totals.values()].sort((a, b) => b.quantity - a.quantity).slice(0, limit)
}

/** Búsqueda sin acentos ni mayúsculas. */
export function normalizeSearch(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}
