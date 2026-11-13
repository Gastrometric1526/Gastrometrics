import { describe, expect, it } from "vitest"
import translations from "@/lib/i18n/translations"
import { PLAN_HISTORY_ORIGINS, planChangeFromRow } from "./plan-history"

// docs/301: todos los cambios de plan de cada persona, con su origen.
describe("historial de plan", () => {
  it("las filas de antes con «admin» quedan como /admin, fundadoras o referidos", () => {
    expect(planChangeFromRow({ created_at: "2026-10-11T18:00:00Z", metadata: { from: "foodie", to: "chef-ejecutivo", source: "admin" } })).toMatchObject({
      origin: "admin_legacy",
      kind: "changed",
    })
  })

  it("las nuevas traen origen, tipo, fecha y quién", () => {
    const row = {
      created_at: "2026-11-13T18:00:00Z",
      entity_label: "sous-chef",
      metadata: { from: "sous-chef", to: "sous-chef", source: "stripe", origin: "stripe", kind: "cancel_scheduled", until: "2026-12-13T00:00:00Z", by: null },
    }
    expect(planChangeFromRow(row)).toMatchObject({ origin: "stripe", kind: "cancel_scheduled", until: "2026-12-13T00:00:00Z", to: "sous-chef" })
    expect(planChangeFromRow({ created_at: "x", metadata: { from: "foodie", to: "home-cook", source: "admin", origin: "founder", by: "a@b.com" } })).toMatchObject({ origin: "founder", by: "a@b.com" })
    // Un tipo desconocido no rompe: es un cambio.
    expect(planChangeFromRow({ created_at: "x", metadata: { kind: "otro" } }).kind).toBe("changed")
  })

  it("cada origen y tipo tiene su texto en los 6 idiomas", () => {
    const keys = [...PLAN_HISTORY_ORIGINS.map((o) => `admin_plan_hist_origin_${o}`), "admin_plan_hist_kind_cancel_scheduled", "admin_plan_hist_kind_cancel_undone", "admin_plan_hist_kind_extended", "admin_plan_hist_until"]
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const key of keys) expect((translations[lang] as Record<string, string>)[key], `${lang}.${key}`).toBeTruthy()
    }
  })
})
