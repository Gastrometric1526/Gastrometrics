import { describe, expect, it } from "vitest"
import { publicSalePrice, realCostWithWaste } from "./public-calculator"
import { suggestedUnitPrice } from "./recipe-pricing"
import type { Recipe } from "@/types/recipe"

describe("calculadora pública (docs/178)", () => {
  it("food cost 30 %: L 60 → L 200", () => {
    const r = publicSalePrice({ unitCost: 60, targetFoodCostPercent: 30, isvPercent: 0, commissionPercent: 0, currencyCode: "HNL" })!
    expect(r.price).toBe(200)
    expect(r.profit).toBe(140)
    expect(r.realFoodCostPercent).toBeCloseTo(30, 5)
  })

  it("comisión de delivery 30 %: L 60 → L 286 → L 290 redondeado a 5", () => {
    const r = publicSalePrice({ unitCost: 60, targetFoodCostPercent: 30, isvPercent: 0, commissionPercent: 30, currencyCode: "HNL" })!
    expect(r.beforeRounding).toBeCloseTo(285.714, 2)
    expect(r.price).toBe(290)
    expect(r.commission).toBeCloseTo(87, 5)
  })

  it("ISV 18 % sobre el precio (mojito L 40, food cost 20 %) → L 240", () => {
    const r = publicSalePrice({ unitCost: 40, targetFoodCostPercent: 20, isvPercent: 18, commissionPercent: 0, currencyCode: "HNL" })!
    expect(r.beforeRounding).toBeCloseTo(236, 5)
    expect(r.price).toBe(240)
  })

  it("en dólares redondea a 0.50", () => {
    const r = publicSalePrice({ unitCost: 3.2, targetFoodCostPercent: 30, isvPercent: 0, commissionPercent: 0, currencyCode: "USD" })!
    expect(r.price).toBe(11)
  })

  it("da lo mismo que la Ficha Técnica con el método Food Cost %", () => {
    const recipe = { pricingMethod: "food_cost", targetFoodCostPercent: 32, isv: 15, salesCommissionPercent: 25 } as unknown as Recipe
    const app = suggestedUnitPrice(recipe, 47.5, { currencyCode: "HNL" } as never)
    const pub = publicSalePrice({ unitCost: 47.5, targetFoodCostPercent: 32, isvPercent: 15, commissionPercent: 25, currencyCode: "HNL" })!
    expect(pub.price).toBe(app)
  })

  it("sin costo u objetivo no calcula", () => {
    expect(publicSalePrice({ unitCost: 0, targetFoodCostPercent: 30, isvPercent: 0, commissionPercent: 0, currencyCode: "HNL" })).toBeNull()
    expect(publicSalePrice({ unitCost: 10, targetFoodCostPercent: 0, isvPercent: 0, commissionPercent: 0, currencyCode: "HNL" })).toBeNull()
  })

  it("costo real con merma: tomate L 32 con 10 % → L 35.56", () => {
    expect(realCostWithWaste(32, 10)).toBeCloseTo(35.556, 2)
    expect(realCostWithWaste(0, 10)).toBeNull()
    expect(realCostWithWaste(100, 200)).toBeCloseTo(2000, 5) // la merma se limita a 95 %
  })
})
