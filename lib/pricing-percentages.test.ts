import { describe, expect, it } from "vitest"
import {
  DEFAULT_PRICING_PERCENTAGES,
  expensesPercent,
  normalizePricingPercentages,
  samePricingPercentages,
  totalMarkupPercent,
} from "./pricing-percentages"

describe("pricing percentages (docs/226)", () => {
  it("completa con los valores de fábrica", () => {
    expect(normalizePricingPercentages(null)).toEqual(DEFAULT_PRICING_PERCENTAGES)
    expect(normalizePricingPercentages({ isv: 15 })).toEqual({ ...DEFAULT_PRICING_PERCENTAGES, isv: 15 })
  })

  it("respeta el 0 y limita a 0–100", () => {
    const p = normalizePricingPercentages({ marketing: 0, laborCosts: 150, publicServices: -5, isv: "12.5", operationalCosts: "x" })
    expect(p.marketing).toBe(0)
    expect(p.laborCosts).toBe(100)
    expect(p.publicServices).toBe(0)
    expect(p.isv).toBe(12.5)
    expect(p.operationalCosts).toBe(DEFAULT_PRICING_PERCENTAGES.operationalCosts)
  })

  it("suma gastos y el total sobre el costo", () => {
    expect(expensesPercent(DEFAULT_PRICING_PERCENTAGES)).toBe(75)
    expect(totalMarkupPercent(DEFAULT_PRICING_PERCENTAGES)).toBe(105)
  })

  it("compara con tolerancia de redondeo", () => {
    expect(samePricingPercentages(DEFAULT_PRICING_PERCENTAGES, { ...DEFAULT_PRICING_PERCENTAGES, isv: 0.001 })).toBe(true)
    expect(samePricingPercentages(DEFAULT_PRICING_PERCENTAGES, { ...DEFAULT_PRICING_PERCENTAGES, isv: 15 })).toBe(false)
  })
})
