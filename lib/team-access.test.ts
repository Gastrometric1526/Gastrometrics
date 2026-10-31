import { describe, expect, it } from "vitest"
import { TEAM_ACCESS_V2, effectiveMemberFeatures, featuresToStore, planFeaturesFor } from "./team-access"

describe("permisos de Equipo (docs/216)", () => {
  it("una persona invitada antes conserva MEP e historial por lo que ya tenía", () => {
    expect(effectiveMemberFeatures(["menus", "manual_sales"])).toEqual(["menus", "manual_sales", "mep", "sales_history", "cash_up"])
    expect(effectiveMemberFeatures(["stats_finance"])).toEqual(["stats_finance", "sales_history"])
    expect(effectiveMemberFeatures(["recipes"])).toEqual(["recipes"])
  })

  it("después de guardarla desde Equipo, cuenta solo lo marcado", () => {
    const stored = featuresToStore(["menus", "manual_sales"])
    expect(stored).toContain(TEAM_ACCESS_V2)
    expect(effectiveMemberFeatures(stored)).toEqual(["menus", "manual_sales"])
    expect(effectiveMemberFeatures(featuresToStore(["mep"]))).toEqual(["mep"])
    expect(featuresToStore(featuresToStore(["mep"]) as never).filter((f) => f === TEAM_ACCESS_V2)).toHaveLength(1)
  })

  it("los planes se desbloquean igual que antes", () => {
    expect(planFeaturesFor("mep")).toEqual(["menus"])
    expect(planFeaturesFor("sales_history")).toEqual(["manual_sales", "stats_finance"])
    expect(planFeaturesFor("inventory")).toEqual(["inventory"])
  })
})

describe("cuadre de caja en Equipo (docs/217)", () => {
  it("lo conserva quien ya registraba ventas, y marcarlo marca el registro manual", async () => {
    const { effectiveMemberFeatures, toggleTeamFeature, planFeaturesFor } = await import("./team-access")
    expect(effectiveMemberFeatures(["manual_sales"])).toContain("cash_up")
    expect(toggleTeamFeature(["recipes"], "cash_up", true)).toEqual(["recipes", "cash_up", "manual_sales"])
    expect(toggleTeamFeature(["recipes", "cash_up", "manual_sales"], "manual_sales", false)).toEqual(["recipes"])
    expect(toggleTeamFeature(["cash_up", "manual_sales"], "cash_up", false)).toEqual(["manual_sales"])
    expect(planFeaturesFor("cash_up")).toEqual(["manual_sales"])
  })
})
