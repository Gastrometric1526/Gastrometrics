/**
 * Lista de pruebas del multiplicador PAX y cálculos relacionados (pedido del dueño, docs/190).
 * Cada `describe` corresponde a una sección de la lista; los valores esperados están
 * calculados a mano en los comentarios.
 */
import { describe, expect, it, vi } from "vitest"
import type { Recipe, RecipeIngredient } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import type { SalesImport } from "@/types/sales-import"
import type { Menu } from "@/lib/types/menus"

// ── Datos de prueba ──────────────────────────────────────────────────────────────────
function ing(id: string, unit: string, purchasePrice: number, netContent: number, extra: Partial<Ingredient> = {}): Ingredient {
  return {
    id,
    name: id,
    category: "OTROS",
    unit,
    pricing: { purchasePrice, netContent, pricePerUnit: purchasePrice / netContent, lastUpdated: "2026-10-01" },
    supplier: "",
    metadata: { createdAt: "", updatedAt: "", version: 1 },
    ...extra,
  } as Ingredient
}
function line(ingredientId: string, quantity: number, unit: string, unitCost: number): RecipeIngredient {
  return { id: `${ingredientId}-l`, ingredientId, name: ingredientId, category: "", quantity, unit, measure: "", cost: 0, unitCost, costPerMeasure: unitCost, extension: quantity * unitCost } as RecipeIngredient
}
function rec(id: string, yieldAmount: number, lines: RecipeIngredient[]): Recipe {
  return { id, name: id, classification: "", servings: 1, yieldAmount, yieldUnit: "porciones", ingredients: lines, procedure: [], totalCost: 0, costPerServing: 0, metadata: { createdAt: "", updatedAt: "", version: 1 } } as unknown as Recipe
}

// Harina: L30 el saco de 1000 g (0.03/g). Sal: L20 el kg. Tomate con 20 % de merma:
// L40 por 1000 g físicos, 800 g aprovechables → 0.05/g aprovechable, factor bruto 1.25.
// Hueso: L50 por 1000 g.
const harina = ing("harina", "gramos", 30, 1000)
const sal = ing("sal", "kilogramos", 20, 1)
const tomate = ing("tomate", "gramos", 40, 800, { originalNetContent: 1000 } as Partial<Ingredient>)
const hueso = ing("hueso", "gramos", 50, 1000)
// Sub-recetas como ingredientes: caldo (rinde 500 ml) y salsa (rinde 1000 g).
const caldoIng = ing("caldo-ing", "mililitros", 1, 1, { recipeId: "caldo" } as Partial<Ingredient>)
const salsaIng = ing("salsa-ing", "gramos", 1, 1, { recipeId: "salsa" } as Partial<Ingredient>)
const caldo = rec("caldo", 500, [line("hueso", 400, "gramos", 0.05)])
const salsa = rec("salsa", 1000, [line("tomate", 800, "gramos", 0.05), line("caldo-ing", 100, "mililitros", 0.04), line("harina", 50, "gramos", 0.03)])
// Plato: rinde 4, usa 200 g de salsa, 100 g de harina y 0.005 kg de sal.
const plato = rec("plato", 4, [line("salsa-ing", 200, "gramos", 0.06), line("harina", 100, "gramos", 0.03), line("sal", 0.005, "kilogramos", 20)])
const postre = rec("postre", 10, [line("harina", 500, "gramos", 0.03)])
const INGREDIENTS = [harina, sal, tomate, hueso, caldoIng, salsaIng]
const RECIPES = [caldo, salsa, plato, postre]
let INVENTORY: InventoryItem[] = []

vi.mock("./storage/recipes", () => ({ getRecipes: () => RECIPES }))
vi.mock("./storage/ingredients", () => ({ getIngredients: () => INGREDIENTS }))
vi.mock("./storage/inventory", () => ({ getInventory: () => INVENTORY }))

import { paxMultiplierFor, scaleLineQuantity, scaleRecipeLine, refreshSnapshotLines } from "./pax-scaling"
import { accumulateRecipeConsumption, indexById, type ConsumptionMap } from "./recipe-consumption"
import { buildPurchaseOrderData } from "./purchase-orders"
import { generateMenuIngredientList, generateRecipeIngredientList, getMenuUnitPriceAndCost } from "./menus"
import { computeTheoreticalStock } from "./theoretical-stock"
import { convertRecipeLines } from "./unit-change"
import { unitCostPercent, unitMarginAmount, unitMarginPercent } from "./recipe-pricing"

