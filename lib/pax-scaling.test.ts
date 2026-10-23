import { describe, expect, it } from "vitest"
import { paxMultiplierFor, refreshSnapshotLines, roundUpToStep, scaleLineQuantity, scaleRecipeLine } from "./pax-scaling"
import { convertRecipeLines } from "./unit-change"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe, RecipeIngredient } from "@/types/recipe"

const line = (over: Partial<RecipeIngredient>): RecipeIngredient =>
  ({ id: "l1", ingredientId: "i1", name: "Sal", category: "SAL", quantity: 1, unit: "gramos", measure: "g", cost: 0, unitCost: 0, costPerMeasure: 0, extension: 0, ...over }) as RecipeIngredient

describe("Modificador de PAX (docs/189)", () => {
  it("multiplicador = personas ÷ rendimiento; sin PAX o sin rendimiento es 1", () => {
    expect(paxMultiplierFor(10, 4)).toBe(2.5)
    expect(paxMultiplierFor(0, 4)).toBe(1)
    expect(paxMultiplierFor(10, 0)).toBe(1)
  })

  it("kg/L/lb/gal redondean al gramo: 0.005 kg de sal × 2 = 0.010 kg (antes 0.1 kg, 10 veces más)", () => {
    expect(scaleLineQuantity(0.005, "kilogramos", 2)).toBe(0.01)
    expect(scaleLineQuantity(0.002, "kilogramos", 1.5)).toBe(0.003)
    expect(scaleLineQuantity(0.03, "litros", 2.5)).toBe(0.075)
    expect(scaleLineQuantity(0.0004, "kilogramos", 3)).toBe(0.0012) // 1.2 g: el escalón baja para no inflar cantidades mínimas (docs/190)
  })

  it("g/ml/oz/unidad redondean a 0.1 hacia arriba", () => {
    expect(scaleLineQuantity(250, "gramos", 1.2)).toBe(300)
    expect(scaleLineQuantity(3, "unidad", 2.5)).toBe(7.5)
    expect(scaleLineQuantity(7, "gramos", 1 / 3)).toBe(2.4) // 2.333… → 2.4
  })

  it("sin error de coma flotante: 0.1 × 3 = 0.3 (antes 0.4) y 0.4 kg × 3 = 1.2 kg (antes 1.3)", () => {
    expect(scaleLineQuantity(0.1, "gramos", 3)).toBe(0.3)
    expect(scaleLineQuantity(0.4, "kilogramos", 3)).toBe(1.2)
    expect(roundUpToStep(1.2, 0.1)).toBe(1.2)
  })

  it("con multiplicador 1 la línea no cambia; la extensión sale de la cantidad redondeada", () => {
    const l = line({ quantity: 0.005, unit: "kilogramos", unitCost: 40, extension: 0.2 })
    expect(scaleRecipeLine(l, 1)).toBe(l)
    const scaled = scaleRecipeLine(l, 2)
    expect(scaled.quantity).toBe(0.01)
    expect(scaled.extension).toBeCloseTo(0.4, 9)
  })
})

describe("Restaurar receta original (docs/189)", () => {
  const harina = { id: "i1", unit: "gramos", pricing: { pricePerUnit: 0.03 } } as unknown as Ingredient

  it("toma el precio de hoy del ingrediente", () => {
    const [r] = refreshSnapshotLines([line({ quantity: 200, unitCost: 0.02, extension: 4 })], [harina])
    expect(r.unitCost).toBe(0.03)
    expect(r.extension).toBeCloseTo(6, 9)
  })

  it("si el ingrediente cambió de unidad, convierte la cantidad (0.2 kg → 200 g)", () => {
    const [r] = refreshSnapshotLines([line({ quantity: 0.2, unit: "kilogramos", unitCost: 20 })], [harina])
    expect(r.quantity).toBe(200)
    expect(r.unit).toBe("gramos")
    expect(r.extension).toBeCloseTo(6, 9)
  })

  it("unidades que no se convierten (unidad ↔ g): la línea queda igual", () => {
    const l = line({ quantity: 2, unit: "unidad", unitCost: 5, extension: 10 })
    expect(refreshSnapshotLines([l], [harina])[0]).toBe(l)
  })

  it("el cambio de unidad de un ingrediente también convierte la copia original", () => {
    const recipe = {
      id: "r1",
      ingredients: [line({ quantity: 400, unit: "gramos" })],
      originalSnapshot: { yieldAmount: 4, ingredients: [line({ quantity: 200, unit: "gramos" })] },
    } as unknown as Recipe
    const [out] = convertRecipeLines([recipe], "i1", "kilogramos", 0.001)
    expect(out.ingredients[0].quantity).toBe(0.4)
    expect(out.originalSnapshot!.ingredients[0].quantity).toBe(0.2)
    expect(out.originalSnapshot!.ingredients[0].unit).toBe("kilogramos")
  })
})
