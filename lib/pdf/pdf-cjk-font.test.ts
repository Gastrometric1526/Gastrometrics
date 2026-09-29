import { describe, it, expect, afterEach } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import { jsPDF } from "jspdf"
import { __setCjkFontBinaryForTests, setPdfCjkMode, CJK_FONT_NAME } from "./pdf-cjk-font"
import { generateRecipePDF } from "./recipe-pdf-generator"
import { generateInventoryPDF } from "./inventory-pdf-generator"
import type { Recipe } from "@/types/recipe"

const fontBinary = readFileSync(path.join(__dirname, "../../public/fonts/NotoSansSC-Regular-subset.ttf")).toString("binary")

afterEach(() => {
  setPdfCjkMode(false)
  __setCjkFontBinaryForTests(null)
})

describe("tipografía china en los PDF (docs/141)", () => {
  it("con la app en chino, cada PDF nuevo usa Noto Sans SC aunque el generador pida helvetica", () => {
    __setCjkFontBinaryForTests(fontBinary)
    setPdfCjkMode(true)
    const doc = new jsPDF()
    expect(doc.getFont().fontName).toBe(CJK_FONT_NAME)
    doc.setFont("helvetica", "bold")
    expect(doc.getFont().fontName).toBe(CJK_FONT_NAME)
    doc.text("红烧肉 Receta 12.50", 10, 10)
    const out = doc.output()
    expect(out).toContain("/BaseFont /NotoSansSC")
    expect(out).toContain("/ToUnicode") // texto copiable/buscable, no solo dibujos
    // Incrusta solo los caracteres usados: el PDF queda muy por debajo de los 2.3 MB de la fuente (~400 KB sin compresión).
    expect(out.length).toBeLessThan(600_000)
  })

  it("en cualquier otro idioma no cambia nada (Helvetica de siempre)", () => {
    __setCjkFontBinaryForTests(fontBinary)
    setPdfCjkMode(false)
    const doc = new jsPDF()
    doc.setFont("helvetica", "bold")
    expect(doc.getFont().fontName).toBe("helvetica")
    expect(doc.output()).not.toContain("NotoSansSC")
  })

  it("los generadores reales (receta y inventario con tablas) salen con la fuente china", () => {
    __setCjkFontBinaryForTests(fontBinary)
    setPdfCjkMode(true)
    const recipe = {
      id: "r1", name: "宫保鸡丁", classification: "Carnes y asados (Rôtisseur)", plate: "Plato fuerte", servings: 1, yieldAmount: 4, yieldUnit: "porciones",
      ingredients: [{ id: "l1", ingredientId: "i1", name: "鸡肉", category: "CARNES", quantity: 300, unit: "gramos", measure: "g", cost: 0, unitCost: 0.02, costPerMeasure: 0.02, extension: 6 }],
      procedure: ["切丁", "翻炒"], totalCost: 6, costPerServing: 1.5, unitPrice: 5, businessId: "main",
      metadata: { createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z", version: 1 },
    } as unknown as Recipe
    for (const type of ["administrative", "employee", "normal"] as const) {
      const out = generateRecipePDF(recipe, { type } as never).output()
      expect(out).toContain("/BaseFont /NotoSansSC")
    }
    const inv = generateInventoryPDF({ title: "库存", subtitle: new Date(), rows: [{ name: "大米", category: "谷物", quantity: 3, unit: "kg", price: 2, totalValue: 6, supplier: "", status: "normal" }] } as never).output()
    expect(inv).toContain("/BaseFont /NotoSansSC")
  })
})