const consume = (recipe: Recipe, multiplier: number, gross = true) => {
  const acc: ConsumptionMap = new Map()
  const warnings: string[] = []
  accumulateRecipeConsumption(recipe, multiplier, indexById(RECIPES), indexById(INGREDIENTS), acc, { grossUpMerma: gross, warnings })
  return { q: (id: string) => acc.get(id)?.quantity ?? 0, warnings, acc }
}
/** Costo de producción con PAX, igual que la Ficha: suma de líneas escaladas y redondeadas. */
const productionCost = (recipe: Recipe, pax: number) => {
  const m = paxMultiplierFor(pax, recipe.yieldAmount)
  return recipe.ingredients.reduce((s, l) => s + ((m !== 1 ? scaleRecipeLine(l, m).extension : l.extension) || 0), 0)
}

// ── 1. Factor PAX ────────────────────────────────────────────────────────────────────
describe("1. Factor PAX (Ficha Técnica)", () => {
  it("1.1 PAX = rendimiento → factor 1 y cantidades iguales", () => {
    expect(paxMultiplierFor(4, 4)).toBe(1)
    expect(scaleLineQuantity(123.4, "gramos", 1)).toBe(123.4)
  })
  it("1.2 PAX 0 → factor 1", () => expect(paxMultiplierFor(0, 4)).toBe(1))
  it("1.3 doble (4 → 8) → ×2", () => {
    expect(paxMultiplierFor(8, 4)).toBe(2)
    expect(scaleLineQuantity(100, "gramos", 2)).toBe(200)
  })
  it("1.4 mitad (4 → 2) → ×0.5", () => {
    expect(paxMultiplierFor(2, 4)).toBe(0.5)
    expect(scaleLineQuantity(100, "gramos", 0.5)).toBe(50)
  })
  it("1.5 4 → 10 → ×2.5", () => {
    expect(paxMultiplierFor(10, 4)).toBe(2.5)
    expect(scaleLineQuantity(100, "gramos", 2.5)).toBe(250)
  })
  it("1.6 4 → 100 → ×25, sin errores de precisión", () => {
    expect(paxMultiplierFor(100, 4)).toBe(25)
    expect(scaleLineQuantity(33.3, "gramos", 25)).toBe(832.5)
    expect(scaleLineQuantity(0.005, "kilogramos", 25)).toBe(0.125)
  })
  it("1.7 10 → 1 → ×0.1, hacia arriba", () => {
    expect(paxMultiplierFor(1, 10)).toBe(0.1)
    expect(scaleLineQuantity(33, "gramos", 0.1)).toBe(3.3)
    expect(scaleLineQuantity(35, "gramos", 0.1)).toBe(3.5)
    expect(scaleLineQuantity(36.5, "gramos", 0.1)).toBe(3.7) // 3.65 → 3.7
  })
  it("1.8 rendimiento 0: no divide entre cero (factor 1 desde paxMultiplierFor)", () => {
    expect(paxMultiplierFor(5, 0)).toBe(1)
    expect(Number.isFinite(paxMultiplierFor(5, 0))).toBe(true)
  })
  it("1.9 rendimiento 1 → PAX 12 = ×12", () => expect(paxMultiplierFor(12, 1)).toBe(12))
})

