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
    // Con tabla reconocida se usan solo las columnas de nombre, cantidad y unidad (docs/152)
    expect(spreadsheetToRecipeText([["原料", "数量", "单位"], ["大米", 2, "杯"]])).toBe(["Ingredientes:", "大米 | 2 杯"].join("\n"))
    expect(spreadsheetToRecipeText([["Ingrediens", "Mængde", "Enhed"], ["Mel", 500, "g"]])).toBe(["Ingredientes:", "Mel | 500 g"].join("\n"))
  })
})

describe("ficha técnica de escuela en Excel (.xlsm, docs/152)", () => {
  // Estructura de un libro real: listas de opciones a la derecha, código de barra vacío,
  // filas "-" sin usar, costos con "L" (lempiras), pasos con el número en otra celda.
  const rows = [
    ["", "", "FOTO o´DIBUJO", "", "", "", "", "", "", "", "", "", "", "", "", "", "Barismo"],
    ["", "", "Ficha Técnica - Plato", "", "", "", "", "", "", "", "", "", "", "", "", "", "Guarnición"],
    ["", "Nombre", "Galletas de prueba", "", "", "", "", "", "", "", "", "", "", "", "", "", "Molecular"],
    ["", "Rendimiento", "45", "", "Ultima Revisión:30/10/2023", "", "Precio de Venta:", "L1,575.00", "", "", "", "", "", "", "", "", "Plato Fuerte"],
    ["#", "Código de Barra", "Nombre", "Cantidad", "Medida", "Costo", "Costo / Medida", "Extensión", "costo de produccion", "", "", "", "", "", "", "", "Salsas"],
    ["1", "", "Mantequilla - Sin Sal", "226", "g", "L0.28", "L0.28", "L62.63", "L311.76", "", "", "", "", "", "", "", "Sopas"],
    ["2", "", "Harina - De Trigo Panadero", "500", "g", "L0.02", "L0.02", "L10.47"],
    ["3", "", "-"],
    ["Total:", "", "", "", "", "", "", "L311.76"],
    ["Comentario:"],
    ["1", "Precalienta el horno a 190°C y forra dos bandejas."],
    ["2", "Bate la mantequilla con el azúcar hasta que esté cremosa.", "h", "j"],
  ]
  it("usa solo las columnas de la tabla y lee nombre, rendimiento, costos y pasos", () => {
    const r = parseRecipeText(spreadsheetToRecipeText(rows))
    expect(r.name).toBe("Galletas de prueba")
    expect(r.servings).toBe(45)
    expect(r.ingredients.map((i) => [i.name, i.quantity, i.baseAmount, i.unitCost])).toEqual([
      ["Mantequilla - Sin Sal", 226, 226, 0.28],
      ["Harina - De Trigo Panadero", 500, 500, 0.02],
    ])
    expect(r.procedure).toEqual(["Precalienta el horno a 190°C y forra dos bandejas.", "Bate la mantequilla con el azúcar hasta que esté cremosa."])
  })
})
