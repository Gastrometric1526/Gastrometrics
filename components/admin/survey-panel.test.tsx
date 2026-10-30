import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"
import { summarizeSurveyAnswers } from "@/lib/feedback/survey-summary"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))
vi.mock("@/components/admin/live", () => ({ useAdminTick: () => 0 }))

import { SurveyPanel } from "./survey-panel"

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

describe("/admin → Buzón → Encuestas (docs/213)", () => {
  it("muestra cada respuesta con quién, la pregunta y la respuesta, y filtra por pregunta", async () => {
    const rows = [
      { userId: "a", userName: "Ana", question: "pain", answer: "waste", detail: null, at: "2026-10-30T10:00:00Z" },
      { userId: "b", userName: "Beto", question: "ocr_accuracy", answer: "4", detail: null, at: "2026-10-29T10:00:00Z" },
      { userId: "c", userName: "Caro", question: "improve", answer: null, detail: "Más recetas de ejemplo", at: "2026-10-28T10:00:00Z" },
    ]
    const data = {
      summary: summarizeSurveyAnswers(rows),
      answers: rows.map((r) => ({ ...r, email: `${r.userId}@x.test` })),
      total: 3,
    }
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => data })))
    await act(async () => {
      root.render(<SurveyPanel />)
    })
    const body = () => container.querySelector("tbody")!.textContent ?? ""
    expect(body()).toContain("Ana")
    expect(body()).toContain("a@x.test")
    expect(body()).toContain(translations.es.q_pain_opt_waste)
    expect(body()).toContain("4 de 5")
    expect(body()).toContain("Más recetas de ejemplo")

    const filter = [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith(translations.es.q_improve_title))!
    await act(async () => {
      filter.click()
    })
    expect(body()).toContain("Caro")
    expect(body()).not.toContain("Ana")
  })
})