// ── 2. Redondeo por unidad ───────────────────────────────────────────────────────────
describe("2. Redondeo por unidad (siempre hacia arriba)", () => {
  it.each([
    ["2.1", 33, "gramos", 2.5, 82.5],
    ["2.2", 33, "gramos", 3, 99],
    ["2.3", 15.2, "mililitros", 2, 30.4],
    ["2.4", 0.015, "kilogramos", 2, 0.03],
    ["2.5", 0.01, "kilogramos", 1.5, 0.015],
    ["2.6", 0.025, "litros", 3, 0.075],
    ["2.7", 1.2, "unidad", 2.5, 3],
    ["2.8", 0.3, "unidad", 2, 0.6],
    ["2.9", 2.3, "onzas", 1.7, 4], // 3.91 → 4.0
    ["2.10", 0.08, "libras", 2, 0.16],
    ["2.11", 0.01, "kilogramos", 2, 0.02], // antes 0.1
  ])("%s: %s %s × %s = %s", (_id, q, unit, f, expected) => {
    expect(scaleLineQuantity(q as number, unit as string, f as number)).toBe(expected)
  })
  it("regla de oro: nunca menos que la cuenta exacta, en 2,000 combinaciones", () => {
    const units = ["gramos", "kilogramos", "mililitros", "litros", "onzas", "libras", "unidad"]
    let checked = 0
    for (let i = 1; i <= 100; i++)
      for (const f of [0.1, 0.25, 0.5, 1.5, 2.5, 3, 17 / 6, 7]) {
        for (const unit of units.slice(0, 3)) {
          const q = i * 0.037
          const out = scaleLineQuantity(q, unit, f)
          expect(out).toBeGreaterThanOrEqual(q * f - 1e-9)
          // y sin inflar: como mucho un escalón (≤ 10 % de la cantidad o el escalón base)
          expect(out - q * f).toBeLessThanOrEqual(Math.max(q * f * 0.1, 0) + 1e-9)
          checked++
        }
      }
    expect(checked).toBeGreaterThan(2000)
  })
})

// ── 3. Costo con PAX ─────────────────────────────────────────────────────────────────
describe("3. Costo con PAX", () => {
  // Plato sin PAX: 200×0.06 + 100×0.03 + 0.005×20 = 12 + 3 + 0.1 = 15.1 → 3.775 por porción.
  it("3.1 PAX ×2 → costo ≈ ×2", () => {
    expect(productionCost(plato, 4)).toBeCloseTo(15.1, 9)
    expect(productionCost(plato, 8)).toBeCloseTo(30.2, 9)
  })
  it("3.2 costo por porción estable (solo varía por redondeo)", () => {
    const base = productionCost(plato, 4) / 4
    for (const pax of [5, 7, 10, 13, 50]) {
      const unit = productionCost(plato, pax) / pax
      expect(unit).toBeGreaterThanOrEqual(base - 1e-9)
      expect((unit - base) / base).toBeLessThan(0.01)
    }
  })
  it("3.3 costo en pantalla = costo guardado (mismas líneas redondeadas)", () => {
    const m = paxMultiplierFor(10, 4)
    const saved = plato.ingredients.map((l) => scaleRecipeLine(l, m))
    expect(saved.reduce((s, l) => s + (l.extension || 0), 0)).toBeCloseTo(productionCost(plato, 10), 12)
  })
  it("3.4 receta de 12 ingredientes de distintas unidades: la suma cuadra", () => {
    const units = ["gramos", "kilogramos", "mililitros", "litros", "unidad", "onzas"]
    const lines = Array.from({ length: 12 }, (_, i) => line(`x${i}`, 1 + i * 0.7, units[i % 6], 0.1 + i))
    const r = rec("doce", 6, lines)
    const m = paxMultiplierFor(9, 6)
    const expected = lines.reduce((s, l) => s + scaleLineQuantity(l.quantity, l.unit, m) * l.unitCost, 0)
    expect(productionCost(r, 9)).toBeCloseTo(expected, 9)
  })
  it("3.5 precio muy pequeño (0.001/g) no pierde precisión", () => {
    const r = rec("barato", 4, [line("y", 250, "gramos", 0.001)])
    expect(productionCost(r, 10)).toBeCloseTo(0.625, 12)
  })
  it("3.6 precio alto (800/kg)", () => {
    const r = rec("caro", 4, [line("z", 0.35, "kilogramos", 800)])
    expect(productionCost(r, 10)).toBeCloseTo(700, 9) // 0.875 kg × 800
  })
})

