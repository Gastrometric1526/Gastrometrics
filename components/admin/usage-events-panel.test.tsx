import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/components/admin/live", () => ({ useAdminLiveReload: () => {} }))

import { UsageEventsPanel } from "./usage-events-panel"

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

const kind = (o: Partial<Record<string, number>>) => ({ imports: 0, excel: 0, rows: 0, updated: 0, newIngredients: 0, accounts: 0, ...o })

describe("/admin → Importaciones (docs/211)", () => {
  it("separa ingredientes por Excel y recetas, y filtra por tipo", async () => {
    const at = "2026-10-30T10:00:00Z"
    const data = {
      totals: { imports7: 3, imports30: 3, importRows30: 125, manual7: 0, manual30: 1, manualAccounts30: 1 },
      byKind30: { ingredientes: 2, recetas: 1 },
      byFormat30: { excel: 2, foto: 1 },
      kinds30: { ingredientes: kind({ imports: 2, excel: 1, rows: 120, updated: 8, accounts: 1 }), recetas: kind({ imports: 1, excel: 1, rows: 1, newIngredients: 4, accounts: 1 }), otras: kind({}) },
      events: [
        { createdAt: at, email: "a@x.test", kind: "ingredientes", format: "excel", count: 120, file: "proveedores.xlsx", language: null, source: "archivo", updated: 0 },
        { createdAt: at, email: "a@x.test", kind: "ingredientes", format: "foto", count: 0, file: null, language: null, source: "ticket", updated: 8 },
        { createdAt: at, email: "b@x.test", kind: "recetas", format: "excel", count: 1, file: "Pollo.xlsm", language: null, newIngredients: 4 },
        { createdAt: at, email: "c@x.test", kind: "manual", format: null, count: null, file: null, language: "es" },
      ],
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => data })))
    await act(async () => {
      root.render(<UsageEventsPanel />)
    })
    const text = () => container.textContent ?? ""
    expect(text()).toContain("Ingredientes importados (30 días)")
    expect(text()).toContain("1 por Excel o CSV · 120 nuevos · 8 precios · 1 cuentas")
    expect(text()).toContain("Recetas importadas (30 días)")
    expect(text()).toContain("4 ingredientes creados")
    expect(text()).toContain("Ticket o factura")
    expect(text()).toContain("8 precios actualizados")

    const recetas = [...container.querySelectorAll("button")].find((b) => b.textContent === "Recetas")!
    await act(async () => {
      recetas.click()
    })
    const body = container.querySelector("tbody")!.textContent ?? ""
    expect(body).toContain("Pollo.xlsm")
    expect(body).not.toContain("proveedores.xlsx")
  })
})
