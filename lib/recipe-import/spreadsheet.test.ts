import { describe, expect, it } from "vitest"
import { spreadsheetToRecipeText } from "./spreadsheet"
import { parseRecipeText } from "./parse-recipe"

describe("receta en Excel", () => {
  it("título, tabla de ingredientes con encabezados y pasos", () => {
    const text = spreadsheetToRecipeText([
      ["Pan de banano", "", ""],
      ["Porciones", 8, ""],
      ["", "", ""],
      ["Ingrediente", "Cantidad", "Unidad"],
      ["Harina", 500, "g"],
      ["Banano maduro", 3, "unidad"],
      ["Azúcar", "1/2", "taza"],
      ["", "", ""],
      ["Preparación", "", ""],
      ["1. Mezclar todo.", "", ""],
      ["2. Hornear 45 minutos.", "", ""],
    ])
    const r = parseRecipeText(text)
    expect(r.name).toBe("Pan de banano")
    expect(r.servings).toBe(8)
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.baseAmount])).toEqual([
      ["Harina", 500, 500],
      ["Banano maduro", 3, 3],
      ["Azúcar", 0.5, 120],
    ])
    expect(r.procedure).toEqual(["Mezclar todo.", "Hornear 45 minutos."])
  })
  it("encabezados de columna en chino y danés se descartan", () => {
    expect(spreadsheetToRecipeText([["原料", "数量", "单位"], ["大米", 2, "杯"]])).toBe("大米 | 2 | 杯")
    expect(spreadsheetToRecipeText([["Ingrediens", "Mængde", "Enhed"], ["Mel", 500, "g"]])).toBe("Mel | 500 | g")
  })
})
