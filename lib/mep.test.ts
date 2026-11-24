import { describe, expect, it } from "vitest"
import { buildMep, flattenDish, formatMepAmount, groupByArea, groupDishesByStep } from "./mep"
import type { Recipe, RecipeIngredient } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { Menu } from "@/lib/types/menus"

const line = (ingredientId: string, quantity: number, unit = "gramos", name = ingredientId): RecipeIngredient =>
  ({ id: `l-${ingredientId}`, ingredientId, name, category: "", quantity, unit, measure: unit, cost: 0, unitCost: 0, costPerMeasure: 0 }) as RecipeIngredient

const recipe = (id: string, yieldAmount: number, ingredients: RecipeIngredient[], extra: Partial<Recipe> = {}): Recipe =>
  ({ id, name: id, classification: "", plate: "", servings: yieldAmount, yieldAmount, yieldUnit: "porciones", ingredients, procedure: [`paso ${id}`], totalCost: 0, costPerServing: 0, ...extra }) as Recipe

const ing = (id: string, recipeId?: string): Ingredient => ({ id, name: id, recipeId }) as unknown as Ingredient

// Salsa (rinde 1000 g) usa fondo (rinde 2000 ml). La pasta (rinde 4) usa 200 g de salsa.
const fondo = recipe("fondo", 2000, [line("hueso", 1000)], { yieldUnit: "ml", classification: "Salsas y fondos (Saucier)" })
const salsa = recipe("salsa", 1000, [line("crema", 500), line("ing-fondo", 400, "mililitros")], { yieldUnit: "g", classification: "Salsas y fondos (Saucier)" })
const pasta = recipe("pasta", 4, [line("fideo", 400), line("ing-salsa", 200)], { classification: "Línea caliente (Cuisine chaude)" })
const ensalada = recipe("ensalada", 2, [line("lechuga", 100), line("ing-salsa", 50)], { classification: "Línea fría (Garde-manger / Cuisine froide)" })
const ingredients = [ing("ing-salsa", "salsa"), ing("ing-fondo", "fondo"), ing("hueso"), ing("crema"), ing("fideo"), ing("lechuga")]

const menu: Menu = {
  id: "m",
  businessId: "main",
  name: "Almuerzo",
  plannedServings: 40,
  steps: [
    { id: "s1", name: "Entrada", order: 1 },
    { id: "s2", name: "Plato fuerte", order: 2 },
  ],
  items: [
    { id: "i1", recipeId: "pasta", stepId: "s2", section: "fuerte", enabled: true },
    { id: "i2", recipeId: "ensalada", stepId: "s1", section: "entrada", enabled: true, plannedQuantity: 10 },
    { id: "i3", recipeId: "borrada", stepId: "s1", section: "entrada", enabled: true },
    { id: "i4", recipeId: "pasta", stepId: "s2", section: "fuerte", enabled: false },
  ],
  createdAt: "",
  updatedAt: "",
}

