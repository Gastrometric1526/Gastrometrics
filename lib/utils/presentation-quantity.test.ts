import { describe, it, expect } from "vitest"
import { computePresentationQuantity } from "./presentation-quantity"

describe("computePresentationQuantity", () => {
  it("convierte cantidad base a unidades de presentacion, redondeando hacia arriba", () => {
    const result = computePresentationQuantity(
      { presentation: "Saco", unit: "gramos", pricing: { netContent: 25000 } },
      52000,
    )
    expect(result.presentation).toBe("Saco")
    expect(result.presentationQuantity).toBe(3) // 52000/25000 = 2.08 -> 3
  })

  it("una cantidad que cabe exacto no sube de mas", () => {
    const result = computePresentationQuantity(
      { presentation: "Caja", unit: "unidad", pricing: { netContent: 12 } },
      24,
    )
    expect(result.presentationQuantity).toBe(2)
  })

  it("sin presentacion configurada, devuelve null y conserva la cantidad base", () => {
    const result = computePresentationQuantity({ presentation: undefined, unit: "gramos", pricing: {} }, 500)
    expect(result.presentation).toBeNull()
    expect(result.presentationQuantity).toBeNull()
    expect(result.baseQuantity).toBe(500)
    expect(result.baseUnit).toBe("gramos")
  })

  it("presentacion configurada pero sin contenido neto valido tambien devuelve null", () => {
    const result = computePresentationQuantity(
      { presentation: "Bolsa", unit: "gramos", pricing: { netContent: 0 } },
      500,
    )
    expect(result.presentationQuantity).toBeNull()
  })
})

describe("envases con merma (docs/187)", () => {
  it("usa el contenido físico del envase, no el aprovechable", () => {
    // Saco de 1000 g con 20 % de merma (aprovechable 800 g). La cantidad que llega ya es bruta.
    const r = computePresentationQuantity({ presentation: "Saco", unit: "gramos", originalNetContent: 1000, pricing: { netContent: 800 } }, 1600)
    expect(r.presentationQuantity).toBe(2)
    const r2 = computePresentationQuantity({ presentation: "Saco", unit: "gramos", originalNetContent: 1000, pricing: { netContent: 800 } }, 1700)
    expect(r2.presentationQuantity).toBe(2) // antes: ceil(1700 / 800) = 3 sacos
  })
})
