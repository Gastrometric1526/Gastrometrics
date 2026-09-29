import { describe, it, expect, vi, afterEach } from "vitest"
import { jsPDF } from "jspdf"
import { drawImageFit, imageFormatOf } from "./pdf-image"
import { generateRecipePDF } from "./recipe-pdf-generator"
import { generateMenuPDF } from "./menu-pdf-generator"
import { generateInventoryPDF } from "./inventory-pdf-generator"
import { generatePurchaseOrderPDF } from "./purchase-order-pdf-generator"
import { generateInvoicePDF } from "./invoice-pdf-generator"
import { generateSalesHistoryPDF } from "./sales-history-pdf-generator"
import type { PurchaseOrder } from "@/types/purchase-order"
import type { Invoice } from "@/types/invoice"
import type { Recipe } from "@/types/recipe"
import type { Menu } from "@/lib/types/menus"

// Foto vertical 20×40 px (proporción 1:2) y logo horizontal 60×20 px (3:1).
const TALL_PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAoCAIAAABxU02MAAAAJElEQVR4nGM4ISdHNmIY1TyqeVTzqOZRzaOaRzWPah7VTC4CABHVLK4QZG0PAAAAAElFTkSuQmCC"
const WIDE_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAAUCAIAAABeYcl+AAAAMklEQVR4nO3OAQkAQAgEMJOY5IMZ3xh/wmABVj3vnPo+kA4mLS0dQFpaOoC0tHSAk+kF8BTYjoocI7UAAAAASUVORK5CYII="

const recipe = {
  id: "r1",
  name: "Pan de prueba",
  classification: "Panadería (Boulangerie)",
  plate: "Entrada",
  servings: 1,
  yieldAmount: 10,
  yieldUnit: "porciones",
  ingredients: [
    { id: "l1", ingredientId: "i1", name: "Harina", category: "HARINA", quantity: 300, unit: "gramos", measure: "g", cost: 0, unitCost: 0.018, costPerMeasure: 0.018, extension: 5.4 },
  ],
  procedure: ["Mezclar", "Hornear"],
  totalCost: 5.4,
  costPerServing: 0.54,
  unitPrice: 5,
  businessId: "main",
  image: TALL_PHOTO,
  metadata: { createdAt: "2026-09-29T00:00:00Z", updatedAt: "2026-09-29T00:00:00Z", version: 1 },
} as unknown as Recipe

type Call = [string, string, number, number, number, number]

function imageCalls(spy: ReturnType<typeof vi.spyOn>) {
  return (spy.mock.calls as unknown as Call[]).map(([data, format, x, y, w, h]) => ({ data, format, x, y, w, h }))
}

afterEach(() => vi.restoreAllMocks())

describe("imágenes en los PDF (docs/137)", () => {
  it("detecta el formato real del data URL", () => {
    expect(imageFormatOf(TALL_PHOTO)).toBe("PNG")
    expect(imageFormatOf("data:image/jpeg;base64,xx")).toBe("JPEG")
    expect(imageFormatOf("data:image/webp;base64,xx")).toBe("WEBP")
    expect(imageFormatOf("data:image/svg+xml;base64,xx")).toBeNull()
  })

  it("encaja la imagen sin deformarla y la centra", () => {
    const doc = new jsPDF()
    const drawn = drawImageFit(doc, TALL_PHOTO, 10, 20, 100, 50, "center")!
    expect(drawn.height).toBeCloseTo(50, 6)
    expect(drawn.width).toBeCloseTo(25, 6) // 1:2
    expect(drawn.x).toBeCloseTo(10 + (100 - 25) / 2, 6)
  })

  for (const type of ["administrative", "employee", "normal"] as const) {
    it(`ficha ${type}: logo del negocio y foto grande, sin deformar`, () => {
      const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...args: unknown[]) => unknown }, "addImage")
      generateRecipePDF(recipe, { type, includeImage: true, includeCosts: true, includePricing: true, businessName: "QA", businessLogo: WIDE_LOGO })
      const calls = imageCalls(spy)
      const logo = calls.find((c) => c.data === WIDE_LOGO)
      const photo = calls.find((c) => c.data === TALL_PHOTO)
      expect(logo, "logo").toBeTruthy()
      expect(logo!.w / logo!.h).toBeCloseTo(3, 3)
      expect(photo, "foto").toBeTruthy()
      expect(photo!.format).toBe("PNG")
      expect(photo!.w / photo!.h).toBeCloseTo(0.5, 3)
      expect(photo!.h).toBeGreaterThanOrEqual(80) // buen espacio: 80–95 mm de alto
    })
  }

  it("la carta del cliente también lleva el logo del negocio", () => {
    const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...args: unknown[]) => unknown }, "addImage")
    const menu = {
      id: "m1",
      name: "Carta",
      businessId: "main",
      steps: [{ id: "s1", name: "Entrada", order: 0 }],
      items: [{ id: "it1", recipeId: "r1", stepId: "s1", section: "entrada", enabled: true }],
    } as unknown as Menu
    generateMenuPDF(menu, [recipe], { type: "cliente", businessName: "QA", businessLogo: WIDE_LOGO })
    const logo = imageCalls(spy).find((c) => c.data === WIDE_LOGO)
    expect(logo).toBeTruthy()
    expect(logo!.w / logo!.h).toBeCloseTo(3, 3)
  })

  it("inventario, orden de compra, factura, historial de ventas y menú interno llevan el logo", () => {
    const check = (label: string, run: () => void) => {
      const spy = vi.spyOn(jsPDF.API as unknown as { addImage: (...args: unknown[]) => unknown }, "addImage")
      run()
      const logo = imageCalls(spy).find((c) => c.data === WIDE_LOGO)
      expect(logo, label).toBeTruthy()
      expect(logo!.w / logo!.h, label).toBeCloseTo(3, 3)
      spy.mockRestore()
    }
    const opts = { businessName: "QA", businessLogo: WIDE_LOGO }
    check("inventario", () =>
      generateInventoryPDF(
        { title: "Inventario", subtitle: new Date(), rows: [{ name: "Harina", category: "HARINA", quantity: 1000, unit: "g", price: 450, totalValue: 18, supplier: "", status: "normal" }] } as never,
        opts,
      ),
    )
    check("orden de compra", () =>
      generatePurchaseOrderPDF(
        { id: "po", name: "OC", number: 1, date: "2026-09-29", recipes: [], total: 10, items: [{ name: "Harina", totalQuantity: 1, unit: "kg", costPerUnit: 10, purchaseCost: 10, quantityToBuy: 1, supplier: "X" }] } as PurchaseOrder,
        opts,
      ),
    )
    check("factura", () =>
      generateInvoicePDF(
        { id: "f", number: "F-1", status: "issued", issueDate: "2026-09-29", clientName: "Cliente", items: [{ id: "l", description: "Pan", quantity: 1, unitPrice: 5, amount: 5 }], taxPercent: 0, subtotal: 5, taxAmount: 0, total: 5, metadata: { createdAt: "", updatedAt: "", version: 1 } } as unknown as Invoice,
        opts,
      ),
    )
    check("historial de ventas", () => generateSalesHistoryPDF([], { ...opts, granularity: "day" } as never))
    check("menú interno", () =>
      generateMenuPDF(
        { id: "m1", name: "Carta", businessId: "main", steps: [{ id: "s1", name: "Entrada", order: 0 }], items: [{ id: "it1", recipeId: "r1", stepId: "s1", section: "entrada", enabled: true }] } as unknown as Menu,
        [recipe],
        { type: "interno", ...opts },
      ),
    )
  })
})
