import { describe, it, expect, vi, afterEach } from "vitest"
import { jsPDF } from "jspdf"
import { generateRecipePDF } from "./recipe-pdf-generator"
import { generateMenuPDF } from "./menu-pdf-generator"
import type { DishTag } from "@/lib/dish-tags"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"

// Ícono de prueba (PNG cuadrado de 1 px) en lugar del dibujado en canvas.
const ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

const recipe = {
  id: "r1",
  name: "Tortilla de arroz",
  classification: "Panadería (Boulangerie)",
  yieldAmount: 4,
  yieldUnit: "porciones",
  ingredients: [{ id: "l1", ingredientId: "i1", name: "Harina de arroz", quantity: 300, unit: "gramos", measure: "g", cost: 1, unitCost: 0.01, costPerMeasure: 0.01, extension: 3 }],
  procedure: ["Mezclar"],
  totalCost: 3,
  costPerServing: 0.75,
  unitPrice: 5,
  businessId: "main",
  metadata: { createdAt: "2026-11-16T00:00:00Z", updatedAt: "2026-11-16T00:00:00Z", version: 1 },
} as unknown as Recipe

const tags: DishTag[] = [
  { key: "vegan", kind: "claim", text: "Vegano" },
  { key: "gluten_free", kind: "claim", text: "Sin gluten" },
  { key: "soy", kind: "allergen", text: "Soya" },
  { key: "may_contain", kind: "trace", text: "Puede contener trazas de Maní" },
]

afterEach(() => vi.restoreAllMocks())

const textOf = (doc: jsPDF) => doc.output()

describe("etiquetas del plato en los PDF (docs/324)", () => {
  for (const type of ["administrative", "employee", "normal"] as const) {
    it(`ficha ${type}: íconos y texto`, () => {
      const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, "addImage")
      const doc = generateRecipePDF(recipe, { type, dishTags: tags, dishLabelMode: "both", dishIcons: { vegan: ICON, gluten_free: ICON, soy: ICON, may_contain: ICON } })
      expect((spy.mock.calls as unknown[][]).filter((c) => c[0] === ICON).length).toBe(4)
      const out = textOf(doc)
      expect(out).toContain("Vegano")
      expect(out).toContain("Puede contener trazas de Man")
    })
  }

  it("ficha solo texto no dibuja íconos; «No mostrar» no dibuja nada", () => {
    const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...a: unknown[]) => unknown }, "addImage")
    const text = generateRecipePDF(recipe, { type: "normal", dishTags: tags, dishLabelMode: "text", dishIcons: { vegan: ICON } })
    expect((spy.mock.calls as unknown[][]).some((c) => c[0] === ICON)).toBe(false)
    expect(textOf(text)).toContain("Sin gluten")
    const none = generateRecipePDF(recipe, { type: "normal", dishTags: tags, dishLabelMode: "none" })
    expect(textOf(none)).not.toContain("Sin gluten")
  })

  it("carta solo con íconos lleva la leyenda", () => {
    const menu = {
      id: "m1",
      name: "Carta",
      businessId: "main",
      steps: [{ id: "s1", name: "Entrada", order: 0 }],
      items: [{ id: "it1", recipeId: "r1", stepId: "s1", section: "entrada", enabled: true }],
    } as unknown as Menu
    const doc = generateMenuPDF(menu, [recipe], {
      type: "cliente",
      dishTagsByRecipeId: { r1: tags },
      dishLabelMode: "icons",
      dishIcons: { vegan: ICON, gluten_free: ICON, soy: ICON },
      dishLegendTitle: "Leyenda de iconos",
    })
    const out = textOf(doc)
    expect(out).toContain("Leyenda de iconos")
    expect(out).toContain("Vegano") // en la leyenda
  })
})
