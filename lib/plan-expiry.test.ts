import { describe, it, expect } from "vitest"
import { expiryInfo } from "./plan-expiry"

const at = (s: string) => new Date(s).getTime()

describe("expiryInfo", () => {
  it("más de una semana: tranquilo, se puede programar", () => {
    const info = expiryInfo("2026-11-10T12:00:00", at("2026-10-20T09:00:00"))
    expect(info.daysLeft).toBe(21)
    expect(info.urgency).toBe("calm")
    expect(info.canSchedule).toBe(true)
    expect(info.reminderStage).toBeNull()
  })

  it("entre 4 y 7 días: pronto", () => {
    expect(expiryInfo("2026-10-26T12:00:00", at("2026-10-20T09:00:00")).urgency).toBe("soon")
  })

  it("3 días antes: urgente y recordatorio de 3 días", () => {
    const info = expiryInfo("2026-10-23T08:00:00", at("2026-10-20T09:00:00"))
    expect(info.daysLeft).toBe(3)
    expect(info.urgency).toBe("urgent")
    expect(info.reminderStage).toBe("3d")
    expect(info.canSchedule).toBe(true) // 71 h
  })

  it("con menos de 49 h ya no se puede programar (se paga de inmediato)", () => {
    const info = expiryInfo("2026-10-22T08:00:00", at("2026-10-20T09:00:00"))
    expect(info.daysLeft).toBe(2)
    expect(info.canSchedule).toBe(false)
  })

  it("el mismo día: vence hoy", () => {
    const info = expiryInfo("2026-10-20T23:00:00", at("2026-10-20T09:00:00"))
    expect(info.daysLeft).toBe(0)
    expect(info.urgency).toBe("today")
    expect(info.reminderStage).toBe("today")
  })

  it("ya vencido", () => {
    const info = expiryInfo("2026-10-20T08:00:00", at("2026-10-20T09:00:00"))
    expect(info.urgency).toBe("expired")
    expect(info.reminderStage).toBeNull()
  })
})
