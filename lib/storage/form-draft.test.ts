import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { FORM_DRAFT_TTL_MS, isDraftFresh, loadFormDraft, saveFormDraft, clearFormDraft } from "./form-draft"

const HOUR = 3_600_000

describe("borradores de formularios (docs/171)", () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.useRealTimers())

  it("duraciones elegidas por tipo", () => {
    expect(FORM_DRAFT_TTL_MS.ingredient).toBe(24 * HOUR)
    expect(FORM_DRAFT_TTL_MS.inventory).toBe(72 * HOUR)
    expect(FORM_DRAFT_TTL_MS.purchaseOrder).toBe(72 * HOUR)
    expect(FORM_DRAFT_TTL_MS.menu).toBe(7 * 24 * HOUR)
  })

  it("guarda, recupera y borra; uno por negocio", () => {
    saveFormDraft("menu", "u1", "b1", { name: "Boda" })
    saveFormDraft("menu", "u1", "b2", { name: "Cena" })
    expect(loadFormDraft<{ name: string }>("menu", "u1", "b1")?.data.name).toBe("Boda")
    expect(loadFormDraft<{ name: string }>("menu", "u1", "b2")?.data.name).toBe("Cena")
    expect(loadFormDraft("inventory", "u1", "b1")).toBeNull()
    clearFormDraft("menu", "u1", "b1")
    expect(loadFormDraft("menu", "u1", "b1")).toBeNull()
  })

  it("vence según el tipo", () => {
    const savedAt = new Date("2026-10-20T10:00:00Z").toISOString()
    const t = (h: number) => new Date("2026-10-20T10:00:00Z").getTime() + h * HOUR
    expect(isDraftFresh("ingredient", savedAt, t(23))).toBe(true)
    expect(isDraftFresh("ingredient", savedAt, t(25))).toBe(false)
    expect(isDraftFresh("inventory", savedAt, t(71))).toBe(true)
    expect(isDraftFresh("inventory", savedAt, t(73))).toBe(false)
    expect(isDraftFresh("menu", savedAt, t(24 * 6))).toBe(true)
    expect(isDraftFresh("menu", savedAt, t(24 * 8))).toBe(false)
  })

  it("un borrador vencido se borra al leerlo", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-20T10:00:00Z"))
    saveFormDraft("ingredient", "u1", null, { name: "Tomate" })
    vi.setSystemTime(new Date("2026-10-21T11:00:00Z"))
    expect(loadFormDraft("ingredient", "u1", null)).toBeNull()
    expect(window.localStorage.length).toBe(0)
  })
})
