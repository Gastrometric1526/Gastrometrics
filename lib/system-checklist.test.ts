/**
 * Lista de pruebas de todo el sistema (pedido del dueño, docs/190): los puntos calculables
 * que no tenían una prueba propia. El resto de la lista ya está cubierto por las pruebas
 * de cada módulo (ver docs/190, tabla de resultados).
 */
import { describe, expect, it } from "vitest"
import { getMinimumPlanForFeature } from "./plan-access"
import { getPlanBySlug, getTeamInviteLimit, plans } from "./plans"
import { usableContentAfterMerma, calculateCategoryMerma } from "./merma-categories"
import { computeWeightedAverageCost } from "./utils/weighted-average-cost"
import { stockStatus, suggestedRestockQuantity } from "./inventory-status"
import { suggestedUnitPrice, currentUnitPrice, unitMarginPercent } from "./recipe-pricing"
import { roundSalePrice } from "./price-rounding"
import { computePresentationQuantity } from "./utils/presentation-quantity"
import { computeSupplierPriceVariance, classifyMenuEngineering } from "./sales-analytics"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"

const recipe = (over: Partial<Recipe>): Recipe => ({ id: "r", name: "r", ingredients: [], yieldAmount: 1, isv: 0, ...over }) as unknown as Recipe

describe("2. Planes y permisos", () => {
  it("2.1 Foodie no desbloquea funciones de pago", () => expect(getPlanBySlug("foodie").unlockedFeatures).toEqual([]))
  it("2.8 plan mínimo por función (para el candado)", () => {
    expect(getMinimumPlanForFeature("merma")?.slug).toBe("home-cook")
    expect(getMinimumPlanForFeature("price_import")?.slug).toBe("home-cook")
    expect(getMinimumPlanForFeature("inventory")?.slug).toBe("chef-de-partie")
    expect(getMinimumPlanForFeature("menus")?.slug).toBe("chef-de-partie")
    expect(getMinimumPlanForFeature("manual_sales")?.slug).toBe("chef-de-partie")
    expect(getMinimumPlanForFeature("stats_finance")?.slug).toBe("sous-chef")
    expect(getMinimumPlanForFeature("team")?.slug).toBe("sous-chef")
  })
  it("2.10 topes: negocios 1/1/1/2/5; invitados 0/0/0/1/4 (+ asientos extra de /admin)", () => {
    expect(plans.map((p) => p.maxBusinesses)).toEqual([1, 1, 1, 2, 5])
    expect(plans.map((p) => getTeamInviteLimit(p))).toEqual([0, 0, 0, 1, 4])
    expect(getTeamInviteLimit(getPlanBySlug("chef-ejecutivo"), 2)).toBe(6)
  })
  it("cada plan incluye todo lo del plan anterior (nunca se pierde una función al subir)", () => {
    for (let i = 1; i < plans.length; i++)
      for (const f of plans[i - 1].unlockedFeatures) expect(plans[i].unlockedFeatures).toContain(f)
  })
})

describe("3. Ingredientes", () => {
  it("3.4 merma %: 1000 g con 20 % → 800 g aprovechables", () => {
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "percentage", customPercentage: 20 }, "OTROS")).toBe(800)
  })
  it("3.5 merma por cantidad: 1000 g − 150 g = 850 g", () => {
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: false, customType: "quantity", customValue: 150 }, "OTROS")).toBe(850)
  })
  it("3.4 merma por categoría (global): pescado 52 % → 480 g de 1000", () => {
    expect(calculateCategoryMerma(1000, "PESCADO")).toBeCloseTo(480, 6)
    expect(usableContentAfterMerma(1000, { enabled: true, useGlobal: true }, "PESCADO")).toBeCloseTo(480, 6)
  })
  it("3.4 merma desactivada no cambia nada; nunca baja de 0.1", () => {
    expect(usableContentAfterMerma(1000, { enabled: false }, "PESCADO")).toBe(1000)
    expect(usableContentAfterMerma(100, { enabled: true, useGlobal: false, customType: "quantity", customValue: 500 }, "OTROS")).toBe(0.1)
  })
  it("3.8 promedio ponderado móvil: 1000 g a 0.10 + compra de 500 g a 0.16 → 0.12", () => {
    const r = computeWeightedAverageCost({ previousStock: 1000, newStock: 1500, purchasePrice: 80, netContent: 500, previousWeightedAverageCost: 0.1, previousWeightedAverageQuantity: 1000 })
    expect(r.weightedAverageCost).toBeCloseTo(0.12, 9)
  })
  it("3.9 precio 0: sin precio sugerido ni error", () => {
    expect(suggestedUnitPrice(recipe({ pricingMethod: "food_cost", targetFoodCostPercent: 30 }), 0, { currencyCode: "HNL" })).toBe(0)
    expect(unitMarginPercent(recipe({}), 0, 10)).toBe(0)
  })
})

