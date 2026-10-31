import { describe, expect, it } from "vitest"
import { computeCashUp, emptyCashUp, parseAmount, parseTerminalTotal, salesByPayment, summarizeCashUps } from "./cash-up"
import { buildImportLines, emptyTicket, ticketsToSave, type DraftItem } from "./manual-sales"
import type { CashUp, SalesImport } from "@/types/sales-import"

const item = (id: string, q: number, p: number): DraftItem => ({ id, sourceType: "recipe", refId: id, name: id, quantity: q, unitPrice: p, unitCost: 1 })

function day(date: string, tickets: ReturnType<typeof emptyTicket>[], cashUp?: CashUp): SalesImport {
  const iso = new Date(`${date}T00:00:00`).toISOString()
  return {
    id: date, businessId: "b", fileName: "", importedAt: iso, periodStart: iso, periodEnd: iso, totalRevenue: 0, totalTheoreticalCost: 0,
    lineCount: 0, unmatchedDishNames: [], source: "manual", lines: buildImportLines(tickets, iso), tickets: ticketsToSave(tickets), cashUp,
  }
}

// Efectivo: 500 + 300 (con 50 de descuento → 250) y propina 20. Tarjeta: 1000 con propina 100.
// Transferencia: 200. Una cuenta sin forma de pago: 80.
const tickets = [
  { ...emptyTicket("a", { payment: "cash", tip: 20 }), items: [item("a1", 1, 500)] },
  { ...emptyTicket("b", { payment: "cash", discount: 50 }), items: [item("b1", 1, 300)] },
  { ...emptyTicket("c", { payment: "card", tip: 100 }), items: [item("c1", 2, 500)] },
  { ...emptyTicket("d", { payment: "transfer" }), items: [item("d1", 1, 200)] },
  { ...emptyTicket("e"), items: [item("e1", 1, 80)] },
] as ReturnType<typeof emptyTicket>[]

describe("cuadre de caja (docs/217)", () => {
  it("suma ventas y propinas por forma de pago", () => {
    const by = salesByPayment(day("2026-10-30", tickets))
    expect(by.cash).toEqual({ tickets: 2, sales: 750, tips: 20 })
    expect(by.card).toEqual({ tickets: 1, sales: 1000, tips: 100 })
    expect(by.transfer.sales).toBe(200)
    expect(by.none).toEqual({ tickets: 1, sales: 80, tips: 0 })
  })

  it("cuadra efectivo (fondo + ventas + propinas − salidas), datáfono y transferencias", () => {
    const cu: CashUp = { ...emptyCashUp("x"), openingFloat: 1000, payouts: [{ id: "p", concept: "Hielo", amount: 70 }], countedCash: 1700, terminalTotal: 1100, transferTotal: 200 }
    const r = computeCashUp(day("2026-10-30", tickets), cu)
    expect(r.rows.map((x) => [x.method, x.expected, x.difference])).toEqual([
      ["cash", 1700, 0],
      ["card", 1100, 0],
      ["transfer", 200, 0],
    ])
    expect(r.status).toBe("balanced")
    expect(r.unassigned).toEqual({ tickets: 1, amount: 80 })
  })

  it("faltante, sobrante y forma de pago equivocada", () => {
    const base: CashUp = { ...emptyCashUp("x"), openingFloat: 1000, payouts: [{ id: "p", concept: "Hielo", amount: 70 }], terminalTotal: 1100, transferTotal: 200 }
    const imp = day("2026-10-30", tickets)
    expect(computeCashUp(imp, { ...base, countedCash: 1650 })).toMatchObject({ status: "short", totalDifference: -50 })
    expect(computeCashUp(imp, { ...base, countedCash: 1720 })).toMatchObject({ status: "over", totalDifference: 20 })
    expect(computeCashUp(imp, { ...base, countedCash: 1600, terminalTotal: 1200 }).status).toBe("mixed")
  })

  it("propinas fuera de la caja o fuera del datáfono", () => {
    const cu: CashUp = { ...emptyCashUp("x"), cashTipsInDrawer: false, cardTipsInTerminal: false, countedCash: 750, terminalTotal: 1000, transferTotal: 200 }
    const r = computeCashUp(day("2026-10-30", tickets), cu)
    expect(r.rows[0].expected).toBe(750)
    expect(r.rows[1].expected).toBe(1000)
    expect(r.status).toBe("balanced")
  })

  it("sin anotar lo que debería existir queda incompleto", () => {
    const r = computeCashUp(day("2026-10-30", tickets), { ...emptyCashUp("x"), countedCash: 770 })
    expect(r.status).toBe("incomplete")
    expect(r.rows[1].difference).toBeNull()
  })

  it("lee montos en distintos formatos", () => {
    expect(parseAmount("L 1,234.50")).toBe(1234.5)
    expect(parseAmount("1.234,50 kr")).toBe(1234.5)
    expect(parseAmount("$12")).toBe(12)
    expect(parseAmount("1,234")).toBe(1234)
  })

  it("lee el total de un cierre de lote, sin anulaciones ni cantidades", () => {
    const voucher = ["BAC CREDOMATIC", "CIERRE DE LOTE 000123", "VISA        8    3,450.00", "MASTERCARD  4    1,200.50", "ANULACIONES 1      300.00", "TOTAL VENTAS 12   4,650.50", "GRACIAS"].join("\n")
    expect(parseTerminalTotal(voucher)).toBe(4650.5)
    expect(parseTerminalTotal("Batch\nGrand total  1.299,00\nRefund 50,00")).toBe(1299)
    expect(parseTerminalTotal("合计 ¥ 880.00")).toBe(880)
    expect(parseTerminalTotal("sin montos")).toBeNull()
  })

  it("resume los cuadres: pendientes, faltantes y sobrantes", () => {
    const ok: CashUp = { ...emptyCashUp("x"), openingFloat: 1000, payouts: [{ id: "p", concept: "", amount: 70 }], countedCash: 1700, terminalTotal: 1100, transferTotal: 200 }
    const imports = [
      day("2026-10-28", tickets, ok),
      day("2026-10-29", tickets, { ...ok, countedCash: 1650 }),
      day("2026-10-30", tickets),
    ]
    const s = summarizeCashUps(imports)
    expect(s).toMatchObject({ daysWithSales: 3, closed: 2, balanced: 1, shortTotal: -50, overTotal: 0, pendingDays: ["2026-10-30"] })
    expect(s.withDifference.map((d) => d.day)).toEqual(["2026-10-29"])
    expect(summarizeCashUps(imports, { from: "2026-10-30" }).closed).toBe(0)
  })
})
