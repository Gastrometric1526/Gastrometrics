import { describe, expect, it } from "vitest"
import { lockedBusinessIds, membersWithoutSeat } from "./plan-locks"

const businesses = [
  { id: "c", created_at: "2026-03-01T00:00:00Z" },
  { id: "a", created_at: "2026-01-01T00:00:00Z" },
  { id: "b", created_at: "2026-02-01T00:00:00+00:00" },
]

describe("lockedBusinessIds", () => {
  it("deja activos los más antiguos, hasta el tope", () => {
    expect(lockedBusinessIds(businesses, 2)).toEqual(["c"])
  })
  it("sin exceso no bloquea nada", () => {
    expect(lockedBusinessIds(businesses, 5)).toEqual([])
  })
})

describe("membersWithoutSeat", () => {
  it("con tope 0 ningún invitado conserva su lugar", () => {
    expect(membersWithoutSeat([{ id: "m", invited_at: "2026-01-01T00:00:00Z" }], 0)).toEqual(["m"])
  })
  it("conserva a los invitados más antiguos", () => {
    expect(
      membersWithoutSeat(
        [
          { id: "n", invited_at: "2026-02-01T00:00:00Z" },
          { id: "m", invited_at: "2026-01-01T00:00:00Z" },
        ],
        1,
      ),
    ).toEqual(["n"])
  })
})
