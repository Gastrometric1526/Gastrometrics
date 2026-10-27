import { describe, expect, it } from "vitest"
import { mailtoUrl, mepShareText, purchaseOrderShareText, shortUnit, whatsappUrl } from "./share-text"
import type { MepEntry } from "./mep"
import type { PurchaseOrder } from "@/types/purchase-order"

const entry = (over: Partial<MepEntry>): MepEntry =>
  ({ key: "k", recipeId: "r", name: "x", kind: "dish", stepName: null, stepOrder: 0, amount: 1, yieldUnit: "porciones", baseYield: 1, multiplier: 1, usedBy: [], depth: 0, lines: [], procedure: [], observations: [], ...over }) as MepEntry

describe("textos para compartir (docs/202)", () => {
  it("unidades cortas y traducidas", () => {
    expect(shortUnit("gramos", "es")).toBe("g")
    expect(shortUnit("kilogramos", "en")).toBe("kg")
    expect(shortUnit("porciones", "es")).toBe("porciones")
  })

  it("MEP: cada plato con sus sub-recetas debajo (docs/207) y el total por sub-receta al final", () => {
    const text = mepShareText({
      menuName: "Almuerzo",
      dateLabel: "28/10/2026",
      servings: 40,
      preps: [entry({ name: "Salsa", kind: "prep", amount: 2250, yieldUnit: "gramos", usedBy: ["Pasta"] })],
      dishes: [
        entry({
          name: "Pasta",
          amount: 40,
          stepName: "Plato fuerte",
          subs: [entry({ name: "Salsa", kind: "sub", amount: 2000, yieldUnit: "gramos", subs: [entry({ name: "Fondo", kind: "sub", amount: 800, yieldUnit: "mililitros" })] })],
        }),
      ],
      language: "es",
      labels: { title: "MEP", people: "personas", preps: "Total por sub-receta", dishes: "Platos", usedIn: "para", sentWith: "Enviado con GastroMetrics" },
    })
    expect(text).toContain("*MEP — Almuerzo*\n28/10/2026 · 40 personas")
    expect(text).toContain("_Plato fuerte_\n☐ Pasta — 40 porciones\n    ☐ Salsa — 2000 g\n        ☐ Fondo — 800 ml")
    expect(text).toContain("*Total por sub-receta*\n☐ Salsa — 2250 g (para Pasta)")
    expect(text.indexOf("Pasta —")).toBeLessThan(text.indexOf("Total por sub-receta"))
  })

  it("orden de compra: cantidades, presentación, proveedor único arriba y total", () => {
    const order = {
      id: "o",
      name: "Almuerzo",
      number: 12,
      date: "2026-10-25",
      recipes: [],
      total: 1790,
      expectedDeliveryDate: "2026-10-27",
      items: [
        { name: "Pollo", totalQuantity: 4, unit: "kilogramos", costPerUnit: 1, purchaseCost: 1, quantityToBuy: 4, supplier: "Distribuidora" },
        { name: "Crema", totalQuantity: 3, unit: "litros", costPerUnit: 1, purchaseCost: 1, quantityToBuy: 3, supplier: "Distribuidora", presentation: "Caja", presentationQuantity: 1 },
      ],
    } as PurchaseOrder
    const text = purchaseOrderShareText({
      order,
      language: "es",
      labels: { title: "Orden de compra", delivery: "Entrega", supplier: "Proveedor", total: "Total estimado", notes: "Notas", sentWith: "Enviado con GastroMetrics" },
      money: (n) => `L ${n.toFixed(2)}`,
      dateLabel: () => "27/10/2026",
    })
    expect(text).toContain("*Orden de compra #12 — Almuerzo*")
    expect(text).toContain("Entrega: 27/10/2026\nProveedor: Distribuidora")
    expect(text).toContain("• Pollo — 4 kg")
    expect(text).toContain("• Crema — 3 L (1 Caja)")
    expect(text).toContain("Total estimado: L 1790.00")
  })

  it("enlaces de WhatsApp y correo con el texto codificado", () => {
    expect(whatsappUrl("a b")).toBe("https://wa.me/?text=a%20b")
    expect(mailtoUrl("Asunto", "x&y")).toBe("mailto:?subject=Asunto&body=x%26y")
  })
})
