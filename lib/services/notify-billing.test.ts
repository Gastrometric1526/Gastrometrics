import { describe, it, expect } from "vitest"
import { renderPlanChangedEmail } from "./notify-billing"
import { diffPlanCapabilities } from "@/lib/plan-capabilities"
import { escapeHtml } from "./email-templates"

const base = { nextChargeUnixSeconds: null, nextChargeAmountCents: null }

describe("correo de cambio de plan (docs/139)", () => {
  it("bajada desde /admin: lista TODO lo que pierde, lo que conserva y avisa que los datos no se borran", () => {
    const { html } = renderPlanChangedEmail({ ...base, fromPlanSlug: "sous-chef", toPlanSlug: "home-cook", source: "admin", language: "es" })
    const d = diffPlanCapabilities("sous-chef", "home-cook", "es")
    for (const item of [...d.lost, ...d.now]) expect(html).toContain(escapeHtml(item))
    expect(html).toContain("Pierdes acceso a")
    expect(html).not.toMatch(/\{\{\w+\}\}/)
    expect(html).toMatch(/no se borran/)
  })

  it("subida: lista lo ganado (no solo el primer elemento — regresión de docs/137)", () => {
    const { html, subject } = renderPlanChangedEmail({ ...base, fromPlanSlug: "foodie", toPlanSlug: "chef-ejecutivo", source: "stripe", language: "en" })
    const d = diffPlanCapabilities("foodie", "chef-ejecutivo", "en")
    expect(d.gained.length).toBeGreaterThan(5)
    for (const item of d.gained) expect(html).toContain(escapeHtml(item))
    expect(html).not.toMatch(/\{\{\w+\}\}/)
    expect(subject).toMatch(/Foodie/)
  })

  it("vencimiento: usa el texto de plan vencido", () => {
    const { html } = renderPlanChangedEmail({ ...base, fromPlanSlug: "chef-de-partie", toPlanSlug: "foodie", source: "expired", language: "es" })
    expect(html).toMatch(/fecha de vencimiento|venci/)
  })
})
