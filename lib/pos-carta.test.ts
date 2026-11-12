import { describe, expect, it } from "vitest"
import { buildCartas, cartaCategories, RECIPES_CARTA } from "@/lib/pos-carta"
import type { Menu } from "@/lib/types/menus"
import type { Recipe } from "@/types/recipe"
import { SUBRECIPE_CLASSIFICATION } from "@/types/recipe"

const recipe = (over: Partial<Recipe>): Recipe =>
  ({ id: "r", name: "R", classification: "Parrilla", unitPrice: 100, costPerServing: 30, totalCost: 30, yieldAmount: 1, ...over }) as Recipe

const recipes = [
  recipe({ id: "burger", name: "Hamburguesa", image: "data:image/png;base64,x", unitPrice: 200 }),
  recipe({ id: "sopa", name: "Sopa", classification: "Entradas", unitPrice: 90 }),
  recipe({ id: "salsa", name: "Salsa base", isSubRecipe: true }),
]

const menu: Menu = {
  id: "m1",
  businessId: "main",
  name: "Almuerzo",
  steps: [
    { id: "s2", name: "Plato fuerte", order: 2 },
    { id: "s1", name: "Entrada", order: 1 },
  ],
  items: [
    { id: "i1", recipeId: "burger", stepId: "s2", section: "fuerte", enabled: true, priceOverride: 180 },
    { id: "i2", recipeId: "sopa", stepId: "s1", section: "entrada", enabled: true },
    { id: "i3", recipeId: "salsa", stepId: "s1", section: "entrada", enabled: false },
  ],
  createdAt: "",
  updatedAt: "",
}
const labels = { recipes: "Todas mis recetas", other: "Otros", wholeMenu: "Menú completo" }

describe("carta del POS (docs/271)", () => {
  it("cada menú es una carta con sus platos activos por paso, y Mis Recetas va al final", () => {
    const cartas = buildCartas([menu], recipes, labels)
    expect(cartas.map((c) => c.id)).toEqual(["m1", RECIPES_CARTA])
    const almuerzo = cartas[0]
    expect(almuerzo.items.map((i) => i.name)).toEqual(["Almuerzo", "Sopa", "Hamburguesa"])
    expect(cartaCategories(almuerzo)).toEqual(["Menú completo", "Entrada", "Plato fuerte"])
    expect(almuerzo.items.find((i) => i.refId === "burger")).toMatchObject({ sourceType: "recipe", price: 180 })
    expect(almuerzo.items[0]).toMatchObject({ sourceType: "menu", refId: "m1" })
  })

  it("Mis Recetas trae todas menos las subrecetas, y la foto solo si la receta tiene una", () => {
    const all = buildCartas([], recipes, labels)
    expect(all).toHaveLength(1)
    expect(all[0].items.map((i) => i.refId)).toEqual(["burger", "sopa"])
    expect(all[0].items[0].image).toBeTruthy()
    expect(all[0].items[1].image).toBeUndefined()
    expect(cartaCategories(all[0])).toEqual(["Entradas", "Parrilla"])
  })

  it("un menú sin platos activos no aparece como carta", () => {
    const empty = { ...menu, id: "m2", items: menu.items.map((i) => ({ ...i, enabled: false })) }
    expect(buildCartas([empty], recipes, labels).map((c) => c.id)).toEqual([RECIPES_CARTA])
  })
})

describe("subrecetas fuera de la carta (docs/277)", () => {
  it("una receta con clasificación de subreceta no sale aunque no tenga la marca", () => {
    const sub = { ...recipe({ id: "salsa2", name: "Salsa de tomate" }), classification: SUBRECIPE_CLASSIFICATION, isSubRecipe: undefined } as Recipe
    const all = buildCartas([], [...recipes, sub], labels)
    expect(all[0].items.some((i) => i.refId === "salsa2")).toBe(false)
  })
})
