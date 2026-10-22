import { describe, expect, it } from "vitest"
import { isNewPaymentFailure, paidRecordFromInvoice, pushPayment, type PaymentRecord } from "./payment-notice"

const NOW = Date.parse("2026-10-22T12:00:00.000Z")

describe("cobros confirmados (docs/183)", () => {
  it("una factura pagada con monto es un cobro", () => {
    const r = paidRecordFromInvoice(
      { id: "in_1", amount_paid: 3500, currency: "USD", hosted_invoice_url: "https://stripe/x", status_transitions: { paid_at: 1792670400 }, lines: { data: [{ period: { end: 1795348800 } }] } },
      "chef-de-partie",
      NOW,
    )
    expect(r).toEqual({
      status: "paid",
      amountCents: 3500,
      currency: "usd",
      planSlug: "chef-de-partie",
      at: new Date(1792670400 * 1000).toISOString(),
      invoiceUrl: "https://stripe/x",
      nextAt: new Date(1795348800 * 1000).toISOString(),
      key: "inv:in_1",
    })
  })

  it("una factura de $0 (inicio de un pago programado) no es un cobro", () => {
    expect(paidRecordFromInvoice({ id: "in_0", amount_paid: 0 }, "sous-chef", NOW)).toBeNull()
  })

  it("cobro fallido: solo cuando la suscripción pasa a past_due/unpaid desde otro estado", () => {
    expect(isNewPaymentFailure("past_due", "active")).toBe(true)
    expect(isNewPaymentFailure("unpaid", "trialing")).toBe(true)
    expect(isNewPaymentFailure("past_due", "past_due")).toBe(false)
    expect(isNewPaymentFailure("past_due", undefined)).toBe(false)
    expect(isNewPaymentFailure("active", "past_due")).toBe(false)
  })

  it("el historial no repite la misma factura y guarda 12 como máximo", () => {
    const rec = (k: string): PaymentRecord => ({ status: "paid", amountCents: 1, currency: "usd", planSlug: null, at: "", invoiceUrl: null, nextAt: null, key: k })
    let h: PaymentRecord[] = []
    for (let i = 0; i < 14; i++) h = pushPayment(h, rec(`k${i}`)).history
    expect(h).toHaveLength(12)
    expect(h[0].key).toBe("k13")
    expect(pushPayment(h, rec("k13")).added).toBe(false)
  })
})
