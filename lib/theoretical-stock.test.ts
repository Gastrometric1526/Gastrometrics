import { describe, expect, it } from "vitest"
import { accumulateRecipeConsumption, indexById, type ConsumptionMap } from "./recipe-consumption"
import { computeTheoreticalStock } from "./theoretical-stock"
import type { Recipe } from "@/types/recipe"
import type { Ingredient } from "@/types/ingredient"
import type { InventoryItem, InventorySnapshot } from "@/types/inventory"
import type { SalesImport } from "@/types/sales-import"
import type { Menu } from "@/lib/types/menus"

function ingredient(id: string, extra: Partial<Ingredient> = {}): Ingredient {
  return {
    id,
    name: id,
    category: "Otros",
    unit: "gramos",
    pricing: { purchasePrice: 100, netContent: 1000, pricePerUnit: 0.1, lastUpdated: "2026-09-01" },
    supplier: "",
    metadata: { createdAt: "", updatedAt: "", version: 1 },
    ...extra,
  } as Ingredient
}

function recipe(id: string, yieldAmount: number, lines: [string, number][]): Recipe {
  return {
    id,
    name: id,
    classification: "",
    servings: 1,
    yieldAmount,
    yieldUnit: "porciones",
    ingredients: lines.map(([ingredientId, quantity], i) => ({
      id: `${id}-${i}`,
      ingredientId,
      name: ingredientId,
      category: "",
      quantity,
      unit: "",
      measure: "",
      cost: 0,
      unitCost: 0,
      costPerMeasure: 0,
      extension: 0,
    })),
    procedure: [],
    totalCost: 0,
    costPerServing: 0,
    metadata: { createdAt: "", updatedAt: "", version: 1 },
  } as unknown as Recipe
}

// Salsa: rinde 1000 g con 800 g de tomate. Plato: 4 porciones con 200 g de salsa y 600 g de pollo.
const tomate = ingredient("tomate")
const pollo = ingredient("pollo")
const salsaIng = ingredient("salsa-ing", { recipeId: "salsa" } as Partial<Ingredient>)
const salsa = recipe("salsa", 1000, [["tomate", 800]])
const plato = recipe("plato", 4, [["salsa-ing", 200], ["pollo", 600]])
const ingredients = [tomate, pollo, salsaIng]
const recipes = [salsa, plato]

function sale(day: string, importedAt: string, lines: { recipeId?: string; menuId?: string; quantity: number }[]): SalesImport {
  return {
    id: `s-${day}-${importedAt}`,
    businessId: "main",
    fileName: "",
    importedAt,
    periodStart: day,
    periodEnd: day,
    totalRevenue: 0,
    totalTheoreticalCost: 0,
    lineCount: lines.length,
    unmatchedDishNames: [],
    lines: lines.map((l, i) => ({
      id: `l${i}`,
      rawDishName: "",
      recipeId: l.recipeId ?? null,
      menuId: l.menuId ?? null,
      quantity: l.quantity,
      unitPrice: null,
      revenue: 0,
      theoreticalCost: 0,
      date: day,
    })),
  }
}

function item(id: string, extra: Partial<InventoryItem> = {}): InventoryItem {
  return { id, name: id, category: "", currentStock: null, minStock: 0, unit: "gramos", price: 0, lastUpdated: "", status: "normal", ...extra }
}

function snapshot(date: string, quantities: Record<string, number>, received: Record<string, number> = {}): InventorySnapshot {
  return {
    id: date,
    date,
    type: "final",
    modifiedItems: 0,
    totalValue: 0,
    items: Object.entries(quantities).map(([id, quantity]) => ({
      id,
      name: id,
      category: "",
      quantity,
      unit: "gramos",
      price: 0,
      totalPrice: 0,
      receivedSincePrevious: received[id] ?? 0,
    })),
  } as InventorySnapshot
}

describe("accumulateRecipeConsumption", () => {
  it("escala la sub-receta por su rendimiento (200 g de salsa = 20 % de la salsa)", () => {
    const acc: ConsumptionMap = new Map()
    accumulateRecipeConsumption(plato, 1, indexById(recipes), indexById(ingredients), acc)
    expect(acc.get("tomate")?.quantity).toBeCloseTo(160) // 800 × 200/1000
    expect(acc.get("pollo")?.quantity).toBeCloseTo(600)
    expect(acc.has("salsa-ing")).toBe(false)
  })

  it("con merma, convierte a cantidad bruta", () => {
    const polloConMerma = ingredient("pollo", {
      originalNetContent: 1000,
      pricing: { purchasePrice: 100, netContent: 750, pricePerUnit: 0.133, lastUpdated: "" },
    })
    const acc: ConsumptionMap = new Map()
    accumulateRecipeConsumption(plato, 1, indexById(recipes), indexById([tomate, polloConMerma, salsaIng]), acc, {
      grossUpMerma: true,
    })
    expect(acc.get("pollo")?.quantity).toBeCloseTo(800) // 600 aprovechables ÷ 0.75
  })
})