describe("4. Ficha Técnica: precio", () => {
  it("4.5 Food Cost %: costo 30, objetivo 30 %, ISV 15 %, comisión 10 % → 100 × 1.15 ÷ 0.9 = 127.78 → L130", () => {
    const r = recipe({ pricingMethod: "food_cost", targetFoodCostPercent: 30, isv: 15, salesCommissionPercent: 10 })
    expect(suggestedUnitPrice(r, 30, { currencyCode: "HNL" })).toBe(130)
  })
  it("4.6 6 rubros: costo 100 con 10+10+30+25+0+30 = 105 % → 205 → L205; en USD $205.00", () => {
    const r = recipe({ pricingMethod: "gastrometrics", publicServices: 10, marketing: 10, operationalCosts: 30, laborCosts: 25, contributionMargin: 30 })
    expect(suggestedUnitPrice(r, 100, { currencyCode: "HNL" })).toBe(205)
    expect(suggestedUnitPrice(r, 100, { currencyCode: "USD" })).toBe(205)
  })
  it("4.6 un rubro en 0 % se respeta (no vuelve al valor por defecto)", () => {
    const r = recipe({ pricingMethod: "gastrometrics", publicServices: 0, marketing: 0, operationalCosts: 0, laborCosts: 0, contributionMargin: 50 })
    expect(suggestedUnitPrice(r, 100, { currencyCode: "USD" })).toBe(150)
  })
  it("4.7 el precio escrito a mano manda sobre el sugerido", () => {
    expect(currentUnitPrice(recipe({ unitPrice: 120, customUnitPrice: 99 }))).toBe(99)
    expect(currentUnitPrice(recipe({ unitPrice: 120 }))).toBe(120)
  })
})

describe("7. Inventario: semáforo", () => {
  it.each([
    [null, 10, "normal"],
    [0, 10, "critical"],
    [10, 10, "critical"],
    [15, 10, "low"],
    [20, 10, "low"],
    [21, 10, "normal"],
    [0, 0, "critical"],
    [5, 0, "normal"],
  ])("stock %s con mínimo %s → %s", (stock, min, expected) => {
    expect(stockStatus(stock as number | null, min as number)).toBe(expected)
  })
})

describe("9. Órdenes de compra", () => {
  it("9.1 sugerida por stock bajo: máx(2 × mínimo − stock, mínimo)", () => {
    expect(suggestedRestockQuantity(0, 10)).toBe(20)
    expect(suggestedRestockQuantity(9, 10)).toBe(11)
    expect(suggestedRestockQuantity(15, 10)).toBe(10) // nunca menos que el mínimo
    expect(suggestedRestockQuantity(null, 10)).toBe(20)
  })
  it("9.7 envases: techo(cantidad ÷ contenido físico)", () => {
    const harina = { presentation: "Saco", unit: "gramos", pricing: { netContent: 20000 }, originalNetContent: 25000 } as unknown as Ingredient
    expect(computePresentationQuantity(harina, 50001).presentationQuantity).toBe(3)
    expect(computePresentationQuantity(harina, 50000).presentationQuantity).toBe(2)
  })
})

describe("11. Reportes", () => {
  it("11.7 varianza de proveedor: solo desde ±5 %", () => {
    const ing = (id: string, current: number, avg: number) => ({ id, name: id, supplier: "", pricing: { pricePerUnit: current, weightedAverageCost: avg } }) as unknown as Ingredient
    const out = computeSupplierPriceVariance([ing("a", 1.05, 1), ing("b", 1.049, 1), ing("c", 0.9, 1)])
    expect(out.map((e) => e.ingredientId)).toEqual(["c", "a"])
  })
  it("11.3 Menu Engineering: los 4 cuadrantes (Kasavana y Smith)", () => {
    const d = (id: string, quantitySold: number, unitMargin: number) => ({ recipeId: id, name: id, quantitySold, revenue: 0, theoreticalCost: 0, contributionMargin: unitMargin * quantitySold, contributionMarginPercent: 0 })
    // 4 platos, 100 unidades → venta pareja 25, umbral 17.5; margen promedio ponderado = (40·10+40·4+10·10+10·4)/100 = 7.
    const out = classifyMenuEngineering([d("estrella", 40, 10), d("vaca", 40, 4), d("puzzle", 10, 10), d("perro", 10, 4)] as never)
    expect(Object.fromEntries(out.map((e) => [e.name, e.classification]))).toEqual({ estrella: "estrella", vaca: "vaca", puzzle: "puzzle", perro: "perro" })
  })
})

describe("16. Moneda", () => {
  it("16.4 redondeo hacia arriba según moneda", () => {
    expect(roundSalePrice(101, "HNL")).toBe(105)
    expect(roundSalePrice(10.6, "USD")).toBe(11)
    expect(roundSalePrice(10.4, "USD")).toBe(10.5)
  })
})