// ── 4. Sub-recetas ───────────────────────────────────────────────────────────────────
describe("4. Sub-recetas", () => {
  // Plato ×1: salsa 200 de 1000 → ×0.2: tomate 160 (bruto ×1.25 = 200), harina 10, caldo 20 de 500 → ×0.04: hueso 16.
  it("4.1 la salsa se escala con el plato", () => {
    const { q } = consume(plato, 2.5)
    expect(q("tomate")).toBeCloseTo(500, 9) // 200 × 2.5
  })
  it("4.2 dos niveles (plato → salsa → caldo) llegan al hueso", () => {
    expect(consume(plato, 1).q("hueso")).toBeCloseTo(16, 9)
    expect(consume(plato, 2.5).q("hueso")).toBeCloseTo(40, 9)
  })
  it("4.3 cadena de 5 niveles", () => {
    const chainIngs: Ingredient[] = []
    const chainRecipes: Recipe[] = []
    for (let i = 0; i < 5; i++) {
      chainIngs.push(ing(`n${i}-ing`, "gramos", 1, 1, { recipeId: `n${i}` } as Partial<Ingredient>))
      chainRecipes.push(rec(`n${i}`, 100, [i < 4 ? line(`n${i + 1}-ing`, 50, "gramos", 0) : line("harina", 50, "gramos", 0.03)]))
    }
    const top = rec("top", 1, [line("n0-ing", 100, "gramos", 0)])
    const acc: ConsumptionMap = new Map()
    accumulateRecipeConsumption(top, 2, indexById([...chainRecipes, top]), indexById([...INGREDIENTS, ...chainIngs]), acc, {})
    // 200 de n0 (×2) → n1 100 (×1) → n2 50 (×0.5) → n3 25 → n4 12.5 → harina 6.25
    expect(acc.get("harina")?.quantity).toBeCloseTo(6.25, 9)
  })
  it("4.4 rendimiento propio de la sub-receta: salsa rinde 1000, se usan 200 → 20 % de la salsa", () => {
    expect(consume(plato, 1, false).q("tomate")).toBeCloseTo(160, 9)
  })
  it("4.5 mismo ingrediente en el plato y en la sub-receta: se suma una vez cada uno", () => {
    expect(consume(plato, 1).q("harina")).toBeCloseTo(110, 9) // 100 + 50 × 0.2
  })
  it("4.6 el PAX de una ficha no cambia otras recetas (es solo de esa ficha)", () => {
    const before = JSON.stringify(salsa)
    plato.ingredients.map((l) => scaleRecipeLine(l, 3))
    expect(JSON.stringify(salsa)).toBe(before)
  })
  it("4.7 más de 10 niveles: se corta con aviso, sin romperse", () => {
    const ings: Ingredient[] = []
    const recs: Recipe[] = []
    for (let i = 0; i < 13; i++) {
      ings.push(ing(`d${i}-ing`, "gramos", 1, 1, { recipeId: `d${i}` } as Partial<Ingredient>))
      recs.push(rec(`d${i}`, 1, [line(i < 12 ? `d${i + 1}-ing` : "harina", 1, "gramos", 0)]))
    }
    const acc: ConsumptionMap = new Map()
    const warnings: string[] = []
    expect(() => accumulateRecipeConsumption(recs[0], 1, indexById(recs), indexById([...INGREDIENTS, ...ings]), acc, { warnings })).not.toThrow()
    expect(warnings.some((w) => /depth/i.test(w))).toBe(true)
  })
  it("4.x una receta que se usa a sí misma no cuelga la app (se corta por profundidad)", () => {
    const selfIng = ing("self-ing", "gramos", 1, 1, { recipeId: "self" } as Partial<Ingredient>)
    const self = rec("self", 1, [line("self-ing", 1, "gramos", 0)])
    const warnings: string[] = []
    expect(() => accumulateRecipeConsumption(self, 1, indexById([self]), indexById([selfIng]), new Map(), { warnings })).not.toThrow()
    expect(warnings.length).toBeGreaterThan(0)
  })
})

