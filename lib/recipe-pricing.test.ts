import { describe, expect, it } from "vitest"
import { applyPriceRule, suggestedUnitPrice, unitCostPercent, unitMarginAmount, unitMarginPercent } from "./recipe-pricing"
import type { Recipe } from "@/types/recipe"

const base = (over: Partial<Recipe> = {}): Recipe =>
  ({
    id: "r1",
    name: "Pollo a la plancha",
    ingredients: [],
    yieldAmount: 1,
    pricingMethod: "food_cost",
    targetFoodCostPercent: 30,
    isv: 0,
    ...over,
  }) as unknown as Recipe

const HNL = { currencyCode: "HNL" }

describe("suggestedUnitPrice", () => {
  it("Food Cost %: costo ÷ objetivo, redondeado hacia arriba al escalón de 5 en lempiras", () => {
    expect(suggestedUnitPrice(base(), 36, HNL)).toBe(120) // 36 / 0.30 = 120
    expect(suggestedUnitPrice(base(), 37, HNL)).toBe(125) // 123.33 → 125
  })
  it("Food Cost % con ISV y comisión", () => {
    // 30 / 0.30 = 100 × 1.15 = 115 ÷ (1 − 0.30) = 164.29 → 165
    expect(suggestedUnitPrice(base({ isv: 15, salesCommissionPercent: 30 }), 30, HNL)).toBe(165)
  })
  it("Seis rubros (recetas antiguas): costo + rubros sobre el costo", () => {
    // 100 + 100 × (10+10+30+25+0+30)% = 205 → 205
    expect(suggestedUnitPrice(base({ pricingMethod: "gastrometrics" }), 100, HNL)).toBe(205)
  })
  it("un rubro en 0 % se respeta (antes volvía al valor por defecto, docs/187)", () => {
    // 100 + 100 × (0+0+30+25+0+30)% = 185
    expect(suggestedUnitPrice(base({ pricingMethod: "gastrometrics", publicServices: 0, marketing: 0 }), 100, HNL)).toBe(185)
  })
})

describe("applyPriceRule", () => {
  it("si el precio sugerido sube por encima del actual, el precio sube y vuelve a seguir al sugerido", () => {
    const r = base({ unitPrice: 120 })
    const out = applyPriceRule(r, 36, 45, HNL) // 45 / 0.30 = 150
    expect(out.kind).toBe("raised")
    if (out.kind === "raised") {
      expect(out.oldPrice).toBe(120)
      expect(out.newPrice).toBe(150)
      expect(out.patch.unitPrice).toBe(150)
      expect(out.patch.customUnitPrice).toBeUndefined()
    }
  })

  it("también sube por encima de un precio escrito a mano si el costo lo deja corto", () => {
    const out = applyPriceRule(base({ unitPrice: 130, customUnitPrice: 130 }), 36, 45, HNL)
    expect(out.kind).toBe("raised")
  })

  it("si el costo baja, el precio NO baja: queda como precio escrito a mano y el margen sube", () => {
    const r = base({ unitPrice: 120 })
    const out = applyPriceRule(r, 36, 30, HNL) // sugerido bajaría a 100
    expect(out.kind).toBe("kept")
    if (out.kind === "kept") {
      expect(out.price).toBe(120)
      expect(out.patch.customUnitPrice).toBe(120)
      expect(out.patch.unitPrice).toBe(120)
      expect(out.newMargin).toBeGreaterThan(out.oldMargin)
      expect(Math.round(out.oldMargin)).toBe(70) // (120 − 36) / 120
      expect(Math.round(out.newMargin)).toBe(75) // (120 − 30) / 120
    }
  })

  it("si el costo sube pero el precio actual todavía lo cubre, no cambia nada", () => {
    const out = applyPriceRule(base({ unitPrice: 200, customUnitPrice: 200 }), 36, 40, HNL) // sugerido 135 < 200
    expect(out.kind).toBe("none")
  })

  it("recetas sin precio todavía no se tocan", () => {
    expect(applyPriceRule(base(), 36, 30, HNL).kind).toBe("none")
  })
})

describe("unitMarginPercent", () => {
  it("en Food Cost descuenta el ISV incluido y la comisión", () => {
    // precio 115 con ISV 15 % → venta neta 100; costo 30 → margen 70 %
    expect(Math.round(unitMarginPercent(base({ isv: 15 }), 115, 30))).toBe(70)
  })
})

describe("unitMarginAmount / unitCostPercent (docs/188: Dashboard y Estadísticas = Ficha)", () => {
  it("Food Cost % con ISV incluido y comisión: L115 → ISV 15, venta neta 100, comisión 11.5", () => {
    const r = base({ isv: 15, salesCommissionPercent: 10 })
    expect(unitMarginAmount(r, 115, 30)).toBeCloseTo(58.5, 6)
    expect(unitCostPercent(r, 115, 30)).toBeCloseTo(30, 6)
  })
  it("6 rubros: el ISV es un rubro sobre el costo, no se descuenta del precio", () => {
    const r = base({ pricingMethod: "gastrometrics", isv: 15 })
    expect(unitMarginAmount(r, 100, 40)).toBeCloseTo(60, 6)
    expect(unitCostPercent(r, 100, 40)).toBeCloseTo(40, 6)
  })
  it("sin precio no hay margen ni costo %", () => {
    expect(unitMarginAmount(base(), 0, 10)).toBe(0)
    expect(unitCostPercent(base(), 0, 10)).toBe(0)
  })
})
