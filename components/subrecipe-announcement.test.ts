import { describe, expect, it } from "vitest"
import { subrecipeAnnouncementDue } from "./subrecipe-announcement"

describe("aviso único de subrecetas (docs/339)", () => {
  it("solo a cuentas que ya existían y una sola vez", () => {
    expect(subrecipeAnnouncementDue({ createdAt: "2026-10-01T10:00:00Z", seen: false })).toBe(true)
    expect(subrecipeAnnouncementDue({ createdAt: "2026-10-01T10:00:00Z", seen: true })).toBe(false)
    expect(subrecipeAnnouncementDue({ createdAt: "2026-11-20T10:00:00Z", seen: false })).toBe(false)
    expect(subrecipeAnnouncementDue({ createdAt: null, seen: false })).toBe(false)
  })
})
