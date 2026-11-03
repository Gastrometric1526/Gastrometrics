import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TeamMember } from "@/types/team"

// Membresías reales de la persona invitada (no la Vista previa del dueño).
let mine: TeamMember[] = []
vi.mock("./storage/team-preview", () => ({ getActivePreviewMember: () => null, TEAM_PREVIEW_EVENT: "x" }))
vi.mock("./storage/team", () => ({ getMyMemberships: () => mine }))
vi.mock("./plan-overrides", () => ({ getCurrentPlanOverrides: () => ({ extraBusinesses: 0, extraTeamSeats: 0 }) }))

import { hasActiveMembership, hasFeatureAccess, setCurrentPlanSlug } from "./plan-access"
import { TEAM_ACCESS_V2 } from "./team-access"
import { ownerTeamAccess } from "./team-owner-access"
import { lastPaymentFailed } from "./payment-notice"

const member = (over: Partial<TeamMember> = {}) =>
  ({
    id: "t",
    ownerId: "o",
    email: "a@x.test",
    status: "activo",
    invitedAt: "",
    scope: "dashboard",
    activity: [],
    allowedFeatures: ["stats_finance", "inventory", "menus", TEAM_ACCESS_V2],
    pdfAccess: "administrativo",
    ...over,
  }) as unknown as TeamMember

describe("invitados según el plan del dueño (docs/236)", () => {
  beforeEach(() => {
    mine = []
    localStorage.clear()
    setCurrentPlanSlug("foodie") // el plan propio de la persona invitada
  })

  it("con el dueño en Sous Chef, el invitado trabaja con sus permisos", () => {
    mine = [member({ ownerPlanSlug: "sous-chef", ownerTeamActive: true })]
    expect(hasActiveMembership()).toBe(true)
    expect(hasFeatureAccess("stats_finance")).toBe(true)
    expect(hasFeatureAccess("inventory")).toBe(true)
  })

  it("si el dueño cancela y queda en Foodie, la membresía deja de aplicarse: vuelve a su propia cuenta", () => {
    mine = [member({ ownerPlanSlug: "foodie", ownerTeamActive: false })]
    expect(hasActiveMembership()).toBe(false)
    expect(hasFeatureAccess("stats_finance")).toBe(false) // su propio plan es Foodie
    expect(hasFeatureAccess("recipes")).toBe(true) // lo de siempre en su propia cuenta
  })

  it("si el dueño vuelve a un plan con Equipo, recupera los mismos permisos", () => {
    mine = [member({ ownerPlanSlug: "foodie", ownerTeamActive: false })]
    expect(hasFeatureAccess("inventory")).toBe(false)
    mine = [member({ ownerPlanSlug: "chef-ejecutivo", ownerTeamActive: true })]
    expect(hasFeatureAccess("inventory")).toBe(true)
  })

  it("nunca más de lo que incluye el plan del dueño", () => {
    // Con asientos extra de /admin, un dueño en Home Cook tiene Equipo, pero su plan no trae Finanzas.
    mine = [member({ ownerPlanSlug: "home-cook", ownerTeamActive: true, allowedFeatures: ["stats_finance", "recipes", TEAM_ACCESS_V2] as TeamMember["allowedFeatures"] })]
    expect(hasFeatureAccess("stats_finance")).toBe(false)
    expect(hasFeatureAccess("recipes")).toBe(true)
  })

  it("sin respuesta del servidor sobre el plan del dueño, se aplica como antes", () => {
    mine = [member()]
    expect(hasActiveMembership()).toBe(true)
    expect(hasFeatureAccess("stats_finance")).toBe(true)
  })
})

describe("ownerTeamAccess: la misma regla que la base (0036)", () => {
  const now = Date.parse("2026-11-03T12:00:00Z")
  it("Sous Chef y Chef Ejecutivo vigentes tienen Equipo; el resto no", () => {
    expect(ownerTeamAccess({ plan_slug: "sous-chef" }, now)).toEqual({ planSlug: "sous-chef", teamActive: true })
    expect(ownerTeamAccess({ plan_slug: "chef-ejecutivo" }, now).teamActive).toBe(true)
    expect(ownerTeamAccess({ plan_slug: "chef-de-partie" }, now).teamActive).toBe(false)
    expect(ownerTeamAccess(null, now)).toEqual({ planSlug: "foodie", teamActive: false })
  })
  it("un plan vencido cuenta como Foodie (cocina fundadora que terminó)", () => {
    expect(ownerTeamAccess({ plan_slug: "chef-ejecutivo", plan_expires_at: "2026-11-02T00:00:00Z" }, now)).toEqual({ planSlug: "foodie", teamActive: false })
    expect(ownerTeamAccess({ plan_slug: "chef-ejecutivo", plan_expires_at: "2026-12-01T00:00:00Z" }, now).teamActive).toBe(true)
  })
  it("los asientos extra de /admin mantienen Equipo", () => {
    expect(ownerTeamAccess({ plan_slug: "foodie", extra_team_seats: 1 }, now).teamActive).toBe(true)
  })
})

describe("aviso de pago fallido en Mi Plan", () => {
  const rec = (status: "paid" | "failed") => ({ status, amountCents: 7000, currency: "usd", planSlug: "sous-chef", at: "", invoiceUrl: null, nextAt: null, key: status })
  it("solo si el cobro más reciente falló", () => {
    expect(lastPaymentFailed([rec("failed"), rec("paid")])).toBe(true)
    expect(lastPaymentFailed([rec("paid"), rec("failed")])).toBe(false)
    expect(lastPaymentFailed([])).toBe(false)
  })
})
