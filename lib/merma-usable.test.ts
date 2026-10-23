import { describe, expect, it } from "vitest"
import { usableContentAfterMerma, getCategoryMermaPercentage } from "./merma-categories"

describe("contenido aprovechable con merma (docs/187)", () => {
  it("sin merma activa, el contenido no cambia", () => {
    expect(usableContentAfterMerma(1000, undefined, "RES")).toBe(1000)
    expect(usableContentAfterMerma(1000, { enabled: false }, "RES")).toBe(1000)
  })
  it("merma personalizada por porcentaje o por cantidad", () => {
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "percentage", customPercentage: 20 }, "RES")).toBe(800)
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "quantity", customValue: 150 }, "RES")).toBe(850)
  })
  it("merma global de la categoría", () => {
    const pct = getCategoryMermaPercentage("RES")
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: true }, "RES")).toBeCloseTo(1000 * (1 - pct / 100), 6)
  })
})
