import { describe, expect, it } from "vitest"
import { convertIngredientUnit, convertInventoryItemUnit, convertRecipeLines, convertSnapshotsUnit, unitFactor } from "./unit-change"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

const ing = (over: Partial<Ingredient> = {}): Ingredient =>
  ({ id: "i1", name: "Res", category: "RES", unit: "kilogramos", pricing: { purchasePrice: 100, netContent: 1, pricePerUnit: 100 }, ...over }) as Ingredient

describe("cambio de unidad sin cambiar costos (docs/187)", () => {
  it("factores: kg→g 1000, lb→oz 16, L→ml 1000; «unidad» no se convierte", () => {
    expect(unitFactor("kilogramos", "gramos")).toBe(1000)
    expect(unitFactor("libras", "onzas")).toBe(16)
    expect(unitFactor("litros", "mililitros")).toBe(1000)
    expect(unitFactor("unidad", "gramos")).toBeNull()
    expect(unitFactor("gramos", "gramos")).toBe(1)
  })

  it("1 kg a L100 → 1000 g a L0.10 el gramo (antes quedaba L100 el gramo)", () => {
    const out = convertIngredientUnit(ing(), "gramos", 1000)
    expect(out.unit).toBe("gramos")
    expect(out.pricing.netContent).toBe(1000)
    expect(out.pricing.pricePerUnit).toBeCloseTo(0.1, 8)
    expect(out.pricing.purchasePrice).toBe(100)
  })

  it("con merma: el contenido original y la merma por cantidad también se convierten", () => {
    const out = convertIngredientUnit(
      ing({ originalNetContent: 1, pricing: { purchasePrice: 100, netContent: 0.8, pricePerUnit: 125 } as Ingredient["pricing"], merma: { enabled: true, useGlobal: false, globalPercentage: 0, customType: "quantity", customPercentage: 0, customValue: 0.2 } as Ingredient["merma"] }),
      "gramos",
      1000,
    )
    expect(out.originalNetContent).toBe(1000)
    expect(out.pricing.netContent).toBe(800)
    expect(out.pricing.pricePerUnit).toBeCloseTo(0.125, 8)
    expect(out.merma?.customValue).toBe(200)
  })

  it("las líneas de receta mantienen su costo: 0.2 kg × L100 = 200 g × L0.10", () => {
    const recipes = [
      { id: "r1", ingredients: [{ ingredientId: "i1", quantity: 0.2, unit: "kilogramos", unitCost: 100, extension: 20 }, { ingredientId: "x", quantity: 1, unit: "unidad", unitCost: 5, extension: 5 }] },
      { id: "r2", ingredients: [{ ingredientId: "x", quantity: 1, unit: "unidad", unitCost: 5, extension: 5 }] },
    ] as unknown as Recipe[]
    const changed = convertRecipeLines(recipes, "i1", "gramos", 1000)
    expect(changed.map((r) => r.id)).toEqual(["r1"])
    const line = changed[0].ingredients[0]
    expect(line.quantity).toBe(200)
    expect(line.unit).toBe("gramos")
    expect(line.quantity * line.unitCost).toBeCloseTo(20, 6)
    expect(changed[0].ingredients[1]).toEqual(recipes[0].ingredients[1])
  })

  it("inventario e historial del mismo producto se convierten", () => {
    const item = convertInventoryItemUnit({ id: "i1", name: "Res", category: "RES", currentStock: 2.5, minStock: 1, unit: "kilogramos", price: 100, lastUpdated: "", status: "normal", stockReceipts: [{ quantity: 3, at: "x" }] }, "gramos", 1000)
    expect(item.currentStock).toBe(2500)
    expect(item.minStock).toBe(1000)
    expect(item.stockReceipts?.[0].quantity).toBe(3000)
    const hist = convertSnapshotsUnit(
      [{ id: "s", date: "d", type: "final", modifiedItems: 1, totalValue: 0, items: [{ id: "i1", name: "Res", category: "RES", quantity: 4, unit: "kilogramos", price: 100, totalPrice: 400 }] }],
      "i1",
      "gramos",
      1000,
    )
    expect(hist?.[0].items?.[0].quantity).toBe(4000)
    expect(convertSnapshotsUnit([], "i1", "gramos", 1000)).toBeNull()
  })
})
