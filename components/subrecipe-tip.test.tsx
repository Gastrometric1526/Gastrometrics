import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const es = translations.es as Record<string, string>
vi.mock("@/contexts/language-context", () => ({ useLanguage: () => ({ language: "es", t: (key: string) => es[key] ?? key }) }))
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

import { SubrecipeTip, SUBRECIPE_TIP_KEY } from "./subrecipe-tip"

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  window.localStorage.clear()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

// docs/299: la nota sobre subrecetas sale mientras no haya ninguna y se cierra con «Entendido».
describe("nota sobre subrecetas", () => {
  it("en Ingredientes dice que va en Ficha Técnica y lleva ahí, con el negocio", async () => {
    await act(async () => root.render(<SubrecipeTip place="ingredientes" show fichaHref="/ficha-tecnica?business=b1" />))
    expect(container.textContent).toContain(es.subrecipe_tip_ingredients)
    expect(container.querySelector('a[href="/ficha-tecnica?business=b1"]')).toBeTruthy()
  })

  it("no sale si ya hay subrecetas, y «Entendido» la cierra en las dos pantallas", async () => {
    await act(async () => root.render(<SubrecipeTip place="ficha" show={false} />))
    expect(container.textContent).toBe("")
    await act(async () => root.render(<SubrecipeTip place="ficha" show />))
    expect(container.textContent).toContain(es.subrecipe_tip_ficha)
    const ok = [...container.querySelectorAll("button")].find((b) => b.textContent === es.subrecipe_tip_ok)!
    await act(async () => ok.click())
    expect(container.textContent).toBe("")
    expect(window.localStorage.getItem(SUBRECIPE_TIP_KEY)).toBe("1")
  })
})
