import { describe, expect, it } from "vitest"
import fs from "fs"
import path from "path"
import { TOUR_FLOWS, withTourFlows } from "./tour-flows"
import translations from "./i18n/translations"
import { CHANGELOG, getRecentChangelog, getChangelogEntry, changelogDate } from "./changelog"

const LANGS = ["es", "en", "da", "fr", "pt", "zh"] as const
const toursSource = fs.readFileSync(path.join(__dirname, "..", "components", "page-tours.tsx"), "utf8")

describe("conexiones de los tutoriales (docs/208)", () => {
  it("cada conexión apunta a un paso que existe", () => {
    for (const [tour, steps] of Object.entries(TOUR_FLOWS)) {
      expect(toursSource, `tutorial ${tour}`).toContain(`tour_completed_${tour}`)
      for (const id of Object.keys(steps)) expect(toursSource, `${tour}:${id}`).toContain(`id: "${id}"`)
    }
  })

  it("todos los textos existen en los 6 idiomas", () => {
    const keys = new Set<string>()
    for (const steps of Object.values(TOUR_FLOWS))
      for (const f of Object.values(steps)) [...(f.from ?? []), ...(f.to ?? []), ...(f.tip ? [f.tip] : [])].forEach((k) => keys.add(k))
    for (const lang of LANGS)
      for (const key of keys) expect((translations[lang] as Record<string, string>)[key], `${lang}.${key}`).toBeTruthy()
  })

  it("agrega viene de / se usa en / ejemplo sin pisar lo que el paso ya trae", () => {
    const t = (k: string) => `[${k}]`
    type Step = { id: string; from?: string[]; to?: string[]; tip?: string }
    const steps: Step[] = [{ id: "pax" }, { id: "x", tip: "propio" }]
    const [pax, other] = withTourFlows("tour_completed_ficha-tecnica", steps, t as never)
    expect(pax.tip).toBe("[tour_tip_ficha_pax]")
    expect(pax.to).toEqual(["[nav_ordenes_compra]"])
    expect(other.tip).toBe("propio")
    expect(withTourFlows("onboarding_completed", [{ id: "pax" } as Step], t as never)[0].tip).toBeUndefined()
  })
})

describe("novedades en Notificaciones (docs/208)", () => {
  it("solo las de los últimos 30 días, como mucho 3, y se buscan por versión", () => {
    const latest = new Date(`${changelogDate(CHANGELOG[0].version)}T12:00:00Z`)
    const recent = getRecentChangelog(latest)
    expect(recent.length).toBeGreaterThan(0)
    expect(recent.length).toBeLessThanOrEqual(3)
    expect(getRecentChangelog(new Date("2030-01-01T00:00:00Z"))).toHaveLength(0)
    expect(getChangelogEntry(CHANGELOG[1].version)).toBe(CHANGELOG[1])
    expect(getChangelogEntry("no-existe")).toBe(CHANGELOG[0])
  })
})
