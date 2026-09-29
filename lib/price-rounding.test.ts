import { describe, it, expect } from "vitest"
import { roundSalePrice, roundUpToStep, getPriceRoundingStep } from "./price-rounding"

describe("roundSalePrice: redondeo del precio sugerido según la moneda (docs/136)", () => {
  it("HNL conserva la regla original: hacia el 5 más alto", () => {
    expect(roundSalePrice(133.72, "HNL")).toBe(135)
    expect(roundSalePrice(130, "HNL")).toBe(130)
  })

  it("USD y EUR suben al 0.50 siguiente, no al 5 (un trago de 10.60 no se vuelve 15)", () => {
    expect(roundSalePrice(10.6, "USD")).toBe(11)
    expect(roundSalePrice(10.2, "USD")).toBe(10.5)
    expect(roundSalePrice(12.2, "EUR")).toBe(12.5)
    expect(roundSalePrice(10.5, "EUR")).toBe(10.5)
  })

  it("monedas de valores grandes usan escalones grandes", () => {
    expect(roundSalePrice(2301, "CRC")).toBe(2400)
    expect(roundSalePrice(18200, "COP")).toBe(18500)
    expect(roundSalePrice(41001, "PYG")).toBe(42000)
  })

  it("nunca redondea hacia abajo y 0 queda en 0", () => {
    expect(roundSalePrice(0.01, "USD")).toBe(0.5)
    expect(roundSalePrice(0, "USD")).toBe(0)
    expect(roundUpToStep(-3, 5)).toBe(0)
  })

  it("moneda desconocida usa escalón 1", () => {
    expect(getPriceRoundingStep("XYZ")).toBe(1)
    expect(roundSalePrice(7.2, "XYZ")).toBe(8)
  })

  it("no sube un escalón de más por errores de coma flotante", () => {
    expect(roundUpToStep(10.5, 0.5)).toBe(10.5)
    expect(roundUpToStep(0.3 * 3, 0.1)).toBe(0.9)
  })
})
