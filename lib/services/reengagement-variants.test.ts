import { describe, it, expect } from "vitest"
import {
  pickReengagementVariant,
  reengagementVariantCount,
  renderReengagementEmail,
} from "./notify-reengagement"
import { REENGAGEMENT_VARIANTS } from "@/lib/i18n/reengagement-email-variants"
import type { ReengagementType } from "@/lib/i18n/reengagement-email-labels"

const TYPES: ReengagementType[] = ["unfinished_recipe", "inventory_count", "review_reports", "update_prices", "we_miss_you"]
const LANGS = ["es", "en", "da", "fr", "pt", "zh"] as const
const render = (type: ReengagementType, lang: string, variant: number) =>
  renderReengagementEmail({
    type,
    language: lang,
    vars: { name: "Ana", recipe: "Ceviche", days: 9, count: 5 },
    actionUrl: "https://x/y",
    unsubscribeUrl: "#",
    variant,
  })

describe("variantes de recordatorios (docs/139)", () => {
  it("cada tipo e idioma tiene 3 textos distintos, sin variables sin reemplazar", () => {
    for (const lang of LANGS) {
      for (const type of TYPES) {
        expect(reengagementVariantCount(type, lang)).toBe(3)
        const subjects = new Set([0, 1, 2].map((v) => render(type, lang, v).subject))
        expect(subjects.size).toBe(3)
        for (const v of [0, 1, 2]) {
          const { subject, html } = render(type, lang, v)
          expect(subject + html).not.toMatch(/\{(name|recipe|days|count)\}/)
        }
      }
    }
  })

  it("la rotación no repite un texto hasta pasar por los tres", () => {
    for (const type of TYPES) {
      const seen = [0, 1, 2].map((n) => pickReengagementVariant("cuenta-123", type, n))
      expect(new Set(seen).size).toBe(3)
      expect(pickReengagementVariant("cuenta-123", type, 3)).toBe(seen[0])
    }
  })

  it("las cuentas no arrancan todas en la misma variante", () => {
    const starts = new Set(Array.from({ length: 30 }, (_, i) => pickReengagementVariant(`acc-${i}`, "inventory_count", 0)))
    expect(starts.size).toBe(3)
  })

  it("el español usa tú, no vos", () => {
    const es = JSON.stringify(REENGAGEMENT_VARIANTS.es) + [0, 1, 2].map((v) => TYPES.map((t) => render(t, "es", v).html).join("")).join("")
    expect(es).not.toMatch(/\b(podés|tenés|querés|entrá|revisá|actualizá|mirá|seguí|por vos)\b/)
  })
})
