import { describe, it, expect } from "vitest"
import {
  bottleFractionFromWeight,
  computeServingCost,
  getBarKind,
  getPackageContent,
  isBarClassification,
  isBeverageCategory,
  priceForTargetCost,
  toPackages,
} from "./beverage"
import { roundSalePrice } from "./price-rounding"
import { classifications } from "@/types/recipe"
import { categories } from "@/types/ingredient"
import { mermaPorCategoria } from "./merma-categories"

// Vino $20, botella 750 ml, 5 % de merma: la merma reduce netContent a 712.5 ml y el
// precio por ml queda 20 / 712.5 (mismo modelo que components/merma-management-dialog).
const wine = {
  unit: "mililitros" as const,
  originalNetContent: 750,
  pricing: { purchasePrice: 20, netContent: 712.5, pricePerUnit: 20 / 712.5, lastUpdated: "" },
}

describe("clasificaciones y categorías de barra (docs/136)", () => {
  it("todas las clasificaciones de barra existen en la lista de recetas", () => {
    for (const kind of ["cocktails", "wine", "beer", "non_alcoholic", "coffee"] as const) {
      const value = classifications.find((c) => getBarKind(c) === kind)
      expect(value, kind).toBeTruthy()
    }
    expect(isBarClassification("Línea caliente (Cuisine chaude)")).toBe(false)
    expect(isBarClassification("")).toBe(false)
  })

  it("las categorías de barra existen y tienen merma por defecto", () => {
    for (const category of ["DESTILADOS", "VINOS", "CERVEZA DE BARRIL", "CERVEZA EMBOTELLADA", "REFRESCOS Y MIXERS"]) {
      expect((categories as readonly string[]).includes(category), category).toBe(true)
      expect(mermaPorCategoria[category], category).toBeTypeOf("number")
      expect(isBeverageCategory(category)).toBe(true)
    }
    expect(mermaPorCategoria["CERVEZA DE BARRIL"]).toBe(18)
    expect(isBeverageCategory("RES")).toBe(false)
  })

  it("ALCOHOL y BEBIDAS mantienen su merma (no se recalculan costos guardados)", () => {
    expect(mermaPorCategoria.ALCOHOL).toBe(0)
    expect(mermaPorCategoria.BEBIDAS).toBe(2)
  })
})

describe("computeServingCost", () => {
  it("copa de 150 ml incluye la merma", () => {
    const serving = computeServingCost(wine, 150)!
    expect(serving.quantity).toBe(150)
    expect(serving.cost).toBeCloseTo((150 * 20) / 712.5, 6) // ≈ 4.21
    expect(serving.servingsPerPackage).toBeCloseTo(4.75, 6)
  })

  it("botella entera cuesta exactamente el precio de compra", () => {
    const serving = computeServingCost(wine, null)!
    expect(serving.cost).toBeCloseTo(20, 6)
    expect(serving.servingsPerPackage).toBe(1)
  })

  it("convierte de litros: 45 ml de gin comprado en litros", () => {
    const gin = { unit: "litros" as const, pricing: { purchasePrice: 25, netContent: 0.7, pricePerUnit: 25 / 0.7, lastUpdated: "" } }
    const serving = computeServingCost(gin, 45)!
    expect(serving.quantity).toBeCloseTo(0.045, 6)
    expect(serving.cost).toBeCloseTo(1.607, 3)
  })

  it("unidad que no es de volumen solo permite el envase completo", () => {
    const beer = { unit: "unidad" as const, pricing: { purchasePrice: 1.2, netContent: 1, pricePerUnit: 1.2, lastUpdated: "" } }
    expect(computeServingCost(beer, 330)).toBeNull()
    expect(computeServingCost(beer, null)!.cost).toBeCloseTo(1.2, 6)
  })

  it("ejemplo del Gin Tonic: costo ÷ pour cost, redondeado según la moneda", () => {
    const cost = 1.69 + 0.55 + 0.1
    expect(priceForTargetCost(cost, 22)).toBeCloseTo(10.636, 3)
    expect(roundSalePrice(priceForTargetCost(cost, 22), "USD")).toBe(11)
    expect(priceForTargetCost(0, 22)).toBe(0)
  })
})

describe("conteo de barra", () => {
  it("el contenido de envase es el físico, sin merma", () => {
    expect(getPackageContent(wine)).toBe(750)
    expect(toPackages(1725, 750)).toBeCloseTo(2.3, 6)
    expect(toPackages(10, 0)).toBeNull()
  })

  it("fracción de botella por peso: (peso − vacía) ÷ (llena − vacía)", () => {
    const weights = { fullG: 1200, emptyG: 500 }
    expect(bottleFractionFromWeight(850, weights)).toBeCloseTo(0.5, 6)
    expect(bottleFractionFromWeight(400, weights)).toBe(0)
    expect(bottleFractionFromWeight(1300, weights)).toBe(1)
    expect(bottleFractionFromWeight(850, { fullG: 500, emptyG: 500 })).toBeNull()
    expect(bottleFractionFromWeight(850, null)).toBeNull()
  })
})