describe("buildMep (docs/202)", () => {
  const mep = buildMep(menu, [fondo, salsa, pasta, ensalada], ingredients)

  it("platos con sus porciones (del plato o del menú) y escalados, en el orden del menú", () => {
    expect(mep.dishes.map((d) => [d.name, d.amount, d.stepName])).toEqual([
      ["ensalada", 10, "Entrada"],
      ["pasta", 40, "Plato fuerte"],
    ])
    const pastaEntry = mep.dishes[1]
    expect(pastaEntry.multiplier).toBe(10)
    expect(pastaEntry.lines.find((l) => l.ingredientId === "fideo")?.quantity).toBe(4000)
    expect(pastaEntry.procedure).toEqual(["paso pasta"])
  })

  it("las preparaciones base se suman entre platos y se expanden en cualquier nivel, las profundas primero", () => {
    // salsa: pasta 200 g × 10 + ensalada 50 g × 5 = 2250 g; fondo: 2250/1000 × 400 ml = 900 ml
    expect(mep.preps.map((p) => [p.name, p.amount, p.depth])).toEqual([
      ["fondo", 900, 2],
      ["salsa", 2250, 1],
    ])
    expect(mep.preps[1].usedBy.sort()).toEqual(["ensalada", "pasta"])
    expect(mep.preps[0].usedBy).toEqual(["salsa"])
    expect(mep.preps[1].lines.find((l) => l.ingredientId === "crema")?.quantity).toBe(1125)
  })

  it("ignora los platos desactivados y avisa de recetas que ya no existen", () => {
    expect(mep.missingRecipeIds).toEqual(["borrada"])
    expect(mep.dishes.filter((d) => d.recipeId === "pasta")).toHaveLength(1)
  })

  it("agrupa por área de la cocina (clasificación), en el orden de la app", () => {
    const groups = groupByArea([...mep.preps, ...mep.dishes])
    expect(groups.map((g) => [g.area.split(" (")[0], g.entries.map((e) => e.name)])).toEqual([
      ["Línea caliente", ["pasta"]],
      ["Línea fría", ["ensalada"]],
      ["Salsas y fondos", ["fondo", "salsa"]],
    ])
  })

  it("agrupa por paso y formatea cantidades sin ceros de más", () => {
    expect(groupDishesByStep(mep.dishes).map((g) => g.stepName)).toEqual(["Entrada", "Plato fuerte"])
    expect(formatMepAmount(2.4)).toBe("2.4")
    expect(formatMepAmount(1125.0000001)).toBe("1125")
  })
})

describe("sub-recetas por plato (docs/207)", () => {
  const mep = buildMep(menu, [fondo, salsa, pasta, ensalada], ingredients)

  it("cada plato lleva sus sub-recetas en árbol con la cantidad de ESE plato", () => {
    const pastaEntry = mep.dishes.find((d) => d.recipeId === "pasta")!
    // pasta ×10: 200 g × 10 = 2000 g de salsa; salsa ×2: 400 ml × 2 = 800 ml de fondo
    expect(pastaEntry.subs?.map((s) => [s.name, s.amount, s.yieldUnit, s.key])).toEqual([["salsa", 2000, "gramos", "sub:pasta/salsa"]])
    expect(pastaEntry.subs?.[0].subs?.map((s) => [s.name, s.amount, s.key])).toEqual([["fondo", 800, "sub:pasta/salsa/fondo"]])
    expect(pastaEntry.subs?.[0].lines.find((l) => l.ingredientId === "crema")?.quantity).toBe(1000)
    const ensaladaEntry = mep.dishes.find((d) => d.recipeId === "ensalada")!
    expect(ensaladaEntry.subs?.[0].amount).toBe(250) // 50 g × 5
  })

  it("avisa en qué otros platos se usa la misma sub-receta y aplana el árbol en orden", () => {
    const pastaEntry = mep.dishes.find((d) => d.recipeId === "pasta")!
    expect(pastaEntry.subs?.[0].usedBy).toEqual(["ensalada"])
    expect(flattenDish(pastaEntry).map((x) => [x.entry.name, x.level])).toEqual([
      ["pasta", 0],
      ["salsa", 1],
      ["fondo", 2],
    ])
  })
})

describe("PDF de la MEP con sub-recetas por plato (docs/207)", () => {
  it("se arma por paso con el árbol y el total, y por área sin cambios", async () => {
    const { generateMepPDF } = await import("@/lib/pdf/mep-pdf-generator")
    const mep = buildMep(menu, [fondo, salsa, pasta, ensalada], ingredients)
    const step = generateMepPDF({ menuName: "Almuerzo", servings: 40, preps: mep.preps, dishes: mep.dishes, groupBy: "step" })
    // 1 hoja de lista + una receta por plato y por cada sub-receta del árbol (pasta: salsa, fondo; ensalada: salsa, fondo).
    expect(step.getNumberOfPages()).toBeGreaterThanOrEqual(7)
    const area = generateMepPDF({ menuName: "Almuerzo", servings: 40, preps: mep.preps, dishes: mep.dishes, groupBy: "area" })
    expect(area.getNumberOfPages()).toBeGreaterThanOrEqual(4)
    if (process.env.MEP_SAMPLE_OUT) {
      const fs = await import("fs")
      fs.writeFileSync(process.env.MEP_SAMPLE_OUT, Buffer.from(step.output("arraybuffer")))
    }
  })
})
