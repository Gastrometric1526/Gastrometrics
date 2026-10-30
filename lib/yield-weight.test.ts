import { describe, expect, it } from "vitest"
import { estimateYieldWeightGrams, formatYieldWeight } from "./yield-weight"

describe("rendimiento en peso (docs/208)", () => {
  it("convierte a gramos y no suma piezas", () => {
    const lines = [
      { quantity: 0.16, unit: "kilogramos" },
      { quantity: 1, unit: "unidad" },
      { quantity: 0.04, unit: "kilogramos" },
      { quantity: 0.03, unit: "litros" },
      { quantity: 50, unit: "gramos" },
    ]
    expect(estimateYieldWeightGrams(lines)).toBeCloseTo(280)
    expect(estimateYieldWeightGrams(lines, 10)).toBeCloseTo(2800)
    expect(formatYieldWeight(280)).toBe("280 g")
    expect(formatYieldWeight(2800)).toBe("2.80 kg")
    expect(formatYieldWeight(0)).toBe("")
    expect(estimateYieldWeightGrams([{ quantity: 2, unit: "unidad" }])).toBe(0)
  })
})