// ── 5. Cambio de unidad + PAX ────────────────────────────────────────────────────────
describe("5. Cambio de unidad + PAX", () => {
  const r = rec("u", 4, [line("harina", 250, "gramos", 0.03)])
  it("5.1 g → kg: el costo no cambia, antes ni después del PAX", () => {
    const [conv] = convertRecipeLines([r], "harina", "kilogramos", 0.001)
    expect(conv.ingredients[0].quantity).toBe(0.25)
    expect(conv.ingredients[0].quantity * conv.ingredients[0].unitCost).toBeCloseTo(7.5, 9)
    const m = paxMultiplierFor(10, 4)
    expect(scaleRecipeLine(conv.ingredients[0], m).extension).toBeCloseTo(scaleRecipeLine(r.ingredients[0], m).extension!, 9)
  })
  it("5.2 kg → g", () => {
    const k = rec("k", 4, [line("sal", 0.2, "kilogramos", 20)])
    const [conv] = convertRecipeLines([k], "sal", "gramos", 1000)
    expect(conv.ingredients[0].quantity).toBe(200)
    expect(conv.ingredients[0].quantity * conv.ingredients[0].unitCost).toBeCloseTo(4, 9)
  })
  it("5.3 L → ml: factor exacto 1000", () => {
    const l = rec("l", 1, [line("leche", 0.75, "litros", 2)])
    const [conv] = convertRecipeLines([l], "leche", "mililitros", 1000)
    expect(conv.ingredients[0].quantity).toBe(750)
    expect(conv.ingredients[0].unitCost).toBeCloseTo(0.002, 12)
  })
  it("5.4 mezcla g y kg con PAX", () => {
    expect(productionCost(plato, 10)).toBeCloseTo(500 * 0.06 + 250 * 0.03 + 0.013 * 20, 9) // sal 0.0125 kg → 0.013 kg (al gramo)
  })
  it("5.5 / 5.6 cambio de unidad después de escalar y Restaurar con precios de hoy", () => {
    const snap = rec("s", 8, [line("harina", 500, "gramos", 0.03)])
    snap.originalSnapshot = { yieldAmount: 4, ingredients: [line("harina", 250, "gramos", 0.02)] }
    const [conv] = convertRecipeLines([snap], "harina", "kilogramos", 0.001)
    expect(conv.originalSnapshot!.ingredients[0].quantity).toBe(0.25)
    const kgHarina = ing("harina", "kilogramos", 30, 1)
    const [restored] = refreshSnapshotLines(conv.originalSnapshot!.ingredients, [kgHarina])
    expect(restored.unitCost).toBe(30)
    expect(restored.extension).toBeCloseTo(7.5, 9)
  })
})

// ── 6. Menús ─────────────────────────────────────────────────────────────────────────
const menu = (over: Partial<Menu> = {}): Menu =>
  ({
    id: "m",
    name: "Menú",
    plannedServings: 20,
    steps: [],
    items: [
      { id: "a", recipeId: "plato", enabled: true, stepId: "s1" },
      { id: "b", recipeId: "postre", enabled: true, stepId: "s2", plannedQuantity: 15 },
      { id: "c", recipeId: "salsa", enabled: false, stepId: "s3" },
    ],
    ...over,
  }) as unknown as Menu

describe("6. Menús", () => {
  it("6.1 / 6.2 20 personas: plato rinde 4 → ×5; postre rinde 10 con 15 planeados → ×1.5", () => {
    INVENTORY = []
    const r = generateMenuIngredientList("b", menu())
    const summary = Object.fromEntries(r.recipesSummary.map((s) => [s.recipeId, s.compax]))
    expect(summary).toEqual({ plato: 5, postre: 1.5 })
  })
  it("6.3 plato deshabilitado no entra en orden ni en precio/costo", () => {
    const r = generateMenuIngredientList("b", menu())
    expect(r.recipesSummary.find((s) => s.recipeId === "salsa")).toBeUndefined()
    const pc = getMenuUnitPriceAndCost(menu(), [
      { ...plato, unitPrice: 100, costPerServing: 30 } as Recipe,
      { ...postre, unitPrice: 50, costPerServing: 10 } as Recipe,
      { ...salsa, unitPrice: 999, costPerServing: 999 } as Recipe,
    ])
    expect(pc).toEqual({ price: 150, cost: 40 }) // 6.7 suma de precios habilitados
  })
  it("6.4 cantidad planeada distinta al total: se respeta (15, no 20)", () => {
    const r = generateMenuIngredientList("b", menu())
    expect(r.recipesSummary.find((s) => s.recipeId === "postre")!.compax).toBe(1.5)
  })
  it("6.5 / 6.6 el menú atraviesa sub-recetas: harina = plato 110×5 + postre 500×1.5 = 1300 g", () => {
    const r = generateMenuIngredientList("b", menu())
    expect(r.items.find((i) => i.ingredientId === "harina")!.quantity).toBeCloseTo(1300, 9)
    expect(r.items.find((i) => i.ingredientId === "hueso")!.quantity).toBeCloseTo(80, 9) // 16 × 5
  })
  it("6.x misma receta en dos pasos: las porciones se suman", () => {
    const m = menu({ items: [{ id: "a", recipeId: "plato", enabled: true, plannedQuantity: 8 }, { id: "a2", recipeId: "plato", enabled: true, plannedQuantity: 4 }] as Menu["items"] })
    expect(generateMenuIngredientList("b", m).recipesSummary[0].compax).toBe(3) // 12 ÷ 4
  })
})

