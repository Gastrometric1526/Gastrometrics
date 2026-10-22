import { describe, expect, it } from "vitest"
import {
  activationStep,
  bankApplication,
  normalizeReferralCode,
  referralCodeFor,
  rewardAction,
  rewardsInLastYear,
  uuidRangeForCode,
  windowDay,
  type InviteeReferral,
} from "./referrals"

const NOW = new Date("2026-10-22T12:00:00Z").getTime()
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

describe("códigos de invitación (docs/179)", () => {
  it("salen del id de la cuenta y se validan", () => {
    const id = "a3f9c2d1-1234-4abc-8def-0123456789ab"
    expect(referralCodeFor(id)).toBe("A3F9C2D1")
    expect(normalizeReferralCode(" a3f9c2d1 ")).toBe("A3F9C2D1")
    expect(normalizeReferralCode("hola")).toBeNull()
    expect(uuidRangeForCode("A3F9C2D1")).toEqual({ from: "a3f9c2d1-0000-0000-0000-000000000000", to: "a3f9c2d1-ffff-ffff-ffff-ffffffffffff" })
  })
})

describe("qué recibe una cuenta al ganar un mes", () => {
  it("Foodie: 30 días de Chef Ejecutivo desde hoy", () => {
    const r = rewardAction({ planSlug: "foodie", expiresAt: null, hasStripeSubscription: false }, NOW)
    expect(r).toEqual({ kind: "grant", planSlug: "chef-ejecutivo", expiresAt: iso(NOW + 30 * DAY) })
  })

  it("cocina fundadora con Chef Ejecutivo por tiempo: se suman 30 días al final", () => {
    const r = rewardAction({ planSlug: "chef-ejecutivo", expiresAt: iso(NOW + 120 * DAY), hasStripeSubscription: false }, NOW)
    expect(r).toEqual({ kind: "extend", planSlug: "chef-ejecutivo", expiresAt: iso(NOW + 150 * DAY) })
  })

  it("plan menor por tiempo (Chef de Partie): sube a Chef Ejecutivo hasta su vencimiento + 30 días", () => {
    const r = rewardAction({ planSlug: "chef-de-partie", expiresAt: iso(NOW + 10 * DAY), hasStripeSubscription: false }, NOW)
    expect(r).toEqual({ kind: "grant", planSlug: "chef-ejecutivo", expiresAt: iso(NOW + 40 * DAY) })
  })

  it("plan menor por tiempo (Home Cook): sube a Chef Ejecutivo hasta su vencimiento + 30 días", () => {
    const r = rewardAction({ planSlug: "home-cook", expiresAt: iso(NOW + 5 * DAY), hasStripeSubscription: false }, NOW)
    expect(r).toEqual({ kind: "grant", planSlug: "chef-ejecutivo", expiresAt: iso(NOW + 35 * DAY) })
  })

  it("plan gratis ya vencido: como Foodie", () => {
    expect(rewardAction({ planSlug: "chef-ejecutivo", expiresAt: iso(NOW - DAY), hasStripeSubscription: false }, NOW).kind).toBe("grant")
  })

  it("paga con Stripe: un mes de su plan como saldo a favor", () => {
    expect(rewardAction({ planSlug: "sous-chef", expiresAt: null, hasStripeSubscription: true }, NOW)).toEqual({ kind: "stripe_credit", amountCents: 7000, planSlug: "sous-chef" })
  })

  it("plan asignado para siempre (sin vencimiento ni Stripe): no aplica", () => {
    expect(rewardAction({ planSlug: "chef-ejecutivo", expiresAt: null, hasStripeSubscription: false }, NOW)).toEqual({ kind: "none", reason: "permanent_plan" })
  })
})

describe("meses guardados", () => {
  it("se usan cuando el plan gratis vence y la cuenta no paga", () => {
    const state = { planSlug: "chef-ejecutivo", expiresAt: iso(NOW - 1000), hasStripeSubscription: false }
    expect(bankApplication(state, 60, NOW)).toEqual({ planSlug: "chef-ejecutivo", expiresAt: iso(NOW + 60 * DAY) })
  })
  it("no se usan mientras el plan mejor sigue vigente, ni si paga", () => {
    expect(bankApplication({ planSlug: "chef-ejecutivo", expiresAt: iso(NOW + DAY), hasStripeSubscription: false }, 30, NOW)).toBeNull()
    expect(bankApplication({ planSlug: "foodie", expiresAt: null, hasStripeSubscription: true }, 30, NOW)).toBeNull()
    expect(bankApplication({ planSlug: "foodie", expiresAt: null, hasStripeSubscription: false }, 0, NOW)).toBeNull()
  })
})

describe("estado diario de una invitación", () => {
  const base: InviteeReferral = { by: "x", code: "A3F9C2D1", at: iso(NOW - 3 * DAY), status: "registered" }

  it("se activa dentro de la ventana: premio", () => {
    expect(activationStep({ referral: base, isActive: true, rewardsLastYear: 0, now: NOW })).toEqual({ action: "reward" })
  })
  it("con 12 premios en el año: se activa sin premio", () => {
    expect(activationStep({ referral: base, isActive: true, rewardsLastYear: 12, now: NOW })).toEqual({ action: "activate_capped" })
  })
  it("día 4 sin activarse: aviso del día 3 a quien invitó, una sola vez", () => {
    expect(activationStep({ referral: base, isActive: false, rewardsLastYear: 0, now: NOW })).toEqual({ action: "nudge", day: 3 })
    expect(activationStep({ referral: { ...base, nudges: [3] }, isActive: false, rewardsLastYear: 0, now: NOW })).toEqual({ action: "wait" })
  })
  it("se activa el día 29: cuenta; pasados los 30 días: vence", () => {
    expect(activationStep({ referral: { ...base, at: iso(NOW - 29 * DAY) }, isActive: true, rewardsLastYear: 0, now: NOW }).action).toBe("reward")
    expect(activationStep({ referral: { ...base, at: iso(NOW - 31 * DAY) }, isActive: true, rewardsLastYear: 0, now: NOW }).action).toBe("expire")
  })
  it("ya premiada: no hace nada", () => {
    expect(activationStep({ referral: { ...base, status: "rewarded" }, isActive: true, rewardsLastYear: 0, now: NOW })).toEqual({ action: "wait" })
  })
  it("cuenta días y premios del último año", () => {
    expect(windowDay(iso(NOW - 3 * DAY), NOW)).toBe(4)
    expect(rewardsInLastYear([{ invitee: "a", at: iso(NOW - 10 * DAY), kind: "bank" }, { invitee: "b", at: iso(NOW - 400 * DAY), kind: "grant" }], NOW)).toBe(1)
  })
})
