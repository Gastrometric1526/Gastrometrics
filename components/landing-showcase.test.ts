import { describe, expect, it } from "vitest"
import { __test } from "./landing-showcase"

// La historia de la landing (docs/193) cuenta la regla real de precios de docs/162: el precio
// solo sube, y solo cuando el costo nuevo deja el food cost por encima del objetivo.
describe("landing: historia de precios", () => {
  for (const lang of ["es", "en"] as const) {
    it(`[${lang}] el precio nunca baja y solo sube si el costo lo deja corto`, () => {
      const m = __test.priceModel(lang)
      for (const d of m.dishes) {
        expect(d.after).toBeGreaterThan(d.before)
        expect(d.priceAfter).toBeGreaterThanOrEqual(d.priceBefore)
        if (d.priceAfter === d.priceBefore) expect(d.after / d.priceBefore).toBeLessThanOrEqual(0.3 + 1e-9)
        else expect(d.after / d.priceBefore).toBeGreaterThan(0.3)
        // Con el precio nuevo, el food cost queda dentro del objetivo.
        expect(d.after / d.priceAfter).toBeLessThanOrEqual(0.3 + 1e-9)
      }
    })
  }

  it("en lempiras muestra un plato que sube y uno que se mantiene", () => {
    const m = __test.priceModel("es")
    expect(m.dishes.some((d) => d.priceAfter > d.priceBefore)).toBe(true)
    expect(m.dishes.some((d) => d.priceAfter === d.priceBefore)).toBe(true)
  })

})
