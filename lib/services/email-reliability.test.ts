import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Resend } from "resend"
import { sendWithRetry, __emailTiming } from "./send-email"
import { renderSignupDigest } from "./notify-signup"
import { buildChangelogItemsHtml, renderProductUpdateEmail } from "./product-update-email"
import { CHANGELOG, getChangelogEntriesSince, getDefaultEmailSinceVersion } from "@/lib/changelog"
import { getEmailLabels } from "@/lib/i18n/email-labels"
import { escapeHtml } from "./email-templates"

function fakeResend(results: Array<{ data: unknown; error: unknown } | Error>) {
  const send = vi.fn(async () => {
    const next = results.shift()
    if (next instanceof Error) throw next
    return next
  })
  return { resend: { emails: { send } } as unknown as Resend, send }
}

const payload = { from: "a@b.c", to: ["x@y.z"], subject: "s", html: "<p>h</p>" }

beforeEach(() => {
  __emailTiming.enabled = false // sin esperas reales en las pruebas
})

describe("sendWithRetry (docs/142)", () => {
  it("reintenta un límite de velocidad de Resend y termina enviando", async () => {
    const { resend, send } = fakeResend([
      { data: null, error: { name: "rate_limit_exceeded", statusCode: 429 } },
      { data: { id: "ok" }, error: null },
    ])
    const r = await sendWithRetry(resend, payload)
    expect(r.error).toBeNull()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it("reintenta un corte de red (el SDK lanza) y un error interno", async () => {
    const { resend, send } = fakeResend([
      new Error("fetch failed"),
      { data: null, error: { name: "internal_server_error", statusCode: 500 } },
      { data: { id: "ok" }, error: null },
    ])
    expect((await sendWithRetry(resend, payload)).error).toBeNull()
    expect(send).toHaveBeenCalledTimes(3)
  })

  it("no reintenta un error que no se arregla reintentando (correo inválido)", async () => {
    const { resend, send } = fakeResend([{ data: null, error: { name: "validation_error", statusCode: 422 } }])
    const r = await sendWithRetry(resend, payload)
    expect(r.error).toMatchObject({ name: "validation_error" })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("se rinde tras 3 intentos y devuelve el error sin lanzar", async () => {
    const err = { data: null, error: { name: "rate_limit_exceeded", statusCode: 429 } }
    const { resend, send } = fakeResend([err, err, err, err])
    const r = await sendWithRetry(resend, payload)
    expect(r.error).toMatchObject({ name: "rate_limit_exceeded" })
    expect(send).toHaveBeenCalledTimes(3)
  })
})

describe("resumen diario de cuentas nuevas (docs/142)", () => {
  it("lista cada cuenta, distingue registro propio de invitación y escapa el HTML", () => {
    const { subject, html } = renderSignupDigest([
      { email: "ana@x.com", createdAt: "2026-10-04T15:00:00Z", fullName: "Ana <b>", country: "Honduras", language: "es", invited: false },
      { email: "beto@x.com", createdAt: "2026-10-04T16:00:00Z", fullName: "", country: "", language: "zh", invited: true },
    ])
    expect(subject).toContain("2 cuentas nuevas")
    expect(html).toContain("ana@x.com")
    expect(html).toContain("beto@x.com")
    expect(html).toContain("1 por registro propio, 1 invitadas")
    expect(html).toContain("Chino")
    expect(html).toContain("Ana &lt;b&gt;")
    expect(renderSignupDigest([{ email: "a@x.com", createdAt: "2026-10-04T15:00:00Z", fullName: "", country: "", language: "", invited: false }]).subject).toContain("1 cuenta nueva ")
  })
})

describe("correo de novedades por idioma (docs/142)", () => {
  it("cada idioma recibe su asunto y el texto de cada entrada en su idioma", () => {
    const entries = getChangelogEntriesSince(CHANGELOG[1].version)
    for (const lang of ["es", "en", "da", "fr", "pt", "zh"] as const) {
      const { subject, html } = renderProductUpdateEmail({ entries, language: lang, siteUrl: "https://x" })
      expect(subject).toBe(getEmailLabels(lang).e08_subject)
      expect(html).toContain(`lang="${lang}"`)
      for (const entry of entries) {
        expect(html).toContain(escapeHtml(entry.content[lang].title))
        expect(html).toContain(escapeHtml(entry.content[lang].items[0]))
      }
    }
  })

  it("puede incluir varias entradas; por defecto todas las del día de la última", () => {
    const since = getDefaultEmailSinceVersion()
    const entries = getChangelogEntriesSince(since)
    expect(entries[0].version).toBe(CHANGELOG[0].version)
    expect(entries.every((e) => e.version.slice(0, 10) === CHANGELOG[0].version.slice(0, 10))).toBe(true)
    expect(getChangelogEntriesSince("no-existe")).toHaveLength(1)
    // Una sola entrada: sin título (como antes); varias: título por entrada.
    expect(buildChangelogItemsHtml(entries.slice(0, 1), "es")).not.toContain("font-weight:700")
    if (entries.length > 1) expect(buildChangelogItemsHtml(entries, "es")).toContain("font-weight:700")
    expect(buildChangelogItemsHtml(entries, "es")).not.toContain("Archivo")
  })
})