// ── 7. Órdenes de compra ─────────────────────────────────────────────────────────────
describe("7. Órdenes de compra", () => {
  it("7.1 desde menú: consumo escalado − stock", () => {
    INVENTORY = [{ id: "harina", name: "harina", currentStock: 300 } as InventoryItem]
    const r = generateMenuIngredientList("b", menu())
    expect(r.items.find((i) => i.ingredientId === "harina")!.quantity).toBeCloseTo(1000, 9) // 1300 − 300
    INVENTORY = []
  })
  it("7.2 desde receta con PAX (×2.5): tomate bruto 500 g", () => {
    const r = generateRecipeIngredientList("b", "plato", 2.5)
    expect(r.items.find((i) => i.ingredientId === "tomate")!.quantity).toBeCloseTo(500, 9)
  })
  it("7.3 stock suficiente: el ingrediente no aparece", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["postre"], inventorySnapshot: { harina: 600 } })
    expect(r.items.find((i) => i.ingredientId === "harina")).toBeUndefined()
  })
  it("7.4 stock parcial: pide la diferencia", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["postre"], inventorySnapshot: { harina: 120 } })
    expect(r.items[0].quantity).toBeCloseTo(380, 9)
  })
  it("7.5 merma: cantidad bruta y costo a precio de compra (sin volver a aplicar merma)", () => {
    const r = generateRecipeIngredientList("b", "plato", 2.5)
    const t = r.items.find((i) => i.ingredientId === "tomate")!
    expect(t.quantity).toBeCloseTo(500, 9) // 400 aprovechables × 1.25
    expect(t.unitPrice).toBeCloseTo(0.04, 12) // L40 ÷ 1000 g físicos
    expect(t.totalPrice).toBeCloseTo(20, 9) // no 25 (merma dos veces)
  })
  it("7.6 varios platos que comparten ingrediente: se suman antes de restar stock", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["plato", "postre"], inventorySnapshot: { harina: 100 } })
    expect(r.items.find((i) => i.ingredientId === "harina")!.quantity).toBeCloseTo(510, 9) // 110 + 500 − 100
  })
  it("7.7 / 7.8 envases contra el contenido físico: techo(500 ÷ 1000) = 1 saco de tomate", () => {
    const tomSaco = { ...tomate, presentation: "Caja" } as Ingredient
    INGREDIENTS.splice(INGREDIENTS.indexOf(tomate), 1, tomSaco)
    const r = generateRecipeIngredientList("b", "plato", 2.5)
    expect(r.items.find((i) => i.ingredientId === "tomate")!.presentationQuantity).toBe(1)
    const r2 = generateRecipeIngredientList("b", "plato", 12) // 2400 g brutos → 3 cajas
    expect(r2.items.find((i) => i.ingredientId === "tomate")!.presentationQuantity).toBe(3)
    INGREDIENTS.splice(INGREDIENTS.indexOf(tomSaco), 1, tomate)
  })
  it("7.9 plato con 0 porciones: sin líneas raras", () => {
    const r = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["postre"], compaxByRecipeId: { postre: 0 } })
    expect(r.items).toEqual([])
    expect(r.totalCost).toBe(0)
  })
})

// ── 8. Inventario + consumo ──────────────────────────────────────────────────────────
function sale(day: string, importedAt: string, recipeId: string, quantity: number): SalesImport {
  return { id: `s-${day}-${importedAt}-${recipeId}`, businessId: "main", fileName: "", importedAt, periodStart: day, periodEnd: day, totalRevenue: 0, totalTheoreticalCost: 0, lineCount: 1, unmatchedDishNames: [], lines: [{ id: "l", rawDishName: "", recipeId, menuId: null, quantity, unitPrice: null, revenue: 0, theoreticalCost: 0, date: day }] } as unknown as SalesImport
}
const item = (id: string, extra: Partial<InventoryItem> = {}): InventoryItem => ({ id, name: id, category: "", currentStock: null, minStock: 0, unit: "gramos", price: 0, lastUpdated: "", status: "normal", ...extra })

