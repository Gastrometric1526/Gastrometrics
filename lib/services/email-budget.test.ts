import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Resend } from "resend"
import { sendWithRetry, withEmailBudget, EMAIL_BUDGET_ERROR, __emailTiming } from "./send-email"
import { emailCapFor, DEFAULT_EMAIL_STEP_CAP } from "@/lib/email-step-caps"

function okResend() {
  const send = vi.fn(async () => ({ data: { id: "ok" }, error: null }))
  return { resend: { emails: { send } } as unknown as Resend, send }
}

const payload = { from: "a@b.c", to: ["x@y.z"], subject: "s", html: "<p>h</p>" }

beforeEach(() => {
  __emailTiming.enabled = false
})

describe("tope de correos por paso de la tarea diaria (docs/355)", () => {
  it("manda hasta el tope y retiene el resto sin llamar a Resend", async () => {
    const { resend, send } = okResend()
    const { result, budget } = await withEmailBudget("prueba", 3, async () => {
      const results = []
      for (let i = 0; i < 5; i++) results.push(await sendWithRetry(resend, payload))
      return results
    })
    expect(send).toHaveBeenCalledTimes(3)
    expect(budget).toEqual({ label: "prueba", max: 3, sent: 3, held: 2 })
    expect(result.slice(0, 3).every((r) => r.error === null)).toBe(true)
    expect(result.slice(3).every((r) => (r.error as { name?: string } | null)?.name === EMAIL_BUDGET_ERROR)).toBe(true)
  })

  it("un reintento no gasta otro lugar del tope (cuenta correos, no intentos)", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded", statusCode: 429 } })
      .mockResolvedValue({ data: { id: "ok" }, error: null })
    const resend = { emails: { send } } as unknown as Resend
    const { budget } = await withEmailBudget("prueba", 1, async () => {
      await sendWithRetry(resend, payload)
    })
    expect(send).toHaveBeenCalledTimes(2)
    expect(budget.sent).toBe(1)
    expect(budget.held).toBe(0)
  })

  it("fuera de un tope nada cambia (registro, contraseña, chat, pagos)", async () => {
    const { resend, send } = okResend()
    for (let i = 0; i < 100; i++) await sendWithRetry(resend, payload)
    expect(send).toHaveBeenCalledTimes(100)
  })

  it("el tope de un paso no alcanza a lo que corre al mismo tiempo fuera de él", async () => {
    const { resend, send } = okResend()
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const capped = withEmailBudget("prueba", 0, async () => {
      await gate
      return sendWithRetry(resend, payload)
    })
    const outside = await sendWithRetry(resend, payload) // otra petición, misma instancia
    release()
    const { result, budget } = await capped
    expect(outside.error).toBeNull()
    expect((result.error as { name?: string } | null)?.name).toBe(EMAIL_BUDGET_ERROR)
    expect(budget.held).toBe(1)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it("topes: el del chat es propio; los demás usan EMAIL_STEP_CAP o 60", () => {
    expect(emailCapFor("chat de soporte sin respuesta", "500")).toBe(20)
    expect(emailCapFor("correos de valor", undefined)).toBe(DEFAULT_EMAIL_STEP_CAP)
    expect(DEFAULT_EMAIL_STEP_CAP).toBe(60)
    expect(emailCapFor("correos de valor", "80")).toBe(80)
    expect(emailCapFor("correos de valor", "no")).toBe(60)
    expect(emailCapFor("correos de valor", "0")).toBe(60)
  })
})
