import { describe, expect, it } from "vitest"
import { pendingSuggestions, suggestAllergens } from "./allergen-suggest"

const keys = (name: string, category?: string) => suggestAllergens({ name, category }).map((s) => s.key).sort()

describe("alérgenos sugeridos (docs/324)", () => {
  it("por categoría", () => {
    expect(keys("Harina todo uso", "HARINA")).toEqual(["gluten"])
    expect(keys("Queso fresco", "LÁCTEOS Y DERIVADOS")).toEqual(["milk"])
    expect(keys("Camarón", "MARISCOS")).toEqual(["crustaceans", "molluscs"])
  })
  it("excepciones: harina de arroz y de maíz no tienen gluten; la de almendra, frutos secos", () => {
    expect(keys("Harina de arroz", "HARINA")).toEqual([])
    expect(keys("Harina de maíz", "HARINA")).toEqual([])
    expect(keys("Pasta sin gluten", "FIDEOS")).toEqual([])
    expect(keys("Harina de almendra", "HARINA")).toEqual(["tree_nuts"])
    expect(keys("Leche de coco", "LÁCTEOS Y DERIVADOS")).toEqual([])
  })
  it("por nombre, en varios idiomas y sin acentos", () => {
    expect(keys("Salsa de soya", "SECOS Y ABARROTES")).toEqual(["soy"])
    expect(keys("Maní tostado", "SECOS Y ABARROTES")).toEqual(["peanuts"])
    expect(keys("Wheat flour")).toEqual(["gluten"])
    expect(keys("Ajonjolí")).toEqual(["sesame"])
    expect(keys("Panela")).toEqual([]) // «pan» solo como palabra entera
  })
  it("lo ya marcado no se vuelve a sugerir", () => {
    expect(pendingSuggestions({ name: "Harina", category: "HARINA", allergens: ["gluten"] })).toEqual([])
  })
})
