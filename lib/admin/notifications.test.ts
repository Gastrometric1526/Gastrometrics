import { describe, expect, it } from "vitest"
import { mergeNotices, newSince, shortText, unreadNotices, type AdminNotice } from "./notifications"

const n = (id: string, at: string, kind: AdminNotice["kind"] = "message"): AdminNotice => ({ id, kind, who: null, text: id, at, tab: "buzon" })

describe("notificaciones de /admin", () => {
  it("junta, quita repetidas y ordena de la más reciente a la más vieja", () => {
    const out = mergeNotices([
      [n("a", "2026-11-08T10:00:00Z"), n("b", "2026-11-08T12:00:00Z")],
      [n("c", "2026-11-08T11:00:00Z", "chat"), n("a", "2026-11-08T10:00:00Z")],
    ])
    expect(out.map((x) => x.id)).toEqual(["b", "c", "a"])
  })

  it("respeta el límite", () => {
    const list = Array.from({ length: 10 }, (_, i) => n(`x${i}`, `2026-11-0${(i % 9) + 1}T00:00:00Z`))
    expect(mergeNotices([list], 3)).toHaveLength(3)
  })

  it("sin marcar nunca, todas son nuevas; después, solo las posteriores", () => {
    const list = [n("a", "2026-11-08T12:00:00Z"), n("b", "2026-11-08T09:00:00Z")]
    expect(unreadNotices(list, null)).toHaveLength(2)
    expect(unreadNotices(list, Date.parse("2026-11-08T10:00:00Z")).map((x) => x.id)).toEqual(["a"])
  })

  it("el aviso emergente solo sale por las que no estaban en la lectura anterior", () => {
    const list = [n("a", "2026-11-08T12:00:00Z"), n("b", "2026-11-08T09:00:00Z")]
    expect(newSince(null, list)).toEqual([])
    expect(newSince(new Set(["b"]), list).map((x) => x.id)).toEqual(["a"])
  })

  it("recorta textos largos a una línea", () => {
    expect(shortText("  hola \n  mundo ")).toBe("hola mundo")
    expect(shortText("x".repeat(200), 10)).toHaveLength(10)
  })
})
