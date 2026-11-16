import { describe, expect, it } from "vitest"
import { buildReturn, orderPurchaseValue, orderTaxRate, receiptLines, receiptSummary, returnValue, returnableQuantities, returnsInPeriod } from "./purchase-receipt"
import type { PurchaseOrder } from "@/types/purchase-order"

// Orden de ejemplo calculada a mano (docs/322):
// tomate 10 kg a 30 = 300 · pollo 5 kg a 80 = 400 · subtotal 700 · impuesto 15 % = 105 · total 805.
const order = (extra: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: "OC-1",
  name: "Mercado",
  number: 1,
  date: "2026-11-10",
  recipes: [],
  items: [
    { id: "a", name: "Tomate", totalQuantity: 10, unit: "kilogramos", costPerUnit: 30, purchaseCost: 300, quantityToBuy: 10, supplier: "X" },
    { id: "b", name: "Pollo", totalQuantity: 5, unit: "kilogramos", costPerUnit: 80, purchaseCost: 400, quantityToBuy: 5, supplier: "X" },
  ],
  subtotal: 700,
  tax: 105,
  total: 805,
  status: "received",
  ...extra,
})

describe("recepción con revisión (docs/322)", () => {
  it("sin revisión, lo recibido es lo pedido y cuenta el total", () => {
    const s = receiptSummary(order())
    expect(s.receivedTotal).toBe(805)
    expect(s.linesWithDifference).toBe(0)
  })

  it("faltaron 2 kg de tomate y el pollo vino a 85: efectos por cantidad y por precio", () => {
    const o = order({ receipt: { at: "2026-11-11T10:00:00Z", lines: [{ key: "a", quantity: 8, unitCost: 30 }, { key: "b", quantity: 5, unitCost: 85 }] } })
    const [tom, pol] = receiptLines(o)
    expect(tom.quantityDiff).toBe(-2)
    expect(tom.quantityEffect).toBe(-60) // −2 × 30
    expect(pol.priceDiff).toBe(5)
    expect(pol.priceEffect).toBe(25) // 5 × 5
    const s = receiptSummary(o)
    expect(s.receivedSubtotal).toBe(665) // 240 + 425
    expect(s.taxRate).toBeCloseTo(0.15)
    expect(s.receivedTotal).toBe(764.75) // 665 × 1.15
    expect(s.differenceTotal).toBe(-40.25) // 764.75 − 805
    expect(s.quantityEffect + s.priceEffect).toBe(-35) // = 665 − 700
    expect(orderPurchaseValue(o)).toBe(764.75)
  })

  it("una línea que no llegó cuenta 0", () => {
    const o = order({ receipt: { at: "2026-11-11T10:00:00Z", lines: [{ key: "a", quantity: 10, unitCost: 30 }] } })
    expect(receiptLines(o)[1].receivedQuantity).toBe(0)
    expect(receiptSummary(o).receivedSubtotal).toBe(300)
  })

  it("orden sin subtotal: tasa 0", () => {
    expect(orderTaxRate({ tax: 0, subtotal: 0 })).toBe(0)
  })
})

describe("devoluciones al proveedor (docs/322)", () => {
  const received = order({ receipt: { at: "2026-11-11T10:00:00Z", lines: [{ key: "a", quantity: 8, unitCost: 30 }, { key: "b", quantity: 5, unitCost: 85 }] } })

  it("devolver 1 kg de pollo: 85 + 15 % = 97.75; queda por devolver 4", () => {
    const r = buildReturn(received, { quantities: { b: 1 }, reason: "damaged", at: "2026-11-12T09:00:00Z", id: "D1" })!
    expect(r.lines).toEqual([{ key: "b", quantity: 1, unitCost: 85 }])
    expect(returnValue(received, r)).toEqual({ subtotal: 85, tax: 12.75, total: 97.75 })
    const after = { ...received, returns: [r] }
    expect(returnableQuantities(after).get("b")).toBe(4)
  })

  it("no se puede devolver más de lo recibido", () => {
    const r = buildReturn(received, { quantities: { a: 50 }, reason: "excess" })!
    expect(r.lines[0].quantity).toBe(8)
    const after = { ...received, returns: [r] }
    expect(buildReturn(after, { quantities: { a: 1 }, reason: "excess" })).toBeNull()
  })

  it("las devoluciones cuentan en el período de su fecha", () => {
    const r = buildReturn(received, { quantities: { b: 1 }, reason: "damaged", at: "2026-11-12T09:00:00Z" })!
    const orders = [{ ...received, returns: [r] }]
    expect(returnsInPeriod(orders, (iso) => iso.startsWith("2026-11")).total).toBe(97.75)
    expect(returnsInPeriod(orders, (iso) => iso.startsWith("2026-12")).total).toBe(0)
  })
})
