import { describe, it, expect } from "vitest"
import { computeUsageInsights, hondurasDay, type ActivityRow } from "./account-insights"

const row = (created_at: string, module: string, action: string, extra: Partial<ActivityRow> = {}): ActivityRow => ({
  created_at,
  module,
  action,
  ...extra,
})

describe("computeUsageInsights", () => {
  // 2026-10-19 es lunes. Las horas van en UTC; Honduras = UTC−6.
  const rows = [
    row("2026-10-19T15:00:00Z", "dashboard", "entered"), // lun 9:00 HN
    row("2026-10-19T15:05:00Z", "ingredientes", "entered"),
    row("2026-10-19T15:06:00Z", "ingredientes", "created"),
    row("2026-10-20T03:00:00Z", "recetas", "entered"), // lun 21:00 HN (mismo día local)
    row("2026-10-20T16:00:00Z", "ficha_tecnica", "created"), // mar 10:00 HN
    row("2026-10-20T16:10:00Z", "ocr", "read", { metadata: { kind: "receipt" } }),
    row("2026-10-22T16:00:00Z", "ingredientes", "entered"), // jue
    row("2026-10-11T18:00:00Z", "plan", "plan_changed", { metadata: { from: "foodie", to: "chef-ejecutivo", source: "admin" } }),
  ]
  const insights = computeUsageInsights(rows, new Date("2026-10-22T20:00:00Z").getTime())

  it("cuenta días en hora de Honduras", () => {
    expect(hondurasDay("2026-10-20T03:00:00Z")).toBe("2026-10-19")
    expect(insights.activeDays).toBe(3) // lun, mar, jue
    expect(insights.activeDaysLast7).toBe(3)
    expect(insights.longestStreak).toBe(2)
  })

  it("días de la semana y horas", () => {
    expect(insights.byWeekday[1]).toBe(4) // lunes
    expect(insights.byWeekday[2]).toBe(2) // martes
    expect(insights.byWeekday[4]).toBe(1) // jueves
    expect(insights.byHour[9]).toBe(3)
    expect(insights.byHour[21]).toBe(1)
  })

  it("módulos más usados, acciones, OCR e hitos", () => {
    expect(insights.moduleVisits[0]).toEqual({ module: "ingredientes", count: 2 })
    expect(insights.moduleActions.find((m) => m.module === "ficha_tecnica")?.created).toBe(1)
    expect(insights.ocrReads).toEqual({ recipe: 0, receipt: 1, inventory: 0, total: 1 })
    expect(insights.milestones.map((m) => m.key)).toEqual(["first_ingredient", "first_recipe", "first_ocr"])
  })

  it("los cambios de plan no cuentan como uso, pero quedan en el historial", () => {
    expect(insights.totalEvents).toBe(7)
    expect(insights.planChanges).toEqual([{ at: "2026-10-11T18:00:00Z", from: "foodie", to: "chef-ejecutivo", source: "admin" }])
  })

  it("12 semanas, la última con el uso de esta semana", () => {
    expect(insights.weekly).toHaveLength(12)
    expect(insights.weekly[11]).toEqual({ weekStart: "2026-10-19", count: 7 })
  })
})
