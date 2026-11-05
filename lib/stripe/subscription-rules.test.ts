import { describe, expect, it } from "vitest"
import { planExcess, renewalInvoicePaid, subscriptionEventApplies } from "./subscription-rules"

describe("renewalInvoicePaid (valores reales de Stripe de prueba, docs/242)", () => {
  it("el saldo a favor cubre toda la factura: cuenta como pagada", () => {
    expect(renewalInvoicePaid({ status: "paid", total: 2500 })).toBe(true)
  })
  it("la factura de la prueba, en 0, no cuenta", () => {
    expect(renewalInvoicePaid({ status: "paid", total: 0 })).toBe(false)
  })
  it("una factura abierta por tarjeta rechazada no cuenta", () => {
    expect(renewalInvoicePaid({ status: "open", total: 2500 })).toBe(false)
  })
})

describe("subscriptionEventApplies", () => {
  it("un aviso viejo de una suscripción cancelada no devuelve el plan", () => {
    expect(subscriptionEventApplies({ subscriptionId: "a", accountSubscriptionId: null, status: "canceled" })).toBe(false)
  })
  it("una suscripción anterior que terminó no toca la nueva", () => {
    expect(subscriptionEventApplies({ subscriptionId: "a", accountSubscriptionId: "b", status: "canceled" })).toBe(false)
  })
  it("la suscripción de la cuenta siempre se aplica, también al terminar", () => {
    expect(subscriptionEventApplies({ subscriptionId: "a", accountSubscriptionId: "a", status: "canceled" })).toBe(true)
  })
  it("una suscripción nueva y viva se aplica", () => {
    expect(subscriptionEventApplies({ subscriptionId: "b", accountSubscriptionId: null, status: "active" })).toBe(true)
  })
})

describe("planExcess", () => {
  it("avisa solo de lo que supera el plan", () => {
    expect(planExcess({ businesses: 3, maxBusinesses: 2, teamMembers: 1, maxTeamMembers: 1 })).toEqual({
      businesses: { count: 3, max: 2 },
      team: null,
    })
  })
})
