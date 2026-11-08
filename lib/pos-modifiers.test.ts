import { describe, expect, it } from "vitest"
import { modifiersUnitCost, splitModifiers } from "./pos-modifiers"

describe("modificadores del POS (docs/261)", () => {
  it("separa por comas, punto y coma, barras, saltos de línea y +", () => {
    expect(splitModifiers("Extra queso, Tocino; Aguacate | Jalapeños\nSalsa BBQ")).toEqual([
      { name: "Extra queso", quantity: 1 },
      { name: "Tocino", quantity: 1 },
      { name: "Aguacate", quantity: 1 },
      { name: "Jalapeños", quantity: 1 },
      { name: "Salsa BBQ", quantity: 1 },
    ])
    expect(splitModifiers("+ Extra queso + Tocino")).toEqual([
      { name: "Extra queso", quantity: 1 },
      { name: "Tocino", quantity: 1 },
    ])
  })

  it("lee cantidades como 2x Tocino, Tocino x2 o Tocino (2)", () => {
    expect(splitModifiers("2x Tocino, Queso x3, Huevo (2), 1.5 x Salsa")).toEqual([
      { name: "Tocino", quantity: 2 },
      { name: "Queso", quantity: 3 },
      { name: "Huevo", quantity: 2 },
      { name: "Salsa", quantity: 1.5 },
    ])
  })

  it("ignora lo que quita algo, en varios idiomas, y las celdas vacías", () => {
    expect(splitModifiers("Sin cebolla, No pickles, without onions, Sans oignon, Sem cebola, Extra queso")).toEqual([
      { name: "Extra queso", quantity: 1 },
    ])
    expect(splitModifiers("")).toEqual([])
    expect(splitModifiers(null)).toEqual([])
  })

  it("suma el costo por unidad del plato solo de los que tienen receta", () => {
    const recipes = [
      { id: "queso", costPerServing: 6 },
      { id: "tocino", costPerServing: 9.5 },
    ]
    expect(
      modifiersUnitCost(
        [
          { name: "Extra queso", recipeId: "queso", quantity: 1 },
          { name: "Tocino", recipeId: "tocino", quantity: 2 },
          { name: "Aguacate", recipeId: null, quantity: 1 },
        ],
        recipes,
      ),
    ).toBe(25)
    expect(modifiersUnitCost(undefined, recipes)).toBe(0)
  })
})
