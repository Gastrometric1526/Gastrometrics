import { describe, expect, it } from "vitest"
import { isOnline, onlineFirst } from "./online-first"

describe("onlineFirst (docs/212)", () => {
  const now = new Date("2026-10-30T12:00:00Z").getTime()

  it("en línea = visto en los últimos 3 minutos", () => {
    expect(isOnline("2026-10-30T11:58:30Z", now)).toBe(true)
    expect(isOnline("2026-10-30T11:56:00Z", now)).toBe(false)
    expect(isOnline(null, now)).toBe(false)
    expect(isOnline("no-es-fecha", now)).toBe(false)
  })

  it("sube a las cuentas en línea y conserva el orden elegido dentro de cada grupo", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) => ({ id }))
    expect(onlineFirst(rows, new Set(["d", "b"])).map((r) => r.id)).toEqual(["b", "d", "a", "c", "e"])
  })

  it("sin nadie en línea deja la lista igual", () => {
    const rows = [{ id: "a" }, { id: "b" }]
    expect(onlineFirst(rows, new Set())).toBe(rows)
  })
})
