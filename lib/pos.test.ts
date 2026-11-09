import { describe, expect, it } from "vitest"
import {
  addOrderItem,
  buildPosSale,
  defaultFloorPlan,
  extrasFor,
  FLOOR_H,
  FLOOR_W,
  itemUnitCost,
  itemUnitPrice,
  kitchenQueue,
  mergeSaleIntoDay,
  nextTableLabel,
  orderTotal,
  pendingCount,
  seatPositions,
  seatsInOrder,
  sendToKitchen,
  setItemQuantity,
  setItemStatus,
  snapTable,
  tableStatus,
} from "@/lib/pos"
import type { PosConfig, PosOrder, PosOrderItem } from "@/types/pos"
import type { SalesImport } from "@/types/sales-import"
import { summarizeTickets } from "@/lib/manual-sales"

let n = 0
const id = () => `id${++n}`
const NOW = new Date("2026-11-10T19:30:00")

const item = (over: Partial<PosOrderItem> = {}): PosOrderItem => ({
  id: id(),
  sourceType: "recipe",
  refId: "burger",
  name: "Hamburguesa",
  seat: 1,
  quantity: 1,
  unitPrice: 200,
  unitCost: 70,
  extras: [],
  note: null,
  status: "new",
  sentAt: null,
  readyAt: null,
  ...over,
})

const order = (items: PosOrderItem[] = []): PosOrder => ({
  id: "o1",
  tableId: "t1",
  tableLabel: "5",
  areaName: "Salón",
  channel: "dine_in",
  guests: 2,
  waiter: "Ana",
  openedAt: NOW.toISOString(),
  status: "open",
  items,
  updatedAt: NOW.toISOString(),
})

const queso = { extraId: "e1", name: "Extra queso", price: 20, recipeId: "queso", quantity: 1 }
const recipes = [
  { id: "burger", costPerServing: 70 },
  { id: "queso", costPerServing: 8 },
]

describe("plano del salón", () => {
  it("el plano de inicio trae 6 mesas dentro del lienzo", () => {
    const plan = defaultFloorPlan("Salón", id, NOW)
    expect(plan.areas).toHaveLength(1)
    expect(plan.tables).toHaveLength(6)
    for (const t of plan.tables) {
      expect(t.x + t.w).toBeLessThanOrEqual(FLOOR_W)
      expect(t.y + t.h).toBeLessThanOrEqual(FLOOR_H)
    }
    expect(nextTableLabel(plan)).toBe("7")
  })

  it("ajusta la mesa a la cuadrícula y no la deja salir del lienzo", () => {
    const t = snapTable({ id: "t", areaId: "a", label: "1", shape: "square", seats: 0, x: 995, y: -30, w: 113, h: 97 })
    expect(t.x % 20).toBe(0)
    expect(t.x + t.w).toBeLessThanOrEqual(FLOOR_W)
    expect(t.y).toBe(0)
    expect(t.seats).toBe(1)
  })

  it("dibuja una silla por cada lugar", () => {
    const round = seatPositions({ id: "t", areaId: "a", label: "1", shape: "round", seats: 6, x: 100, y: 100, w: 120, h: 120 })
    expect(round.map((s) => s.seat)).toEqual([1, 2, 3, 4, 5, 6])
    const rect = seatPositions({ id: "t", areaId: "a", label: "1", shape: "rect", seats: 5, x: 100, y: 100, w: 200, h: 100 })
    expect(rect).toHaveLength(5)
    expect(new Set(rect.map((s) => s.seat)).size).toBe(5)
  })
})

describe("pedido", () => {
  it("el precio de los extras suma a la venta y su receta al costo", () => {
    const i = item({ extras: [{ ...queso, quantity: 2 }] })
    expect(itemUnitPrice(i)).toBe(240)
    expect(itemUnitCost(i, recipes)).toBe(86)
  })

  it("junta platos iguales sin mandar y separa los distintos", () => {
    let o = addOrderItem(order(), item(), NOW)
    o = addOrderItem(o, item(), NOW)
    expect(o.items).toHaveLength(1)
    expect(o.items[0].quantity).toBe(2)
    o = addOrderItem(o, item({ extras: [queso] }), NOW)
    o = addOrderItem(o, item({ seat: 2 }), NOW)
    o = addOrderItem(o, item({ note: "sin cebolla" }), NOW)
    expect(o.items).toHaveLength(4)
    expect(seatsInOrder(o)).toEqual([1, 2])
  })

  it("lo mandado a cocina ya no se junta ni se edita", () => {
    let o = sendToKitchen(addOrderItem(order(), item(), NOW), NOW)
    expect(pendingCount(o)).toBe(0)
    expect(o.items[0].sentAt).toBe(NOW.toISOString())
    o = addOrderItem(o, item(), NOW)
    expect(o.items).toHaveLength(2)
    const sentId = o.items[0].id
    expect(setItemQuantity(o, sentId, 0, NOW).items).toHaveLength(2)
    expect(setItemQuantity(o, o.items[1].id, 0, NOW).items).toHaveLength(1)
  })

  it("cocina ve solo pedidos con platos por preparar, el más antiguo primero", () => {
    const a = sendToKitchen({ ...order([item()]), id: "a" }, new Date("2026-11-10T19:00:00"))
    const b = sendToKitchen({ ...order([item()]), id: "b" }, new Date("2026-11-10T18:50:00"))
    const c = { ...order([item()]), id: "c" }
    expect(kitchenQueue([a, b, c]).map((g) => g.order.id)).toEqual(["b", "a"])
    const doneA = setItemStatus(a, a.items[0].id, "ready", NOW)
    expect(kitchenQueue([doneA]).length).toBe(0)
    expect(tableStatus(doneA)).toBe("ready")
  })

  it("estado de la mesa", () => {
    expect(tableStatus(undefined)).toBe("free")
    expect(tableStatus(order([item()]))).toBe("busy")
    expect(tableStatus({ ...order([item()]), status: "bill" })).toBe("bill")
  })

  it("extras según la clasificación del plato", () => {
    const config: PosConfig = {
      extras: [
        { id: "e1", name: "Extra queso", price: 20, recipeId: null, classifications: [] },
        { id: "e2", name: "Shot de espresso", price: 25, recipeId: null, classifications: ["Bebidas"] },
      ],
      hidden: [],
      updatedAt: "",
    }
    expect(extrasFor(config, "Parrilla").map((e) => e.id)).toEqual(["e1"])
    expect(extrasFor(config, "Bebidas").map((e) => e.id)).toEqual(["e1", "e2"])
  })
})

