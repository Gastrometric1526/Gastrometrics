import { describe, expect, it } from "vitest"
import { packageOf, presentationText } from "./presentation-label"

describe("presentación con contenido neto (docs/323)", () => {
  const ings = [{ id: "a", name: "Leche de coco", unit: "mililitros", originalNetContent: 500, pricing: { netContent: 450 } }] as never[]
  it("usa el contenido físico del envase, no el aprovechable", () => {
    expect(packageOf({ ingredientId: "a" }, ings)).toEqual({ content: 500, unit: "mililitros" })
  })
  it("«3 latas de 500 ml» en cada idioma", () => {
    const pkg = { content: 500, unit: "mililitros" }
    expect(presentationText(3, "Lata", pkg, "es")).toBe("3 latas de 500 ml")
    expect(presentationText(1, "Lata", pkg, "es")).toBe("1 lata de 500 ml")
    expect(presentationText(null, "Lata", pkg, "es")).toBe("Lata de 500 ml")
    expect(presentationText(3, "Lata", null, "es")).toBe("3 latas")
    expect(presentationText(2, "Saco", { content: 25, unit: "kilogramos" }, "es")).toBe("2 sacos de 25 kg")
  })
  it("busca por nombre si la línea no tiene ingrediente", () => {
    expect(packageOf({ name: "leche de coco " }, ings)?.content).toBe(500)
  })
})
