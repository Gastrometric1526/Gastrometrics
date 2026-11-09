import { describe, expect, it } from "vitest"
import { returnedAfterFirstWeek, summarizeFunnel, summarizeNudges, type FunnelAccount } from "@/lib/admin/funnel"

const NOW = new Date("2026-11-30T12:00:00")
const acc = (over: Partial<FunnelAccount>): FunnelAccount => ({
  id: "x",
  createdAt: "2026-11-01T10:00:00",
  firstIngredientAt: null,
  firstCostAt: null,
  activeDays: [],
  paying: false,
  renewed: false,
  ...over,
})

describe("embudo de /admin (docs/275)", () => {
  it("es estricto y calcula % sobre la etapa anterior y sobre el total", () => {
    const list = [
      acc({ id: "a" }),
      acc({ id: "b", firstIngredientAt: "x" }),
      acc({ id: "c", firstIngredientAt: "x", firstCostAt: "x" }),
      acc({ id: "d", firstIngredientAt: "x", firstCostAt: "x", activeDays: ["2026-11-12"] }),
      acc({ id: "e", firstIngredientAt: "x", firstCostAt: "x", activeDays: ["2026-11-20"], paying: true, renewed: true }),
      acc({ id: "f", paying: true }), // paga pero nunca cargó un ingrediente: no cuenta después de «ingrediente»
    ]
    const s = summarizeFunnel(list, { now: NOW })
    expect(s.rows.map((r) => r.count)).toEqual([6, 4, 3, 2, 1, 1])
    expect(s.rows[1]).toMatchObject({ ofPrevious: 66.7, ofTotal: 66.7 })
    expect(s.rows[3].ofPrevious).toBe(66.7)
    expect(s.biggestDrop).toBe("ingredient")
  })

  it("«volvió» pide actividad desde 7 días después del alta", () => {
    expect(returnedAfterFirstWeek({ createdAt: "2026-11-01T10:00:00", activeDays: ["2026-11-03"] })).toBe(false)
    expect(returnedAfterFirstWeek({ createdAt: "2026-11-01T10:00:00", activeDays: ["2026-11-08"] })).toBe(true)
  })

  it("filtra por período y avisa cuántas cuentas son demasiado nuevas para volver", () => {
    const s = summarizeFunnel([acc({ id: "old", createdAt: "2026-09-01T00:00:00" }), acc({ id: "new", createdAt: "2026-11-27T00:00:00" })], { sinceDays: 30, now: NOW })
    expect(s.rows[0].count).toBe(1)
    expect(s.tooNewToReturn).toBe(1)
  })
})

describe("resultado de la invitación a volver (docs/275)", () => {
  it("útil = abrir y hacer algo en ese módulo dentro de 7 días", () => {
    const out = summarizeNudges(
      [
        { userId: "u1", module: "inventario", action: "nudge_shown", at: "2026-11-10T10:00:00" },
        { userId: "u1", module: "inventario", action: "nudge_opened", at: "2026-11-10T10:01:00" },
        { userId: "u2", module: "inventario", action: "nudge_shown", at: "2026-11-10T10:00:00" },
        { userId: "u2", module: "inventario", action: "nudge_opened", at: "2026-11-10T10:01:00" },
      ],
      [
        { userId: "u1", module: "inventario", at: "2026-11-12T09:00:00" },
        { userId: "u2", module: "inventario", at: "2026-11-25T09:00:00" }, // tarde: no cuenta
      ],
    )
    expect(out).toEqual([{ module: "inventario", shown: 2, opened: 2, useful: 1 }])
  })
})
