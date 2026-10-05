import { describe, expect, it } from "vitest"
import { matchCountLines, sheetRowsToLines } from "./inventory-import"
import type { Ingredient } from "@/types/ingredient"

const ing = (id: string, name: string, unit: string) => ({ id, name, unit }) as unknown as Ingredient
const BASE = [
  ing("1", "Harina - De Trigo Panadero", "kilogramos"),
  ing("2", "Aceite de oliva", "litros"),
  ing("3", "Huevos", "unidad"),
  ing("4", "Azúcar blanca", "gramos"),
]

describe("conteo de inventario desde texto", () => {
  it("hoja de conteo escrita o leída con OCR", () => {
    const text = ["INVENTARIO FÍSICO 03/10", "Harina 25 kg", "Aceite de oliva ..... 3", "Huevos 120", "Azúcar blanca 2 kg", "Chocolate 4 kg", "Total 154"].join("\n")
    const r = matchCountLines(text, BASE)
    expect(r.matched.map((m) => [m.ingredientId, m.quantity])).toEqual([
      ["1", 25],
      ["2", 3],
      ["3", 120],
      ["4", 2000], // 2 kg → gramos
    ])
    expect(r.unmatched).toEqual(["Chocolate 4 kg"])
  })
  it("desde una hoja de Excel", () => {
    const text = sheetRowsToLines([
      ["Producto", "Cantidad", "Unidad"],
      ["Harina", 12.5, "kg"],
      ["Aceite de oliva", 1500, "ml"],
    ])
    const r = matchCountLines(text, BASE)
    expect(r.matched.map((m) => [m.ingredientId, m.quantity])).toEqual([
      ["1", 12.5],
      ["2", 1.5], // 1500 ml → litros
    ])
  })
})
