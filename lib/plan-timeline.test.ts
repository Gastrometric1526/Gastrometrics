import { describe, expect, it } from "vitest"
import { planTimeline, type PlanTimelineInput } from "./plan-timeline"

const base: PlanTimelineInput = {
  planSlug: "foodie",
  expiresAt: null,
  hasStripeSubscription: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  scheduled: null,
  bankDays: 0,
}

describe("planTimeline", () => {
  it("Foodie: gratis, sin cobros", () => {
    expect(planTimeline(base)).toEqual({ kind: "free" })
  })

  it("plan asignado sin fecha ni Stripe: sin vencimiento ni cobros", () => {
    expect(planTimeline({ ...base, planSlug: "chef-ejecutivo" })).toEqual({ kind: "no_end" })
  })

  it("suscripción de Stripe: siguiente cobro", () => {
    expect(planTimeline({ ...base, planSlug: "sous-chef", hasStripeSubscription: true, currentPeriodEnd: "2026-11-05T00:00:00.000Z" })).toEqual({
      kind: "paid",
      nextChargeAt: "2026-11-05T00:00:00.000Z",
    })
  })

  it("suscripción cancelándose: termina en el fin del período", () => {
    expect(
      planTimeline({ ...base, planSlug: "sous-chef", hasStripeSubscription: true, cancelAtPeriodEnd: true, currentPeriodEnd: "2026-11-05T00:00:00.000Z" }),
    ).toEqual({ kind: "paid_ending", endsAt: "2026-11-05T00:00:00.000Z" })
  })

  it("fundadora con meses guardados: el banco corre después del vencimiento", () => {
    const t = planTimeline({ ...base, planSlug: "chef-ejecutivo", expiresAt: "2026-11-10T00:00:00.000Z", bankDays: 60 })
    expect(t).toMatchObject({
      kind: "timed",
      endsAt: "2026-11-10T00:00:00.000Z",
      bankEndsAt: "2027-01-09T00:00:00.000Z",
      nextChargeAt: null,
      thenFoodieAt: "2027-01-09T00:00:00.000Z",
    })
  })

  it("plan con fecha y pago programado: el cobro es al vencer; el banco no alarga el plan", () => {
    const t = planTimeline({
      ...base,
      planSlug: "chef-ejecutivo",
      expiresAt: "2026-11-10T00:00:00.000Z",
      bankDays: 30,
      scheduled: { planSlug: "sous-chef", startsAt: "2026-11-10T00:00:00.000Z" },
    })
    expect(t).toMatchObject({ kind: "timed", bankEndsAt: null, nextChargeAt: "2026-11-10T00:00:00.000Z", nextChargePlanSlug: "sous-chef" })
  })
})
