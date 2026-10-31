import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"
import { toIsoDate } from "@/lib/date-format"
import { formatCurrency } from "@/lib/currency"
import type { SalesImport } from "@/types/sales-import"
import type { Recipe } from "@/types/recipe"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const addSalesImport = vi.fn(async () => {})
const updateSalesImport = vi.fn(async () => {})
vi.mock("@/lib/storage/sales-imports", () => ({ addSalesImport: (...a: unknown[]) => addSalesImport(...(a as [])), updateSalesImport: (...a: unknown[]) => updateSalesImport(...(a as [])) }))
vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: null }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock("@/lib/services/activity-log", () => ({ logActivity: () => {} }))

import { ManualSalesEntryDialog } from "./manual-sales-entry-dialog"

let container: HTMLElement
let root: Root
beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  addSalesImport.mockClear()
  updateSalesImport.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const recipes = [
  { id: "pollo", name: "Pollo asado", unitPrice: 100, costPerServing: 30 },
  { id: "jugo", name: "Jugo natural", unitPrice: 25, costPerServing: 5 },
] as unknown as Recipe[]

// Radix pinta el diálogo en un portal dentro de document.body.
const body = () => document.body
const button = (text: string) => [...body().querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!
const setInput = (el: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event("input", { bubbles: true }))
}
const es = translations.es as Record<string, string>

async function addBySearch(name: string) {
  const search = body().querySelector<HTMLInputElement>(`input[aria-label="${es.ventas_search_placeholder}"]`)!
  await act(async () => setInput(search, name))
  await act(async () => {
    search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  })
}

describe("Ventas: registro manual por mesas (docs/215)", () => {
  it("arma dos cuentas con mesa, descuento y propina, y las guarda", async () => {
    const onSaved = vi.fn()
    await act(async () => {
      root.render(<ManualSalesEntryDialog open onOpenChange={() => {}} businessId="b1" recipes={recipes} menus={[]} onSaved={onSaved} />)
    })

    // Cuenta 1: mesa 5, 2 pollos (dos toques) y un descuento de 20.
    await act(async () => button("5").click())
    await addBySearch("pollo")
    await addBySearch("POLLO")
    await act(async () => setInput(body().querySelector<HTMLInputElement>("#ticket-discount")!, "20"))
    await act(async () => setInput(body().querySelector<HTMLInputElement>("#ticket-tip")!, "15"))
    expect(body().textContent).toContain(formatCurrency(180))

    // Cuenta 2: para llevar, 2 jugos.
    await act(async () => button(es.ventas_ticket_add).click())
    await act(async () => button(es.ventas_channel_takeaway).click())
    await addBySearch("jugo")
    const qty = body().querySelector<HTMLInputElement>(`input[aria-label="${es.manual_sales_quantity_label}"]`)!
    await act(async () => setInput(qty, "2"))

    expect(body().textContent).toContain(es.ventas_summary_tickets.replace("{n}", "2"))
    await act(async () => button(es.manual_sales_save_button).click())

    expect(addSalesImport).toHaveBeenCalledTimes(1)
    const saved = (addSalesImport.mock.calls[0] as unknown as [SalesImport])[0]
    expect(saved.source).toBe("manual")
    expect(saved.tickets).toHaveLength(2)
    expect(saved.tickets![0]).toMatchObject({ table: "5", channel: "dine_in", discount: 20, tip: 15 })
    expect(saved.tickets![1]).toMatchObject({ table: null, channel: "takeaway" })
    expect(saved.lines.map((l) => [l.recipeId, l.quantity, l.revenue])).toEqual([
      ["pollo", 2, 180],
      ["jugo", 2, 50],
    ])
    expect(saved.totalRevenue).toBe(230)
    expect(onSaved).toHaveBeenCalled()
  })

  it("si el día ya tiene ventas, ofrece sumarlas a ese registro", async () => {
    const today = toIsoDate(new Date())
    const existing: SalesImport = {
      id: "dia", businessId: "b1", fileName: "x", importedAt: "2026-10-30T10:00:00Z", periodStart: new Date(`${today}T00:00:00`).toISOString(),
      periodEnd: null, totalRevenue: 100, totalTheoreticalCost: 30, lineCount: 1, unmatchedDishNames: [], source: "manual",
      lines: [{ id: "l1", rawDishName: "Pollo asado", recipeId: "pollo", quantity: 1, unitPrice: 100, revenue: 100, theoreticalCost: 30 }],
    }
    await act(async () => {
      root.render(<ManualSalesEntryDialog open onOpenChange={() => {}} businessId="b1" recipes={recipes} menus={[]} onSaved={() => {}} existingImports={[existing]} />)
    })
    await addBySearch("jugo")
    await act(async () => button(es.ventas_same_day_join).click())
    await act(async () => button(es.equipo_save_changes_button).click())

    expect(addSalesImport).not.toHaveBeenCalled()
    const saved = (updateSalesImport.mock.calls[0] as unknown as [SalesImport])[0]
    expect(saved.id).toBe("dia")
    expect(saved.lines.map((l) => l.recipeId)).toEqual(["pollo", "jugo"])
    expect(saved.totalRevenue).toBe(125)
  })
})
