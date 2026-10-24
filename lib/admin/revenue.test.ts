import { describe, expect, it } from "vitest"
import { monthlyFromRecurring, summarizeRevenue, type RevenueInvoice, type RevenueSubscription } from "./revenue"

const DAY = 86400000
const NOW = new Date(2026, 9, 24, 12).getTime()
const inv = (o: Partial<RevenueInvoice>): RevenueInvoice => ({
  id: "i", status: "paid", amountPaid: 1000, amountDue: 1000, currency: "usd", createdAt: NOW - DAY, paidAt: NOW - DAY,
  attemptCount: 1, email: "a@x.com", planSlug: "home-cook", billingReason: "subscription_cycle", ...o,
})
const sub = (o: Partial<RevenueSubscription>): RevenueSubscription => ({
  id: "s", status: "active", monthlyAmount: 1000, currency: "usd", planSlug: "home-cook", email: "a@x.com",
  createdAt: NOW - 90 * DAY, canceledAt: null, cancelAtPeriodEnd: false, cancelAt: null, ...o,
})

describe("ingresos reales (docs/195)", () => {
  it("normaliza precios recurrentes a mes", () => {
    expect(monthlyFromRecurring(12000, "year")).toBe(1000)
    expect(monthlyFromRecurring(1000, "month", 1, 2)).toBe(2000)
    expect(monthlyFromRecurring(3000, "month", 3)).toBe(1000)
  })

  it("MRR solo de activas y atrasadas; las de prueba aparte", () => {
    const r = summarizeRevenue([], [sub({}), sub({ status: "past_due", monthlyAmount: 500 }), sub({ status: "trialing" }), sub({ status: "canceled", canceledAt: NOW - 2 * DAY })], NOW)
    expect(r.mrr).toBe(1500)
    expect(r.activeSubscriptions).toBe(2)
    expect(r.trialingSubscriptions).toBe(1)
  })

  it("cobrado en 30 días, 30 anteriores y este mes, con serie diaria", () => {
    const r = summarizeRevenue(
      [inv({ amountPaid: 1000 }), inv({ amountPaid: 2000, paidAt: NOW - 40 * DAY }), inv({ status: "open", amountPaid: 0 })],
      [],
      NOW,
    )
    expect(r.collected30d).toBe(1000)
    expect(r.collectedPrev30d).toBe(2000)
    expect(r.paidInvoices30d).toBe(1)
    expect(r.daily).toHaveLength(30)
    expect(r.daily.reduce((s, d) => s + d.amount, 0)).toBe(1000)
  })

  it("cobros fallidos y cancelaciones", () => {
    const r = summarizeRevenue(
      [inv({ status: "open", attemptCount: 2, amountPaid: 0, email: "b@x.com" }), inv({ status: "open", attemptCount: 0, amountPaid: 0, email: "c@x.com" })],
      [sub({ status: "canceled", canceledAt: NOW - 3 * DAY, email: "d@x.com" }), sub({ cancelAtPeriodEnd: true, email: "e@x.com" }), sub({ status: "unpaid", email: "f@x.com" })],
      NOW,
    )
    expect(r.failed.map((f) => f.email).sort()).toEqual(["b@x.com", "f@x.com"])
    expect(r.cancellations30d.map((c) => c.email)).toEqual(["d@x.com"])
    expect(r.scheduledCancellations.map((c) => c.email)).toEqual(["e@x.com"])
    expect(r.churnRate30d).toBeCloseTo((1 / 3) * 100)
  })
})
