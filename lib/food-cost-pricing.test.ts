import { describe, it, expect } from "vitest"
import { foodCostBasePrice, taxIncludedIn } from "./food-cost-pricing"

describe("foodCostBasePrice: costo ÷ food cost objetivo, más ISV", () => {
  it("sin ISV es costo ÷ % objetivo", () => {
    expect(foodCostBasePrice(20, 30, 0)).toBeCloseTo(66.667, 3)
  })

  it("con ISV 15 % el precio lo incluye encima", () => {
    expect(foodCostBasePrice(20, 30, 15)).toBeCloseTo(76.667, 3)
  })

  it("sin costo u objetivo no hay precio", () => {
    expect(foodCostBasePrice(0, 30, 15)).toBe(0)
    expect(foodCostBasePrice(20, 0, 15)).toBe(0)
  })
})

describe("taxIncludedIn: parte del precio que es impuesto", () => {
  it("115 con 15 % incluye 15 de impuesto", () => {
    expect(taxIncludedIn(115, 15)).toBeCloseTo(15, 6)
  })

  it("sin ISV o sin precio es 0", () => {
    expect(taxIncludedIn(115, 0)).toBe(0)
    expect(taxIncludedIn(0, 15)).toBe(0)
  })

  it("el precio sin el impuesto vuelve al food cost objetivo", () => {
    const price = foodCostBasePrice(20, 30, 15)
    const net = price - taxIncludedIn(price, 15)
    expect((20 / net) * 100).toBeCloseTo(30, 6)
  })
})
