import { describe, expect, it } from "vitest"
import type { Recipe } from "@/types/recipe"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"
import { migrationPricePatch, migrationPriceRows, withBusinessRubros } from "./migration-price"
import { businessDefaultPercentages, DEFAULT_PRICING_PERCENTAGES } from "./pricing-percentages"

// Calculado a mano (docs/341). Costo por plato L 50, HNL (redondeo al 5 hacia arriba).
// Dashboard, 6 rubros de fábrica (10+10+30+25+0+30 = 105 %): 50 + 52.50 = 102.50 → L 105.
// Negocio con gastos L 20 000 al mes ÷ 1000 platos = L 20 por plato, rubros de gasto en 0:
// 50 + 50 × 30 % + 20 = 85 → L 85.
const dish = (over: Partial<Recipe> = {}): Recipe =>
  ({
    id: "r1",
    name: "Pollo",
    classification: "Plato fuerte",
    pricingMethod: "gastrometrics",
    yieldAmount: 1,
    totalCost: 50,
    costPerServing: 50,
    unitPrice: 105,
    publicServices: 10,
    marketing: 10,
    operationalCosts: 30,
    laborCosts: 25,
    isv: 0,
    contributionMargin: 30,
    ingredients: [],
    ...over,
  }) as unknown as Recipe

const ctx = { currencyCode: "HNL", fixedCostPerPlate: 20 }
const bizDefaults = businessDefaultPercentages(null, 20)

describe("predeterminados con gastos reales (docs/341)", () => {
  it("con costo fijo por plato, los cuatro rubros de gasto empiezan en 0; ISV y ganancia quedan", () => {
    expect(bizDefaults).toEqual({ ...DEFAULT_PRICING_PERCENTAGES, publicServices: 0, marketing: 0, operationalCosts: 0, laborCosts: 0 })
    expect(businessDefaultPercentages(null, 0)).toEqual(DEFAULT_PRICING_PERCENTAGES)
  })
  it("lo guardado a mano manda", () => {
    expect(businessDefaultPercentages({ publicServices: 5 }, 20).publicServices).toBe(5)
  })
})

describe("precio de las recetas migradas (docs/341)", () => {
  it("pregunta solo las que cambian, con el sugerido del negocio", () => {
    const rows = migrationPriceRows([dish(), dish({ id: "s1", classification: SUBRECIPE_CLASSIFICATION })], bizDefaults, ctx)
    expect(rows).toEqual([{ recipeId: "r1", name: "Pollo", currentPrice: 105, suggestedPrice: 85 }])
  })
  it("«el del negocio» pone los rubros del negocio y el sugerido", () => {
    const out = migrationPricePatch(dish(), "business", bizDefaults, ctx)
    expect(out.unitPrice).toBe(85)
    expect(out.customUnitPrice).toBeUndefined()
    expect([out.publicServices, out.marketing, out.operationalCosts, out.laborCosts]).toEqual([0, 0, 0, 0])
    expect(out.contributionMargin).toBe(30)
  })
  it("«el que tenía» lo deja como escrito a mano", () => {
    const out = migrationPricePatch(dish(), "mine", bizDefaults, ctx)
    expect(out.unitPrice).toBe(105)
    expect(out.customUnitPrice).toBe(105)
    expect(out.publicServices).toBe(10)
  })
  it("Food Cost % y ganancia escrita a mano no cambian de rubros", () => {
    expect(withBusinessRubros(dish({ pricingMethod: "food_cost" }), bizDefaults).publicServices).toBe(10)
    expect(withBusinessRubros(dish({ customUnitProfit: 40 }), bizDefaults).publicServices).toBe(10)
  })
})
