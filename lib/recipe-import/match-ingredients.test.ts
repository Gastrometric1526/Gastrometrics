import { describe, it, expect } from "vitest"
import { convertToUnit, findBestMatch, normalizeName, defaultUnitFor } from "./match-ingredients"
import { parseIngredientLine } from "./parse-recipe"
import type { Ingredient } from "@/types/ingredient"

const ing = (id: string, name: string, unit: Ingredient["unit"]): Ingredient =>
  ({ id, name, unit, category: "OTROS", pricing: { purchasePrice: 1, netContent: 1, pricePerUnit: 1, lastUpdated: "" }, supplier: "", metadata: { createdAt: "", updatedAt: "", version: 1 } }) as Ingredient

const db = [ing("1", "Harina de trigo", "kilogramos"), ing("2", "Huevos", "unidad"), ing("3", "Leche entera", "litros"), ing("4", "Aceite de oliva", "mililitros")]

describe("coincidencia y conversión (docs/145)", () => {
  it("convierte a la unidad del ingrediente", () => {
    expect(convertToUnit(parseIngredientLine("200 g de harina")!, "kilogramos")).toBe(0.2)
    expect(convertToUnit(parseIngredientLine("2 tazas de leche")!, "litros")).toBe(0.48)
    expect(convertToUnit(parseIngredientLine("3 huevos")!, "unidad")).toBe(3)
    expect(convertToUnit(parseIngredientLine("1 lb de carne")!, "kilogramos")).toBeCloseTo(0.4536, 3)
    // masa ↔ volumen: no se adivina
    expect(convertToUnit(parseIngredientLine("200 g de leche")!, "litros")).toBeNull()
  })

  it("encuentra el ingrediente aunque cambien tildes, plurales o palabras sueltas", () => {
    expect(findBestMatch("harina", db)?.id).toBe("1")
    expect(findBestMatch("huevo", db)?.id).toBe("2")
    expect(findBestMatch("leche", db)?.id).toBe("3")
    expect(findBestMatch("aceite de oliva extra virgen", db)?.id).toBe("4")
    expect(findBestMatch("azúcar", db)).toBeNull()
  })

  it("respeta la palabra principal: 'huevos' no es 'fideo de huevo'; en inglés va al final", () => {
    const pasta = [ing("9", "Fideo - De Huevo", "kilogramos"), ing("8", "Sal - Sal Del Golfo", "gramos")]
    expect(findBestMatch("huevos", pasta)).toBeNull()
    expect(findBestMatch("sal", pasta)?.id).toBe("8")
    const en = [ing("7", "Olive oil", "mililitros"), ing("6", "Egg noodles", "kilogramos")]
    expect(findBestMatch("oil", en, "en")?.id).toBe("7")
    expect(findBestMatch("eggs", en, "en")).toBeNull()
  })

  it("normaliza y elige unidad para ingredientes nuevos", () => {
    expect(normalizeName("Cebollas picadas")).toBe("cebolla")
    expect(defaultUnitFor("mass")).toBe("kilogramos")
    expect(defaultUnitFor("volume")).toBe("litros")
    expect(defaultUnitFor(null)).toBe("unidad")
  })
})
