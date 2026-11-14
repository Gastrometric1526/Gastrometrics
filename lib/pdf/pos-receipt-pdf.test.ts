import { describe, expect, it } from "vitest"
import { generatePosReceiptPDF, posReceiptFilename } from "./pos-receipt-pdf-generator"
import type { PosReceipt } from "@/lib/pos-waiter"

const receipt = (lines: number, paid = true): PosReceipt => ({
  paid,
  tableLabel: "Mesa 4",
  areaName: "Terraza",
  waiter: "Ana",
  guests: 2,
  seats: null,
  at: "2026-11-14T18:30:00.000Z",
  lines: Array.from({ length: lines }, (_, i) => ({ quantity: 1, name: `Plato ${i + 1}`, extras: i === 0 ? ["Aguacate"] : [], note: null, amount: 50 })),
  subtotal: 50 * lines,
  discount: 0,
  tip: 10,
  total: 50 * lines + 10,
  payment: paid ? "cash" : null,
  received: paid ? 500 : null,
  change: paid ? 500 - (50 * lines + 10) : null,
})

describe("recibo del POS en PDF (docs/302)", () => {
  it("tira de 80 mm en una sola página, más larga con más platos", () => {
    const short = generatePosReceiptPDF(receipt(2))
    const long = generatePosReceiptPDF(receipt(30))
    expect(short.getNumberOfPages()).toBe(1)
    expect(long.getNumberOfPages()).toBe(1)
    expect(Math.round(short.internal.pageSize.getWidth())).toBe(80)
    expect(long.internal.pageSize.getHeight()).toBeGreaterThan(short.internal.pageSize.getHeight())
  })
  it("nombre del archivo: recibo o pre-cuenta, mesa y fecha", () => {
    expect(posReceiptFilename(receipt(1))).toMatch(/^Recibo_Mesa_4_\d{2}-\d{2}-2026\.pdf$/)
    expect(posReceiptFilename(receipt(1, false))).toMatch(/^Pre_cuenta_Mesa_4_/)
  })
})
