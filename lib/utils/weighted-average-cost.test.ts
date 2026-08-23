import { describe, it, expect } from "vitest"
import { computeWeightedAverageCost } from "./weighted-average-cost"

// Cubre el método de costo móvil agregado esta sesión (register-inventory-modal.tsx):
// cada compra pondera el costo por unidad contra la cantidad ya comprada históricamente.
describe("computeWeightedAverageCost", () => {
  it("la primera compra registrada establece el promedio en su propio costo por unidad", () => {
    const result = computeWeightedAverageCost({
      previousStock: 0,
      newStock: 1000,
      purchasePrice: 32,
      netContent: 1000,
      previousWeightedAverageCost: undefined,
      previousWeightedAverageQuantity: 0,
    })

    // 32 / 1000 = 0.032 por gramo
    expect(result.weightedAverageCost).toBeCloseTo(0.032, 6)
    expect(result.weightedAverageQuantity).toBe(1000)
  })

  it("una segunda compra a precio distinto pondera el promedio por cantidad, no por partes iguales", () => {
    // Replica el caso verificado en vivo esta sesion: 1000g a L32 (0.032/g), luego
    // 500g mas (total 1500g) a L40 el paquete de 1000g (0.04/g).
    const result = computeWeightedAverageCost({
      previousStock: 1000,
      newStock: 1500,
      purchasePrice: 40,
      netContent: 1000,
      previousWeightedAverageCost: 0.032,
      previousWeightedAverageQuantity: 1000,
    })

    // (1000*0.032 + 500*0.04) / 1500 = 0.034666...
    expect(result.weightedAverageCost).toBeCloseTo(0.034667, 5)
    expect(result.weightedAverageQuantity).toBe(1500)
  })

  it("si el stock no aumento (conteo igual o menor) no hay compra que ponderar, el promedio no cambia", () => {
    const result = computeWeightedAverageCost({
      previousStock: 1000,
      newStock: 800,
      purchasePrice: 999,
      netContent: 1000,
      previousWeightedAverageCost: 0.032,
      previousWeightedAverageQuantity: 1000,
    })

    expect(result.weightedAverageCost).toBe(0.032)
    expect(result.weightedAverageQuantity).toBe(1000)
  })

  it("contenido neto en 0 o indefinido no revienta la division (usa 1 como base)", () => {
    const result = computeWeightedAverageCost({
      previousStock: 0,
      newStock: 10,
      purchasePrice: 50,
      netContent: 0,
      previousWeightedAverageCost: undefined,
      previousWeightedAverageQuantity: 0,
    })

    expect(result.weightedAverageCost).toBe(50)
  })
})
