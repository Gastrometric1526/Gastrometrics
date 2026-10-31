import { describe, expect, it } from "vitest"
import {
  addItem,
  buildImportLines,
  draftTicketsFromImport,
  emptyTicket,
  knownTablesAndWaiters,
  summarizeTickets,
  ticketTotal,
  ticketsToSave,
  topSoldRefs,
  type DraftItem,
} from "./manual-sales"
import type { SalesImport } from "@/types/sales-import"

const item = (id: string, refId: string, quantity: number, unitPrice: number, unitCost = 10): DraftItem => ({
  id,
  sourceType: "recipe",
  refId,
  name: refId,
  quantity,
  unitPrice,
  unitCost,
})

describe("registro manual por mesas (docs/215)", () => {
  it("suma la cantidad si el mismo plato se agrega otra vez", () => {
    let t = emptyTicket("t1")
    t = addItem(t, item("a", "pollo", 1, 100))
    t = addItem(t, item("b", "pollo", 2, 100))
    t = addItem(t, item("c", "pollo", 1, 90))
    expect(t.items.map((i) => [i.refId, i.quantity, i.unitPrice])).toEqual([
      ["pollo", 3, 100],
      ["pollo", 1, 90],
    ])
  })

  it("reparte el descuento en proporción y la venta total queda exacta", () => {
    const t = { ...emptyTicket("t1", { table: "5", discount: 10 }), items: [item("a", "pollo", 1, 100), item("b", "jugo", 2, 25)] }
    expect(ticketTotal(t)).toBe(140)
    const lines = buildImportLines([t], "2026-10-30T06:00:00.000Z")
    expect(lines.map((l) => l.revenue)).toEqual([93.33, 46.67])
    expect(lines.reduce((s, l) => s + l.revenue, 0)).toBeCloseTo(140, 5)
    expect(lines.every((l) => l.ticketId === "t1")).toBe(true)
    expect(lines[1].theoreticalCost).toBe(20)
  })

  it("el descuento no pasa del subtotal; cuentas vacías no se guardan; la propina no es venta", () => {
    const full = { ...emptyTicket("t1", { discount: 999, tip: 15 }), items: [item("a", "pollo", 1, 100)] }
    const empty = emptyTicket("t2")
    expect(ticketTotal(full)).toBe(0)
    const saved = ticketsToSave([full, empty])
    expect(saved).toHaveLength(1)
    expect(saved[0].discount).toBe(100)
    expect(saved[0].tip).toBe(15)
    expect("items" in saved[0]).toBe(false)
  })

  it("un registro anterior (sin mesas) se abre como una sola cuenta", () => {
    const old: SalesImport = {
      id: "i1", businessId: "b", fileName: "x", importedAt: "2026-10-01T00:00:00Z", periodStart: "2026-10-01T00:00:00Z", periodEnd: null,
      totalRevenue: 200, totalTheoreticalCost: 20, lineCount: 1, unmatchedDishNames: [], source: "manual",
      lines: [{ id: "l1", rawDishName: "Pollo", recipeId: "pollo", quantity: 2, unitPrice: 100, revenue: 200, theoreticalCost: 20 }],
    }
    const drafts = draftTicketsFromImport(old, () => "nuevo")
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ id: "nuevo", table: null, channel: "dine_in" })
    expect(drafts[0].items[0]).toMatchObject({ refId: "pollo", quantity: 2, unitPrice: 100, unitCost: 10 })
  })

  it("ida y vuelta: guardar y volver a abrir conserva cuentas y platos", () => {
    const t1 = { ...emptyTicket("t1", { table: "5", guests: 3 }), items: [item("a", "pollo", 1, 100)] }
    const t2 = { ...emptyTicket("t2", { channel: "takeaway" as const }), items: [item("b", "jugo", 2, 25)] }
    const imp = { id: "i", businessId: "b", fileName: "", importedAt: "", periodStart: null, periodEnd: null, totalRevenue: 0, totalTheoreticalCost: 0, lineCount: 2, unmatchedDishNames: [], lines: buildImportLines([t1, t2], "x"), tickets: ticketsToSave([t1, t2]), source: "manual" as const }
    const back = draftTicketsFromImport(imp, () => "z")
    expect(back.map((t) => [t.id, t.table, t.channel, t.items.length])).toEqual([
      ["t1", "5", "dine_in", 1],
      ["t2", null, "takeaway", 1],
    ])
  })

  it("detalle por mesa, canal, mesero, pago y hora", () => {
    const day = (d: string, tickets: ReturnType<typeof emptyTicket>[]): SalesImport => ({
      id: d, businessId: "b", fileName: "", importedAt: d, periodStart: `${d}T06:00:00Z`, periodEnd: null, totalRevenue: 0, totalTheoreticalCost: 0,
      lineCount: 0, unmatchedDishNames: [], source: "manual", lines: buildImportLines(tickets, d), tickets: ticketsToSave(tickets),
    })
    const imports = [
      day("2026-10-29", [
        { ...emptyTicket("a", { table: "5", guests: 2, waiter: "Ana", payment: "cash", time: "13:15", tip: 10 }), items: [item("1", "pollo", 2, 100)] },
        { ...emptyTicket("b", { table: "10", guests: 4, waiter: "Luis", payment: "card", time: "20:05" }), items: [item("2", "pollo", 4, 100)] },
      ]),
      day("2026-10-30", [
        { ...emptyTicket("c", { table: "5", waiter: "Ana", payment: "card", time: "13:40", discount: 20 }), items: [item("3", "jugo", 4, 25)] },
        { ...emptyTicket("d", { channel: "takeaway" }), items: [item("4", "jugo", 2, 25)] },
      ]),
    ]
    const s = summarizeTickets(imports)
    expect(s.tickets).toBe(4)
    expect(s.revenue).toBe(730)
    expect(s.avgTicket).toBe(182.5)
    expect(s.guests).toBe(6)
    expect(s.perGuest).toBe(100)
    expect(s.tips).toBe(10)
    expect(s.discounts).toBe(20)
    expect(s.byTable.map((r) => [r.key, r.tickets, r.revenue])).toEqual([
      ["10", 1, 400],
      ["5", 2, 280],
    ])
    expect(s.byChannel.map((r) => r.key)).toEqual(["dine_in", "takeaway"])
    expect(s.byWaiter[0]).toMatchObject({ key: "Luis", revenue: 400 })
    expect(s.byPayment.find((r) => r.key === "card")?.revenue).toBe(480)
    expect(s.byHour.map((r) => [r.key, r.tickets])).toEqual([
      ["13", 2],
      ["20", 1],
    ])
    expect(summarizeTickets(imports, { from: "2026-10-30" }).tickets).toBe(2)
  })

  it("sugiere mesas en orden natural, meseros y lo más vendido", () => {
    const imp = {
      source: "manual",
      tickets: [emptyTicket("a", { table: "10", waiter: "Luis" }), emptyTicket("b", { table: "2", waiter: "Ana" }), emptyTicket("c", { table: "Terraza" })],
      lines: [
        { id: "1", rawDishName: "", recipeId: "pollo", quantity: 3, unitPrice: 1, revenue: 3, theoreticalCost: 0 },
        { id: "2", rawDishName: "", recipeId: null, menuId: "combo", quantity: 5, unitPrice: 1, revenue: 5, theoreticalCost: 0 },
      ],
    } as unknown as SalesImport
    expect(knownTablesAndWaiters([imp])).toEqual({ tables: ["2", "10", "Terraza"], waiters: ["Ana", "Luis"] })
    expect(topSoldRefs([imp])).toEqual([
      { sourceType: "menu", refId: "combo", quantity: 5 },
      { sourceType: "recipe", refId: "pollo", quantity: 3 },
    ])
  })
})

describe("día local de una venta (docs/215)", () => {
  it("una medianoche local guardada en UTC vuelve a su día, y una fecha sin hora queda igual", async () => {
    const { localDayOf, toIsoDate } = await import("@/lib/date-format")
    const midnight = new Date(2026, 9, 30) // 30/10/2026 00:00 local, en cualquier huso
    expect(localDayOf(midnight.toISOString())).toBe("2026-10-30")
    expect(localDayOf("2026-10-30")).toBe("2026-10-30")
    expect(toIsoDate(midnight)).toBe("2026-10-30")
  })
})
