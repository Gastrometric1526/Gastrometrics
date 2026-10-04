import { describe, expect, it } from "vitest"
import { findColumn, mapIngredientRows, parseLocaleNumber, readUnitCell, splitPastedList } from "./ingredient-import"

describe("parseLocaleNumber", () => {
  it.each([
    ["1,50", 1.5],
    ["1.50", 1.5],
    ["1.250,75", 1250.75],
    ["1,250.75", 1250.75],
    ["$ 12", 12],
    ["₡1.500", 1500],
    ["12 kr", 12],
    ["1 500", 1500],
    ["1,500", 1500],
    ["2.000.000", 2000000],
    ["R$ 3,90", 3.9],
    [7, 7],
  ])("%s → %s", (input, expected) => {
    expect(parseLocaleNumber(input)).toBeCloseTo(expected as number)
  })
  it("\"1.500\" sin símbolo: miles en monedas sin decimales (CRC, COP…), decimal en las demás", () => {
    expect(parseLocaleNumber("1.500", "CRC")).toBe(1500)
    expect(parseLocaleNumber("12.500", "COP")).toBe(12500)
    expect(parseLocaleNumber("1.500", "USD")).toBe(1.5)
    expect(parseLocaleNumber("0.125", "CRC")).toBe(0.125)
  })
  it("sin número es NaN", () => {
    expect(parseLocaleNumber("—")).toBeNaN()
  })
})

describe("findColumn", () => {
  it("no empareja encabezados vacíos ni la letra suelta 'u' dentro de 'Producto'", () => {
    expect(findColumn(["", "Producto", "Precio"], "unit")).toBeNull()
    expect(findColumn(["", "Producto", "Precio"], "name")).toBe("Producto")
  })
  it("prefiere la coincidencia exacta", () => {
    expect(findColumn(["Precio por unidad", "Unidad"], "unit")).toBe("Unidad")
  })
  it("reconoce encabezados en danés y chino", () => {
    expect(findColumn(["Vare", "Pris", "Enhed"], "name")).toBe("Vare")
    expect(findColumn(["品名", "单价", "单位"], "price")).toBe("单价")
  })
})

describe("readUnitCell", () => {
  it("lee unidad sola y unidad con contenido", () => {
    expect(readUnitCell("kg")).toEqual({ unit: "kilogramos", content: null })
    expect(readUnitCell("saco 25 kg")).toEqual({ unit: "kilogramos", content: 25 })
  })
})

describe("mapIngredientRows", () => {
  it("con encabezados y precios con moneda", () => {
    const rows = mapIngredientRows([
      ["Producto", "Unidad", "Precio", "Proveedor"],
      ["Tomate", "kg", "₡1.500", "Feria"],
      ["Aceite de oliva", "L", "$8,50", ""],
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ name: "Tomate", unit: "kilogramos", price: 1500, content: 1, supplier: "Feria" })
    expect(rows[1]).toMatchObject({ name: "Aceite de oliva", unit: "litros", price: 8.5 })
  })
  it("lista pegada sin encabezados (copiada de Excel o WhatsApp)", () => {
    const rows = mapIngredientRows([
      ["Tomate", "2 kg", "3,50"],
      ["Cebolla", "1 kg", "1,20"],
      ["Huevos", "30 unidad", "4.80"],
    ])
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ name: "Tomate", unit: "kilogramos", content: 2, price: 3.5 })
    expect(rows[2]).toMatchObject({ name: "Huevos", unit: "unidad", content: 30, price: 4.8 })
  })
})

describe("ejemplo de lista pegada en los 6 idiomas", () => {
  it.each([
    ["es", "Tomate, 1 kg, 1.50\nAceite de oliva, 1 L, 8.90\nHuevos, 30 unidad, 4.80"],
    ["en", "Tomato, 1 kg, 1.50\nOlive oil, 1 L, 8.90\nEggs, 30 unit, 4.80"],
    ["da", "Tomat, 1 kg, 12.50\nOlivenolie, 1 L, 89.00\nÆg, 30 stk, 48.00"],
    ["fr", "Tomate, 1 kg, 1.50\nHuile d'olive, 1 L, 8.90\nŒufs, 30 unité, 4.80"],
    ["pt", "Tomate, 1 kg, 1.50\nAzeite de oliva, 1 L, 8.90\nOvos, 30 unidade, 4.80"],
    ["zh", "番茄, 1 公斤, 1.50\n橄榄油, 1 升, 8.90\n鸡蛋, 30 个, 4.80"],
  ])("%s", (_lang, text) => {
    const rows = mapIngredientRows(splitPastedList(text))
    expect(rows.map((r) => r.unit)).toEqual(["kilogramos", "litros", "unidad"])
    expect(rows[2].content).toBe(30)
    expect(rows.every((r) => r.price > 0 && r.name)).toBe(true)
  })
  it("coma sobrante al final y precio vacío", () => {
    const rows = mapIngredientRows(splitPastedList(["Tomate, 2 kg, 3,50", "Cilantro, 1 unidad, ", "Sal, 1 kg, 0,90"].join("\n")))
    expect(rows[1]).toMatchObject({ name: "Cilantro", unit: "unidad", content: 1 })
    expect(rows[1].price).toBeNaN()
  })
  it("pegado desde Excel (tabuladores) con encabezados", () => {
    const rows = mapIngredientRows(splitPastedList("Nombre\tPrecio\tUnidad\nArroz\t$2,10\tkg"))
    expect(rows).toEqual([expect.objectContaining({ name: "Arroz", price: 2.1, unit: "kilogramos" })])
  })
})