describe("8. Inventario + consumo", () => {
  const base = { snapshots: [] as InventorySnapshot[], recipes: RECIPES, ingredients: INGREDIENTS, menus: [] as Menu[] }
  it("8.1 / 8.2 / 8.3 venta de 7 platos: (7 ÷ 4) de la receta, sub-recetas y merma bruta", () => {
    // 1.75 × 200 de salsa = 350 → ×0.35 → tomate 280 aprovechables = 350 brutos; hueso 0.35 × 35 → caldo ×0.07 → 28 g.
    const stock = computeTheoreticalStock({
      ...base,
      items: [item("tomate", { currentStock: 1000, stockCountedAt: "2026-10-20T10:00:00Z", stockReceipts: [{ at: "2026-10-21T09:00:00Z", quantity: 500 }] as InventoryItem["stockReceipts"] }), item("hueso", { currentStock: 100, stockCountedAt: "2026-10-20T10:00:00Z" })],
      salesImports: [sale("2026-10-21", "2026-10-21T20:00:00Z", "plato", 7)],
    })
    expect(stock.get("tomate")!.consumed).toBeCloseTo(350, 9)
    expect(stock.get("tomate")!.theoretical).toBeCloseTo(1150, 9) // 8.4: 1000 + 500 − 350
    expect(stock.get("hueso")!.consumed).toBeCloseTo(28, 9)
  })
  it("8.5 varias ventas del mismo plato se acumulan", () => {
    const stock = computeTheoreticalStock({
      ...base,
      items: [item("harina", { currentStock: 2000, stockCountedAt: "2026-10-20T10:00:00Z" })],
      salesImports: [sale("2026-10-21", "2026-10-21T20:00:00Z", "plato", 4), sale("2026-10-22", "2026-10-22T20:00:00Z", "plato", 8)],
    })
    expect(stock.get("harina")!.consumed).toBeCloseTo(330, 9) // 12 ÷ 4 = 3 × 110
  })
})

// ── 9. Precisión y casos límite ──────────────────────────────────────────────────────
describe("9. Precisión y casos límite", () => {
  it("9.1 cantidades muy pequeñas no desaparecen ni se inflan (0.001 g × 2 = 0.002 g; antes 0.1 g)", () => {
    expect(scaleLineQuantity(0.001, "gramos", 2)).toBe(0.002)
    expect(scaleLineQuantity(0.05, "gramos", 1.5)).toBe(0.075)
  })
  it("9.2 cantidades muy grandes", () => expect(scaleLineQuantity(250000, "gramos", 40)).toBe(10000000))
  it("9.4 factor con muchos decimales: 17 ÷ 6", () => {
    const m = paxMultiplierFor(17, 6)
    expect(scaleLineQuantity(60, "gramos", m)).toBe(170) // 169.999… → 170, no 170.1
    expect(scaleLineQuantity(100, "gramos", m)).toBe(283.4) // 283.33 → 283.4
  })
  it("9.5 receta de un solo ingrediente", () => expect(productionCost(rec("uno", 2, [line("harina", 100, "gramos", 0.03)]), 6)).toBeCloseTo(9, 9))
  it("9.6 receta de 40 ingredientes", () => {
    const r = rec("cuarenta", 10, Array.from({ length: 40 }, (_, i) => line(`i${i}`, 10, "gramos", 0.01)))
    expect(productionCost(r, 25)).toBeCloseTo(40 * 25 * 0.01, 9)
  })
  it("9.7 cambiar el PAX varias veces no acumula redondeo (siempre se escala desde la receta)", () => {
    const l = line("harina", 33.3, "gramos", 0.03)
    const once = scaleRecipeLine(l, paxMultiplierFor(10, 4)).quantity
    paxMultiplierFor(7, 4); paxMultiplierFor(13, 4)
    expect(scaleRecipeLine(l, paxMultiplierFor(10, 4)).quantity).toBe(once)
  })
})