describe("cobro", () => {
  const o = order([item({ id: "a", extras: [queso] }), item({ id: "b", seat: 2, quantity: 2 }), item({ id: "c", seat: null, refId: "nachos", name: "Nachos", unitPrice: 150, unitCost: 40 })])

  it("toda la cuenta: total, líneas con modificadores y propina aparte", () => {
    expect(orderTotal(o)).toBe(220 + 400 + 150)
    const sale = buildPosSale(o, { seats: null, payment: "card", discount: 0, tip: 50 }, recipes, "2026-11-10T06:00:00.000Z", "t1", NOW)
    expect(sale.lines.reduce((s, l) => s + l.revenue, 0)).toBe(770)
    expect(sale.lines.find((l) => l.id === "a")?.modifiers).toEqual([{ name: "Extra queso", recipeId: "queso", quantity: 1, price: 20 }])
    expect(sale.lines.find((l) => l.id === "a")?.theoreticalCost).toBe(78)
    expect(sale.ticket).toMatchObject({ table: "5", payment: "card", tip: 50, time: "19:30", waiter: "Ana" })
    expect(sale.remaining).toEqual([])
  })

  it("cuenta dividida: cobra solo las sillas elegidas y deja el resto", () => {
    const sale = buildPosSale(o, { seats: [2], payment: "cash", discount: 40, tip: 0 }, recipes, "2026-11-10T06:00:00.000Z", "t2", NOW)
    expect(sale.lines.map((l) => l.id)).toEqual(["b"])
    expect(sale.lines[0].revenue).toBe(360)
    expect(sale.ticket.guests).toBe(1)
    expect(sale.remaining.map((i) => i.id)).toEqual(["a", "c"])
    expect(orderTotal(o, [0])).toBe(150)
  })

  it("Reportes recibe los extras vendidos y el tiempo de cocina", () => {
    const sent = { ...o, items: o.items.map((i) => ({ ...i, status: "ready" as const, sentAt: "2026-11-10T19:00:00.000Z", readyAt: "2026-11-10T19:12:00.000Z" })) }
    const sale = buildPosSale(sent, { seats: null, payment: "cash", discount: 0, tip: 0 }, recipes, "2026-11-10T06:00:00.000Z", "tk", NOW)
    expect(sale.ticket).toMatchObject({ pos: true, kitchenMinutes: 12 })
    const day = mergeSaleIntoDay(null, sale, { id: "d", businessId: "main", isoDate: "2026-11-10T06:00:00.000Z", fileName: "R", now: NOW })
    const ins = summarizeTickets([day])
    expect(ins.kitchenAvgMinutes).toBe(12)
    expect(ins.extras).toEqual([{ name: "Extra queso", units: 1, revenue: 20 }])
    expect(ins.byWaiter[0]).toMatchObject({ key: "Ana", revenue: 770 })
  })

  it("se suma al registro manual del día y conserva el cuadre de caja", () => {
    const sale = buildPosSale(o, { seats: null, payment: "cash", discount: 0, tip: 0 }, recipes, "2026-11-10T06:00:00.000Z", "t3", NOW)
    const created = mergeSaleIntoDay(null, sale, { id: "day", businessId: "main", isoDate: "2026-11-10T06:00:00.000Z", fileName: "Registro", now: NOW })
    expect(created).toMatchObject({ id: "day", source: "manual", totalRevenue: 770, lineCount: 3 })
    expect(created.tickets).toHaveLength(1)
    const existing = { ...created, cashUp: { openingFloat: 500 } } as unknown as SalesImport
    const again = mergeSaleIntoDay(existing, sale, { id: "x", businessId: "main", isoDate: "2026-11-10T06:00:00.000Z", fileName: "Registro" })
    expect(again.id).toBe("day")
    expect(again.tickets).toHaveLength(2)
    expect(again.totalRevenue).toBe(1540)
    expect((again as unknown as { cashUp: { openingFloat: number } }).cashUp.openingFloat).toBe(500)
  })
})
