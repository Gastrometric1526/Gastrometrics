import { describe, it, expect } from "vitest"
import { guessCategory } from "./guess-category"

describe("categoría sugerida (docs/146)", () => {
  it("reconoce palabras clave en varios idiomas y cae en OTROS si no sabe", () => {
    expect(guessCategory("pechuga de pollo")).toBe("AVES")
    expect(guessCategory("Aceite de oliva")).toBe("ACEITES")
    expect(guessCategory("cebollas")).toBe("VEGETAL")
    expect(guessCategory("olive oil")).toBe("ACEITES")
    expect(guessCategory("queijo")).toBe("LÁCTEOS Y DERIVADOS")
    expect(guessCategory("huevos")).toBe("HUEVO")
    expect(guessCategory("面粉")).toBe("HARINA")
    expect(guessCategory("xantana")).toBe("OTROS")
  })
})
