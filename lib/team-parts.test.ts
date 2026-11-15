import { describe, expect, it } from "vitest"
import { defaultParts, memberHasPart, partsToStore, PARTS_V1, rolePreset, storedParts, withoutParts } from "./team-parts"
import { effectiveMemberFeatures, featuresToStore } from "./team-access"
import { isPosOnlyMember } from "./pos-waiter"

describe("partes de cada módulo en Equipo (docs/303)", () => {
  it("quien es de antes conserva todo, menos Ajustes del POS sin «team»", () => {
    const old = ["pos", "manual_sales", "access_v2"]
    expect(storedParts(old)).toBeNull()
    expect(memberHasPart(old, "pos.charge")).toBe(true)
    expect(memberHasPart(old, "pdf.recipe")).toBe(true)
    expect(memberHasPart(old, "pos.settings")).toBe(false)
    expect(memberHasPart([...old, "team"], "pos.settings")).toBe(true)
  })

  it("con partes elegidas, solo esas", () => {
    const stored = featuresToStore(partsToStore(["pos", "manual_sales"], ["pos.orders", "pos.receipts"]) as never)
    expect(stored).toContain(PARTS_V1)
    expect(memberHasPart(stored, "pos.orders")).toBe(true)
    expect(memberHasPart(stored, "pos.charge")).toBe(false)
    expect(memberHasPart(stored, "pdf.recipe")).toBe(false)
  })

  it("las partes no se confunden con módulos", () => {
    const stored = ["pos", "manual_sales", "access_v2", PARTS_V1, "pos.orders", "pdf.menu"]
    expect(withoutParts(stored)).toEqual(["pos", "manual_sales", "access_v2"])
    expect(effectiveMemberFeatures(stored)).toEqual(["pos", "manual_sales"])
    expect(isPosOnlyMember(stored)).toBe(true)
  })

  it("plantillas: solo módulos que el plan del dueño incluye", () => {
    const all = () => true
    expect(rolePreset("waiter", all)).toEqual({ modules: ["pos", "manual_sales"], parts: ["pos.orders", "pos.charge", "pos.receipts"], pdfAccess: "ninguno" })
    expect(rolePreset("kitchen", all).parts).toContain("pos.kitchen")
    expect(rolePreset("manager", all).parts).toContain("pos.settings")
    const noPos = (m: string) => m !== "pos"
    expect(rolePreset("cashier", noPos).modules).not.toContain("pos")
  })

  it("ver costos (docs/304): los de antes los siguen viendo; las plantillas solo al encargado", () => {
    expect(memberHasPart(["recipes", "access_v2"], "info.costs")).toBe(true)
    const cook = partsToStore(["recipes"], ["pdf.recipe"])
    expect(memberHasPart(cook, "info.costs")).toBe(false)
    const all = () => true
    expect(rolePreset("manager", all).parts).toContain("info.costs")
    for (const role of ["waiter", "kitchen", "cashier"] as const) expect(rolePreset(role, all).parts).not.toContain("info.costs")
    expect(withoutParts(["recipes", "info.costs"])).toEqual(["recipes"])
  })

  it("lo de siempre incluye todos los PDF por tipo", () => {
    expect(defaultParts([])).toContain("pdf.sales_history")
  })
})
