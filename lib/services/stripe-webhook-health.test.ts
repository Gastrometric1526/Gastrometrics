import { describe, expect, it } from "vitest"
import { isSiteWebhook, planWebhookFix, REQUIRED_WEBHOOK_EVENTS } from "./stripe-webhook-health"

const ALL = [...REQUIRED_WEBHOOK_EVENTS]

describe("webhook de Stripe (docs/176)", () => {
  it("reconoce solo los endpoints de este sitio", () => {
    expect(isSiteWebhook("https://gastrometrics.org/api/webhooks/stripe")).toBe(true)
    expect(isSiteWebhook("https://www.gastrometrics.org/api/webhooks/stripe/")).toBe(true)
    expect(isSiteWebhook("https://otro-proyecto.com/api/webhooks/stripe")).toBe(false)
    expect(isSiteWebhook("https://gastrometrics.org/api/otra-cosa")).toBe(false)
  })

  it("cambia la dirección cuando redirige y agrega invoice.paid", () => {
    const fix = planWebhookFix(
      { url: "https://gastrometrics.org/api/webhooks/stripe", enabled_events: ALL.filter((e) => e !== "invoice.paid") },
      "https://www.gastrometrics.org",
    )
    expect(fix?.url).toBe("https://www.gastrometrics.org/api/webhooks/stripe")
    expect(fix?.enabled_events).toContain("invoice.paid")
  })

  it("no toca un endpoint que ya está bien", () => {
    expect(planWebhookFix({ url: "https://www.gastrometrics.org/api/webhooks/stripe", enabled_events: ALL }, "https://www.gastrometrics.org")).toBeNull()
  })

  it("nunca quita eventos y respeta el comodín *", () => {
    const fix = planWebhookFix({ url: "https://www.gastrometrics.org/api/webhooks/stripe", enabled_events: ["charge.refunded"] }, "https://www.gastrometrics.org")
    expect(fix?.enabled_events).toEqual(["charge.refunded", ...ALL])
    expect(planWebhookFix({ url: "https://www.gastrometrics.org/api/webhooks/stripe", enabled_events: ["*"] }, "https://www.gastrometrics.org")).toBeNull()
  })

  it("no apunta a un dominio ajeno aunque la redirección lo diga", () => {
    const fix = planWebhookFix({ url: "https://gastrometrics.org/api/webhooks/stripe", enabled_events: ALL }, "https://evil.example")
    expect(fix).toBeNull()
  })
})
