import { describe, it, expect } from "vitest"
import { coverCommission, foodCostBasePrice, taxIncludedIn } from "./food-cost-pricing"

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

describe("coverCommission: la comisión se cubre también con ISV dentro del precio (docs/235)", () => {
  it("sin ISV es base ÷ (1 − comisión)", () => {
    expect(coverCommission(100, 20)).toBeCloseTo(125, 9)
    expect(coverCommission(100, 0)).toBe(100)
  })

  it("con ISV, después del impuesto y la comisión queda lo mismo que sin comisión", () => {
    const cost = 30
    const base = foodCostBasePrice(cost, 30, 15) // 115: venta neta 100, ganancia 70
    const price = coverCommission(base, 20, 15)
    const keep = price - taxIncludedIn(price, 15) - price * 0.2 - cost
    expect(keep).toBeCloseTo(70, 9) // antes: base ÷ 0.8 = 143.75 dejaba 66.25
  })

  it("nunca divide entre cero ni da negativos", () => {
    expect(coverCommission(100, 90, 100)).toBeCloseTo(1000, 9) // divisor mínimo 0.1
    expect(coverCommission(0, 20, 15)).toBe(0)
  })
})
