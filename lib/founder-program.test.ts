import { describe, it, expect } from "vitest"
import { founderDecision, FOUNDER_PROGRAM } from "./founder-program"

const base = {
  accountCreatedAt: "2026-10-12T10:00:00-06:00",
  ordinal: 30,
  now: new Date("2026-10-12T10:02:00-06:00").getTime(),
  alreadyGranted: false,
  currentPlanSlug: "foodie",
  hasStripeSubscription: false,
}

describe("founderDecision (100 cocinas fundadoras)", () => {
  it("da Chef Ejecutivo por 30 días a una cuenta nueva dentro de las 100", () => {
    const d = founderDecision(base)
    expect(d.action).toBe("grant")
    if (d.action === "grant") expect(new Date(d.expiresAt).getTime() - base.now).toBe(30 * 86_400_000)
  })

  it("espera el minuto desde la creación de la cuenta", () => {
    const d = founderDecision({ ...base, now: new Date("2026-10-12T10:00:20-06:00").getTime() })
    expect(d).toEqual({ action: "wait", waitMs: 40_000 })
  })

  it("la cuenta 100 lo recibe y la 101 no", () => {
    expect(founderDecision({ ...base, ordinal: 100 }).action).toBe("grant")
    expect(founderDecision({ ...base, ordinal: 101 })).toEqual({ action: "skip", reason: "over_limit" })
  })

  it("las cuentas de antes del programa cuentan, pero no lo reciben", () => {
    expect(founderDecision({ ...base, accountCreatedAt: "2026-10-01T10:00:00-06:00" })).toEqual({ action: "skip", reason: "before_program" })
  })

  it("una sola vez por cuenta", () => {
    expect(founderDecision({ ...base, alreadyGranted: true })).toEqual({ action: "skip", reason: "already_granted" })
  })

  it("no toca a quien ya tiene un plan pagado", () => {
    expect(founderDecision({ ...base, currentPlanSlug: "sous-chef" })).toEqual({ action: "skip", reason: "has_paid_plan" })
    expect(founderDecision({ ...base, hasStripeSubscription: true })).toEqual({ action: "skip", reason: "has_paid_plan" })
  })

  it("el plan es Chef Ejecutivo", () => {
    expect(FOUNDER_PROGRAM.planSlug).toBe("chef-ejecutivo")
    expect(FOUNDER_PROGRAM.maxAccounts).toBe(100)
  })
})