describe("computeTheoreticalStock", () => {
  const snapshots = [snapshot("2026-09-10T08:00:00.000Z", { pollo: 5000, tomate: 3000 })]

  it("resta las ventas posteriores al conteo, por porción vendida", () => {
    // 8 platos vendidos = 2 recetas completas → 1200 g pollo, 320 g tomate
    const sales = [sale("2026-09-12", "2026-09-12T20:00:00.000Z", [{ recipeId: "plato", quantity: 8 }])]
    const r = computeTheoreticalStock({ items: [item("pollo"), item("tomate")], snapshots, salesImports: sales, recipes, ingredients, menus: [] })
    expect(r.get("pollo")?.theoretical).toBeCloseTo(3800)
    expect(r.get("tomate")?.theoretical).toBeCloseTo(2680)
  })

  it("ignora ventas anteriores al conteo y las del mismo día registradas antes", () => {
    const sales = [
      sale("2026-09-09", "2026-09-20T10:00:00.000Z", [{ recipeId: "plato", quantity: 4 }]), // día anterior
      sale("2026-09-10", "2026-09-10T07:00:00.000Z", [{ recipeId: "plato", quantity: 4 }]), // mismo día, antes del conteo
      sale("2026-09-10", "2026-09-10T21:00:00.000Z", [{ recipeId: "plato", quantity: 4 }]), // mismo día, después
    ]
    const r = computeTheoreticalStock({ items: [item("pollo")], snapshots, salesImports: sales, recipes, ingredients, menus: [] })
    expect(r.get("pollo")?.consumed).toBeCloseTo(600)
  })

  it("un menú vendido consume 1 porción de cada plato habilitado", () => {
    const menu = { id: "m1", items: [{ recipeId: "plato", enabled: true }, { recipeId: "salsa", enabled: false }] } as unknown as Menu
    const sales = [sale("2026-09-12", "2026-09-12T20:00:00.000Z", [{ menuId: "m1", quantity: 4 }])]
    const r = computeTheoreticalStock({ items: [item("pollo")], snapshots, salesImports: sales, recipes, ingredients, menus: [menu] })
    expect(r.get("pollo")?.consumed).toBeCloseTo(600)
  })

  it("suma lo recibido por órdenes de compra después del conteo", () => {
    const withReceipt = item("pollo", { stockReceipts: [{ quantity: 2000, at: "2026-09-11T10:00:00.000Z" }] })
    const r = computeTheoreticalStock({ items: [withReceipt], snapshots, salesImports: [], recipes, ingredients, menus: [] })
    expect(r.get("pollo")?.theoretical).toBeCloseTo(7000)
  })

  it("una edición manual más nueva que el último registro pasa a ser el punto de partida", () => {
    const edited = item("pollo", { currentStock: 1000, stockCountedAt: "2026-09-15T12:00:00.000Z" })
    const sales = [sale("2026-09-12", "2026-09-12T20:00:00.000Z", [{ recipeId: "plato", quantity: 8 }])]
    const r = computeTheoreticalStock({ items: [edited], snapshots, salesImports: sales, recipes, ingredients, menus: [] })
    expect(r.get("pollo")?.theoretical).toBeCloseTo(1000)
  })

  it("calcula la diferencia del último conteo contra lo esperado", () => {
    const two = [
      snapshot("2026-09-10T08:00:00.000Z", { pollo: 5000 }),
      snapshot("2026-09-17T08:00:00.000Z", { pollo: 3000 }, { pollo: 500 }),
    ]
    // Esperado: 5000 + 500 recibidos − 1200 vendidos = 4300; contado 3000 → −1300
    const sales = [sale("2026-09-12", "2026-09-12T20:00:00.000Z", [{ recipeId: "plato", quantity: 8 }])]
    const r = computeTheoreticalStock({ items: [item("pollo")], snapshots: two, salesImports: sales, recipes, ingredients, menus: [] })
    expect(r.get("pollo")?.lastCountVariance).toBeCloseTo(-1300)
    expect(r.get("pollo")?.baseline).toBe(3000)
  })

  it("sin ningún conteo no hay stock teórico", () => {
    const r = computeTheoreticalStock({ items: [item("pollo")], snapshots: [], salesImports: [], recipes, ingredients, menus: [] })
    expect(r.has("pollo")).toBe(false)
  })
})
