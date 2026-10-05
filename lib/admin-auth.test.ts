import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

import { createAdminSessionValue, getAdminPasscode, isValidAdminSessionValue, safeEqual } from "./admin-auth"
import { isAuthorizedCronRequest } from "./cron-auth"

const env = { ...process.env }

describe("sesión de /admin firmada (docs/154)", () => {
  beforeEach(() => {
    process.env.ADMIN_PASSCODE = "codigo-de-prueba"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-servidor"
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it("la cookie vieja \"granted\" ya no sirve", () => {
    expect(isValidAdminSessionValue("granted")).toBe(false)
  })

  it("acepta una cookie recién firmada y la rechaza alterada o vencida", () => {
    const now = Date.now()
    const value = createAdminSessionValue(now)!
    expect(isValidAdminSessionValue(value, now)).toBe(true)
    const [expires, signature] = value.split(".")
    expect(isValidAdminSessionValue(`${Number(expires) + 99999}.${signature}`, now)).toBe(false)
    expect(isValidAdminSessionValue(value, now + 5 * 60 * 60 * 1000)).toBe(false)
  })

  it("cambiar el código invalida las sesiones abiertas", () => {
    const value = createAdminSessionValue()!
    process.env.ADMIN_PASSCODE = "otro-codigo"
    expect(isValidAdminSessionValue(value)).toBe(false)
  })

  it("en producción no hay código por defecto", () => {
    delete process.env.ADMIN_PASSCODE
    vi.stubEnv("NODE_ENV", "production")
    expect(getAdminPasscode()).toBeNull()
    expect(createAdminSessionValue()).toBeNull()
    vi.unstubAllEnvs()
  })

  it("compara textos sin importar el largo", () => {
    expect(safeEqual("abc", "abc")).toBe(true)
    expect(safeEqual("abc", "abcd")).toBe(false)
    expect(safeEqual("", "x")).toBe(false)
  })
})

describe("acceso a los cron (docs/154)", () => {
  afterEach(() => {
    process.env = { ...env }
    vi.unstubAllEnvs()
  })
  const req = (headers: Record<string, string> = {}) => new Request("https://x/api/cron/keep-alive", { headers })

  it("con CRON_SECRET, solo con el Bearer correcto", async () => {
    process.env.CRON_SECRET = "s3cr3t"
    expect(await isAuthorizedCronRequest(req({ authorization: "Bearer s3cr3t" }))).toBe(true)
    expect(await isAuthorizedCronRequest(req({ authorization: "Bearer nope" }))).toBe(false)
    expect(await isAuthorizedCronRequest(req())).toBe(false)
  })

  it("sin CRON_SECRET en producción: solo la llamada de Vercel y nunca un modo de prueba anónimo", async () => {
    delete process.env.CRON_SECRET
    vi.stubEnv("NODE_ENV", "production")
    expect(await isAuthorizedCronRequest(req())).toBe(false)
    expect(await isAuthorizedCronRequest(req({ "user-agent": "vercel-cron/1.0" }))).toBe(true)
    expect(await isAuthorizedCronRequest(req({ "user-agent": "vercel-cron/1.0" }), { dryRun: true })).toBe(false)
  })
})