// ── 10. Consistencia entre módulos ───────────────────────────────────────────────────
describe("10. Consistencia entre módulos", () => {
  it("10.1 Ficha → Orden: el consumo de la orden coincide con la ficha escalada (sin sub-recetas)", () => {
    const m = paxMultiplierFor(10, 4)
    const fichaHarina = scaleLineQuantity(500, "gramos", paxMultiplierFor(15, 10))
    const order = buildPurchaseOrderData({ businessId: "b", selectedRecipeIds: ["postre"], compaxByRecipeId: { postre: 1.5 } })
    expect(order.items[0].quantity).toBeCloseTo(fichaHarina, 9)
    expect(m).toBe(2.5)
  })
  it("10.2 Venta → stock teórico usa la misma regla que la orden", () => {
    const order = generateRecipeIngredientList("b", "plato", 1.75)
    const stock = computeTheoreticalStock({ snapshots: [], recipes: RECIPES, ingredients: INGREDIENTS, menus: [], items: [item("tomate", { currentStock: 0, stockCountedAt: "2026-10-20T10:00:00Z" })], salesImports: [sale("2026-10-21", "2026-10-21T20:00:00Z", "plato", 7)] })
    expect(stock.get("tomate")!.consumed).toBeCloseTo(order.items.find((i) => i.ingredientId === "tomate")!.quantity, 9)
  })
  it("10.4 margen y costo % iguales en Ficha, Dashboard y Reportes (misma función)", () => {
    const r = { ...plato, pricingMethod: "food_cost", isv: 15, salesCommissionPercent: 10 } as Recipe
    // L115 con ISV 15 %: venta neta 100; comisión 11.5; costo 30.
    expect(unitMarginPercent(r, 115, 30)).toBeCloseTo(58.5, 9)
    expect(unitMarginAmount(r, 115, 30)).toBeCloseTo(58.5, 9)
    expect(unitCostPercent(r, 115, 30)).toBeCloseTo(30, 9)
  })
})

// ── 12. Matriz de combinaciones ──────────────────────────────────────────────────────
describe("12. Matriz de combinaciones", () => {
  it("12.1 g + sub-receta + PAX decimal (4 → 10)", () => expect(consume(plato, 2.5).q("harina")).toBeCloseTo(275, 9))
  it("12.2 kg → g + PAX: el costo escalado no cambia", () => {
    const [conv] = convertRecipeLines([plato], "sal", "gramos", 1000)
    const m = paxMultiplierFor(10, 4)
    const salKg = scaleRecipeLine(plato.ingredients[2], m)
    const salG = scaleRecipeLine(conv.ingredients.find((l) => l.ingredientId === "sal")!, m)
    expect(salKg.quantity).toBe(0.013) // en kg el escalón es el gramo
    expect(salG.quantity).toBe(12.5) // en g el escalón es 0.1 g
    // la diferencia de costo es como mucho un escalón (1 g × L0.02)
    expect(Math.abs(salG.extension! - salKg.extension!)).toBeLessThanOrEqual(0.02 + 1e-9)
  })
  it("12.3 menú 25 personas + 2 niveles de sub-receta + stock parcial", () => {
    INVENTORY = [{ id: "hueso", name: "hueso", currentStock: 30 } as InventoryItem]
    const r = generateMenuIngredientList("b", menu({ plannedServings: 25, items: [{ id: "a", recipeId: "plato", enabled: true }] as Menu["items"] }))
    expect(r.items.find((i) => i.ingredientId === "hueso")!.quantity).toBeCloseTo(70, 9) // 16 × 6.25 − 30
    INVENTORY = []
  })
  it("12.5 venta de 7 porciones con sub-receta → stock teórico (ver 8.1)", () => {
    const stock = computeTheoreticalStock({ snapshots: [], recipes: RECIPES, ingredients: INGREDIENTS, menus: [], items: [item("harina", { currentStock: 1000, stockCountedAt: "2026-10-20T10:00:00Z" })], salesImports: [sale("2026-10-21", "2026-10-21T20:00:00Z", "plato", 7)] })
    expect(stock.get("harina")!.theoretical).toBeCloseTo(1000 - 192.5, 9) // 1.75 × 110
  })
  it("12.6 rendimiento 1 + PAX 50", () => expect(scaleLineQuantity(12.3, "gramos", paxMultiplierFor(50, 1))).toBe(615))
  it("12.7 rendimiento 12 + PAX 5 (factor < 1)", () => {
    expect(scaleLineQuantity(1000, "gramos", paxMultiplierFor(5, 12))).toBe(416.7) // 416.666 → 416.7
    expect(scaleLineQuantity(1, "kilogramos", paxMultiplierFor(5, 12))).toBe(0.417)
  })
})
