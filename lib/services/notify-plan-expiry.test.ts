import { describe, expect, it } from "vitest"
import { expiryReminderKind, referralBlockHtml } from "./notify-plan-expiry"
import { EMAIL_LABELS } from "@/lib/i18n/email-labels"

const H = 3_600_000
const now = Date.UTC(2026, 9, 25, 12)
const at = (hours: number) => new Date(now + hours * H).toISOString()

describe("expiryReminderKind (docs/200)", () => {
  it("3 días antes → «soon»; en las últimas 24 h → «today»", () => {
    expect(expiryReminderKind(at(72), now)).toBe("soon")
    expect(expiryReminderKind(at(25), now)).toBe("soon")
    expect(expiryReminderKind(at(24), now)).toBe("today")
    expect(expiryReminderKind(at(2), now)).toBe("today")
  })
  it("nada si ya venció o falta más de 3 días", () => {
    expect(expiryReminderKind(at(-1), now)).toBeNull()
    expect(expiryReminderKind(at(73), now)).toBeNull()
    expect(expiryReminderKind("no es fecha", now)).toBeNull()
  })
})

describe("referralBlockHtml", () => {
  it("lleva el enlace personal y el botón, con el texto escapado", () => {
    const html = referralBlockHtml({
      title: "Regala <un> mes",
      body: "Texto & más",
      linkLabel: "Tu enlace:",
      cta: "Invitar",
      link: "https://www.gastrometrics.org/r/ABCD1234",
      inviteUrl: "https://www.gastrometrics.org/mi-plan#invita",
    })
    expect(html).toContain("https://www.gastrometrics.org/r/ABCD1234")
    expect(html).toContain('href="https://www.gastrometrics.org/mi-plan#invita"')
    expect(html).toContain("Regala &lt;un&gt; mes")
    expect(html).toContain("Texto &amp; más")
  })
  it("sin cta no lleva botón (el correo del día ya tiene el principal)", () => {
    const html = referralBlockHtml({ title: "t", body: "b", linkLabel: "l", link: "https://x/r/ABCD1234", inviteUrl: "https://x/mi-plan#invita" })
    expect(html).toContain("https://x/r/ABCD1234")
    expect(html).not.toContain("mi-plan#invita")
  })
})

describe("textos de los correos de vencimiento", () => {
  it("existen en los 6 idiomas y el cuerpo ya no dice que lo asignó un administrador", () => {
    for (const labels of Object.values(EMAIL_LABELS)) {
      for (const k of ["e09t_subject", "e09t_body", "ref_title", "ref_body", "ref_cta"] as const) expect(labels[k].trim().length).toBeGreaterThan(1)
      expect(labels.ref_body).toContain("{max}")
    }
    expect(EMAIL_LABELS.es.e09_body).not.toMatch(/administrador/i)
  })
})
