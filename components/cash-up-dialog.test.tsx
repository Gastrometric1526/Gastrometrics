import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"
import { buildImportLines, emptyTicket, ticketsToSave } from "@/lib/manual-sales"
import type { SalesImport } from "@/types/sales-import"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const updateSalesImport = vi.fn(async () => {})
vi.mock("@/lib/storage/sales-imports", () => ({ updateSalesImport: (...a: unknown[]) => updateSalesImport(...(a as [])) }))
vi.mock("@/lib/storage/businesses", () => ({ getBusinessById: () => null }))
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u", name: "Ana", email: "ana@x.test" } }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock("@/lib/services/activity-log", () => ({ logActivity: () => {} }))
vi.mock("@/lib/ocr-usage", () => ({ useOcrUsage: () => () => {} }))
vi.mock("@/lib/recipe-import/ocr", () => ({ OCR_LANG: { es: "spa" }, recognizeRecipeImage: vi.fn() }))
vi.mock("@/lib/plan-access", () => ({ useFeatureAccess: () => true }))

import { CashUpDialog } from "./cash-up-dialog"

const es = translations.es as Record<string, string>
let container: HTMLElement
let root: Root
beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  updateSalesImport.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const item = (id: string, p: number) => ({ id, sourceType: "recipe" as const, refId: id, name: id, quantity: 1, unitPrice: p, unitCost: 1 })
const iso = new Date("2026-10-30T00:00:00").toISOString()
const tickets = [
  { ...emptyTicket("a", { payment: "cash" }), items: [item("a1", 750)] },
  { ...emptyTicket("b", { payment: "card", tip: 100 }), items: [item("b1", 1000)] },
] as ReturnType<typeof emptyTicket>[]
const imp: SalesImport = {
  id: "dia", businessId: "b", fileName: "", importedAt: iso, periodStart: iso, periodEnd: iso, totalRevenue: 1750, totalTheoreticalCost: 2,
  lineCount: 2, unmatchedDishNames: [], source: "manual", lines: buildImportLines(tickets, iso), tickets: ticketsToSave(tickets),
}

const setInput = (el: HTMLInputElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}
const q = <T extends Element>(sel: string) => document.body.querySelector<T>(sel)!

describe("Ventas: cuadre de caja (docs/217)", () => {
  it("calcula la diferencia en vivo y guarda el cuadre en el registro del día", async () => {
    const onSaved = vi.fn()
    await act(async () => {
      root.render(<CashUpDialog open onOpenChange={() => {}} businessId="b" salesImport={imp} onSaved={onSaved} />)
    })
    expect(document.body.textContent).toContain(es.cashup_status_incomplete)

    await act(async () => setInput(q("#cashup-float"), "1000"))
    await act(async () => setInput(q("#cashup-cash"), "1700"))
    await act(async () => setInput(q("#cashup-terminal"), "1100"))
    // Efectivo esperado 1750, contado 1700 → faltan 50.
    expect(document.body.textContent).toContain(es.cashup_status_short)

    const save = [...document.body.querySelectorAll("button")].find((b) => b.textContent === es.cashup_save)!
    await act(async () => save.click())
    expect(updateSalesImport).toHaveBeenCalledTimes(1)
    const saved = (updateSalesImport.mock.calls[0] as unknown as [SalesImport])[0]
    expect(saved.id).toBe("dia")
    expect(saved.lines).toHaveLength(2)
    expect(saved.cashUp).toMatchObject({ openingFloat: 1000, countedCash: 1700, terminalTotal: 1100, transferTotal: null, closedBy: "Ana" })
    expect(onSaved).toHaveBeenCalled()
  })
})

describe("PDF del cuadre (docs/217)", () => {
  it("se genera con el título y el nombre en el idioma", async () => {
    const { generateCashUpPDF, generateCashUpPDFFilename } = await import("@/lib/pdf/cash-up-pdf-generator")
    const { emptyCashUp } = await import("@/lib/cash-up")
    const doc = generateCashUpPDF(imp, { ...emptyCashUp("x"), countedCash: 750, terminalTotal: 1100, payouts: [{ id: "p", concept: "Hielo", amount: 0 }] }, { day: "2026-10-30" })
    const raw = doc.output()
    expect(raw).toContain("Cuadre de caja")
    expect(raw).toContain("Hielo")
    expect(generateCashUpPDFFilename("2026-10-30")).toMatch(/^Cuadre_de_caja_30-10-2026\.pdf$|^Cuadre-de-caja_30-10-2026\.pdf$|30-10-2026\.pdf$/)
  })
})
