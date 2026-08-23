import { describe, it, expect } from "vitest"
import { roundToNearestFive } from "./index"

// Regla de negocio confirmada (ver CLAUDE.md): "un solo redondeo, en precio de venta
// unitario, hacia el 5 más alto" — nunca L133.72, siempre algo como L135.00.
describe("roundToNearestFive: redondeo de precio de venta hacia el 5 mas alto", () => {
  it("redondea hacia arriba al multiplo de 5 mas cercano", () => {
    expect(roundToNearestFive(133.72)).toBe(135)
    expect(roundToNearestFive(131)).toBe(135)
    expect(roundToNearestFive(126)).toBe(130)
  })

  it("un valor que ya es multiplo de 5 se queda igual (no sube de mas)", () => {
    expect(roundToNearestFive(130)).toBe(130)
    expect(roundToNearestFive(0)).toBe(0)
  })

  it("nunca redondea hacia abajo", () => {
    expect(roundToNearestFive(130.01)).toBe(135)
    expect(roundToNearestFive(1)).toBe(5)
  })
})
