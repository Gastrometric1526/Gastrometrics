import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TeamMember } from "@/types/team"

let member: TeamMember | null = null
vi.mock("./storage/team-preview", () => ({ getActivePreviewMember: () => member, TEAM_PREVIEW_EVENT: "x" }))
vi.mock("./storage/team", () => ({ getMyMemberships: () => [] }))
vi.mock("./plan-overrides", () => ({ getCurrentPlanOverrides: () => ({ extraBusinesses: 0, extraTeamSeats: 0 }) }))

import { getAccessBlockReason, hasFeatureAccess } from "./plan-access"
import { TEAM_ACCESS_V2 } from "./team-access"

const m = (allowedFeatures: string[], pdfAccess: TeamMember["pdfAccess"] = "ninguno") =>
  ({ id: "t", ownerId: "o", email: "a@x.test", status: "activo", invitedAt: "", scope: "dashboard", activity: [], allowedFeatures, pdfAccess }) as unknown as TeamMember

describe("acceso de una persona del equipo (docs/216)", () => {
  beforeEach(() => {
    member = null
    localStorage.clear()
  })

  it("MEP e historial se dan o quitan por separado", () => {
    member = m(["manual_sales", "menus", TEAM_ACCESS_V2])
    expect(hasFeatureAccess("manual_sales")).toBe(true)
    expect(hasFeatureAccess("sales_history")).toBe(false)
    expect(hasFeatureAccess("mep")).toBe(false)
    expect(getAccessBlockReason("mep")).toBe("admin")
    member = m(["mep", "sales_history", TEAM_ACCESS_V2])
    expect(hasFeatureAccess("mep")).toBe(true)
    expect(hasFeatureAccess("sales_history")).toBe(true)
    expect(hasFeatureAccess("menus")).toBe(false)
  })

  it("quien estaba invitado antes conserva MEP e historial", () => {
    member = m(["menus", "stats_finance"])
    expect(hasFeatureAccess("mep")).toBe(true)
    expect(hasFeatureAccess("sales_history")).toBe(true)
  })

  it("niveles de PDF", () => {
    member = m([TEAM_ACCESS_V2], "ninguno")
    expect(hasFeatureAccess("pdf_export")).toBe(false)
    member = m([TEAM_ACCESS_V2], "cliente")
    expect(hasFeatureAccess("pdf_export")).toBe(true)
    expect(hasFeatureAccess("pdf_admin")).toBe(false)
    member = m([TEAM_ACCESS_V2], "administrativo")
    expect(hasFeatureAccess("pdf_admin")).toBe(true)
  })

  it("sin equipo, el plan desbloquea MEP con Menús y el historial con las ventas, como antes", () => {
    localStorage.setItem("current_plan_slug", "foodie")
    expect(hasFeatureAccess("mep")).toBe(false)
    expect(getAccessBlockReason("mep")).toBe("plan")
    localStorage.setItem("current_plan_slug", "chef-ejecutivo")
    expect(hasFeatureAccess("mep")).toBe(hasFeatureAccess("menus"))
    expect(hasFeatureAccess("sales_history")).toBe(hasFeatureAccess("manual_sales") || hasFeatureAccess("stats_finance"))
    expect(hasFeatureAccess("sales_history")).toBe(true)
  })
})
