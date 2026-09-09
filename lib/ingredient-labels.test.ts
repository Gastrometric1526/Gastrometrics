import { describe, it, expect } from "vitest"
import { matchCategoryLabel, matchUnitLabel, getCategoryLabel, getUnitLabel, getMermaLevelLabel } from "./ingredient-labels"

// Cubre el reconocimiento multi-idioma agregado en docs/89 para la importación de
// Ingredientes (antes solo reconocía el valor canónico en Español) — sin esto, un
// Excel con encabezados/categorías/unidades en otro idioma de los 6 seleccionables
// caía silenciosamente a "OTROS"/"gramos" en vez de reconocerse.
describe("matchCategoryLabel", () => {
  it("reconoce el valor canónico en Español tal cual", () => {
    expect(matchCategoryLabel("RES")).toBe("RES")
    expect(matchCategoryLabel("LÁCTEOS Y DERIVADOS")).toBe("LÁCTEOS Y DERIVADOS")
  })

  it("reconoce la etiqueta traducida en inglés, francés y chino", () => {
    expect(matchCategoryLabel("Beef")).toBe("RES")
    expect(matchCategoryLabel("Légumes")).toBe("VEGETAL")
    expect(matchCategoryLabel("鱼类")).toBe("PESCADO")
  })

  it("ignora tildes, mayúsculas y espacios extra", () => {
    expect(matchCategoryLabel("  lacteos y derivados ")).toBe("LÁCTEOS Y DERIVADOS")
    expect(matchCategoryLabel("dairy and derivatives")).toBe("LÁCTEOS Y DERIVADOS")
  })

  it("no reconoce texto que no corresponde a ninguna categoría", () => {
    expect(matchCategoryLabel("cualquier cosa random")).toBeNull()
    expect(matchCategoryLabel("")).toBeNull()
  })
})

describe("matchUnitLabel", () => {
  it("reconoce el valor canónico y abreviaturas comunes", () => {
    expect(matchUnitLabel("kilogramos")).toBe("kilogramos")
    expect(matchUnitLabel("kg")).toBe("kilogramos")
    expect(matchUnitLabel("g")).toBe("gramos")
    expect(matchUnitLabel("lb")).toBe("libras")
    expect(matchUnitLabel("fl oz")).toBe("onzas líquidas")
    expect(matchUnitLabel("gal")).toBe("galones")
  })

  it("reconoce la etiqueta traducida en portugués y danés", () => {
    expect(matchUnitLabel("Quilogramas")).toBe("kilogramos")
    expect(matchUnitLabel("Liter")).toBe("litros")
  })

  // BUG CORREGIDO (docs/89): la tabla vieja de normalizeUnit (app/ingredientes/page.tsx)
  // mapeaba "taza"/"cdta"/"cda" a "tazas"/"cucharaditas"/"cucharadas" — unidades que NO
  // existen en types/ingredient.ts (`units`). matchUnitLabel no debe inventar una unidad
  // canónica para texto sin equivalente real; debe devolver null (normalizeUnit cae a
  // "gramos" por defecto en ese caso, igual que cualquier otro texto no reconocido).
  it("no inventa una unidad canónica para texto sin equivalente real", () => {
    expect(matchUnitLabel("taza")).toBeNull()
    expect(matchUnitLabel("cdta")).toBeNull()
    expect(matchUnitLabel("cucharada")).toBeNull()
  })
})

describe("getCategoryLabel / getUnitLabel / getMermaLevelLabel", () => {
  it("en Español devuelve el valor guardado tal cual (es la etiqueta)", () => {
    expect(getCategoryLabel("RES", "es")).toBe("RES")
    expect(getUnitLabel("kilogramos", "es")).toBe("kilogramos")
  })

  it("traduce la etiqueta sin tocar lo que se compararía/guardaría", () => {
    expect(getCategoryLabel("RES", "en")).toBe("Beef")
    expect(getUnitLabel("kilogramos", "fr")).toBe("Kilogrammes")
    expect(getMermaLevelLabel("Alta", "en")).toBe("High")
  })
})
