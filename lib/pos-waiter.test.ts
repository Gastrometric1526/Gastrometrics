import { describe, expect, it } from "vitest"
import {
  buildPosReceipt,
  canEditPosSettings,
  cashChange,
  isPosOnlyMember,
  newlyReady,
  posInvoice,
  quickCashAmounts,
  readyItemIds,
  tableTile,
  tipFromPercent,
} from "./pos-waiter"
import type { PosOrder, PosOrderItem } from "@/types/pos"

const item = (over: Partial<PosOrderItem>): PosOrderItem => ({
  id: "i1",
  sourceType: "recipe",
  refId: "r1",
  name: "Baleada",
  seat: 1,
  quantity: 1,
  unitPrice: 50,
  unitCost: 20,
  extras: [],
  note: null,
  status: "new",
  sentAt: null,
  readyAt: null,
  ...over,
})

const order = (items: PosOrderItem[], over: Partial<PosOrder> = {}): PosOrder => ({
  id: "o1",
  tableId: "t1",
  tableLabel: "Mesa 4",
  areaName: "Salón",
  channel: "dine_in",
  guests: 2,
  waiter: "Ana",
  openedAt: "2026-11-14T18:00:00.000Z",
  status: "open",
  items,
  updatedAt: "2026-11-14T18:00:00.000Z",
  ...over,
})

describe("quién usa el POS (docs/302)", () => {
  it("el invitado con solo el POS (y lo que lo acompaña) entra directo", () => {
    expect(isPosOnlyMember(["pos", "manual_sales", "access_v2"])).toBe(true)
    expect(isPosOnlyMember(["pos", "manual_sales", "cash_up", "sales_history"])).toBe(true)
    expect(isPosOnlyMember(["pos", "manual_sales", "recipes"])).toBe(false)
    expect(isPosOnlyMember(["manual_sales"])).toBe(false)
    expect(isPosOnlyMember(null)).toBe(false)
  })
  it("Ajustes: el dueño o quien administra el equipo", () => {
    expect(canEditPosSettings(null)).toBe(true)
    expect(canEditPosSettings(["pos", "team"])).toBe(true)
    expect(canEditPosSettings(["pos", "manual_sales"])).toBe(false)
  })
})

describe("cobro en efectivo", () => {
  it("vuelto solo si alcanza", () => {
    expect(cashChange(345, 500)).toBe(155)
    expect(cashChange(345, 345)).toBe(0)
    expect(cashChange(345, 300)).toBeNull()
    expect(cashChange(345, null)).toBeNull()
    expect(cashChange(10.6, 20)).toBe(9.4)
  })
  it("billetes rápidos: exacto y los siguientes redondos", () => {
    expect(quickCashAmounts(345)).toEqual([345, 350, 400, 500])
    expect(quickCashAmounts(100)).toEqual([100, 500])
    expect(quickCashAmounts(0)).toEqual([])
  })
  it("propina por porcentaje", () => {
    expect(tipFromPercent(345, 10)).toBe(34.5)
    expect(tipFromPercent(0, 10)).toBe(0)
  })
})

describe("mesas en tarjetas", () => {
  it("libre, y ocupada con total, minutos, listos y sin mandar", () => {
    expect(tableTile(undefined)).toEqual({ status: "free", total: 0, minutes: 0, ready: 0, pending: 0 })
    const o = order([item({ id: "a", quantity: 2 }), item({ id: "b", status: "ready" })])
    expect(tableTile(o, new Date("2026-11-14T18:25:30.000Z"))).toEqual({ status: "ready", total: 150, minutes: 25, ready: 1, pending: 2 })
  })
})

describe("aviso de platos listos", () => {
  it("solo los nuevos y de las mesas del mesero (o sin mesero)", () => {
    const mine = order([item({ id: "a", status: "ready" }), item({ id: "b", status: "ready" })])
    const other = order([item({ id: "c", status: "ready" })], { id: "o2", waiter: "Luis" })
    const free = order([item({ id: "d", status: "ready" })], { id: "o3", waiter: null })
    const before = new Set(["a"])
    const got = newlyReady(before, [mine, other, free], "ana")
    expect(got.map((g) => [g.order.id, g.items.map((i) => i.id)])).toEqual([
      ["o1", ["b"]],
      ["o3", ["d"]],
    ])
    expect(newlyReady(readyItemIds([mine, other, free]), [mine, other, free], null)).toEqual([])
  })
})

describe("recibo y factura", () => {
  const o = order([
    item({ id: "a", quantity: 2, extras: [{ extraId: "e", name: "Aguacate", price: 15, recipeId: null, quantity: 1 }] }),
    item({ id: "b", seat: 2, name: "Café", unitPrice: 30 }),
  ])
  it("pre-cuenta: todo lo de la mesa, sin pago", () => {
    const r = buildPosReceipt(o, null)
    expect(r.paid).toBe(false)
    expect(r.subtotal).toBe(160)
    expect(r.total).toBe(160)
    expect(r.lines[0]).toMatchObject({ quantity: 2, name: "Baleada", extras: ["Aguacate"], amount: 130 })
  })
  it("recibo pagado de una silla, con descuento, propina y vuelto", () => {
    const r = buildPosReceipt(o, { seats: [1], payment: "cash", discount: 10, tip: 12, received: 200 })
    expect(r).toMatchObject({ paid: true, subtotal: 130, discount: 10, tip: 12, total: 132, received: 200, change: 68, seats: [1] })
    expect(r.lines).toHaveLength(1)
  })
  it("con tarjeta no hay vuelto", () => {
    const r = buildPosReceipt(o, { seats: null, payment: "card", discount: 0, tip: 0, received: 500 })
    expect(r.received).toBeNull()
    expect(r.change).toBeNull()
  })
  it("la factura lleva la cuenta del POS, el descuento y no suma impuesto", () => {
    const r = buildPosReceipt(o, { seats: null, payment: "card", discount: 10, tip: 16, received: null })
    let n = 0
    const inv = posInvoice(r, { id: "f1", number: "0007", businessId: "b1", posTicketId: "pos-o1-3", clientName: " Ana López ", clientTaxId: "", issueDate: "2026-11-14", newId: () => `l${++n}` })
    expect(inv).toMatchObject({ posTicketId: "pos-o1-3", clientName: "Ana López", clientTaxId: undefined, subtotal: 160, discount: 10, taxPercent: 0, taxAmount: 0, total: 150, status: "paid" })
    expect(inv.items[0]).toMatchObject({ description: "Baleada (+ Aguacate)", quantity: 2, unitPrice: 65, amount: 130 })
  })
})
