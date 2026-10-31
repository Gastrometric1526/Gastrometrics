import { describe, expect, it } from "vitest"
import { parseTourPart, splitTourParts, tourPartKey } from "./tour-parts"

describe("tutorial por partes (docs/220)", () => {
  it("divide en partes de 3 y une un último paso suelto a la parte anterior", () => {
    expect(splitTourParts(9)).toEqual([[0, 3], [3, 6], [6, 9]])
    expect(splitTourParts(8)).toEqual([[0, 3], [3, 6], [6, 8]])
    expect(splitTourParts(7)).toEqual([[0, 3], [3, 7]])
    expect(splitTourParts(4)).toEqual([[0, 4]])
  })

  it("un recorrido corto o sin partes (Infinity) es una sola parte", () => {
    expect(splitTourParts(3)).toEqual([[0, 3]])
    expect(splitTourParts(12, Infinity)).toEqual([[0, 12]])
    expect(splitTourParts(0)).toEqual([])
  })

  it("lee la parte guardada", () => {
    expect(tourPartKey("tour_completed_menus")).toBe("tour_completed_menus_part")
    expect(parseTourPart(null)).toBe(0)
    expect(parseTourPart("2")).toBe(2)
    expect(parseTourPart("x")).toBe(0)
    expect(parseTourPart("-1")).toBe(0)
  })
})
