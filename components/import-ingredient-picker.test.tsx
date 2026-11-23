import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"
import type { Ingredient } from "@/types/ingredient"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// cmdk y Radix usan estas APIs del navegador.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= () => {}

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))

import { ImportIngredientPicker } from "./import-ingredient-picker"

const es = translations.es as Record<string, string>
const base = [
  { id: "1", name: "Tomate", supplier: "Mercado" },
  { id: "2", name: "Tomate cherry" },
  { id: "3", name: "Cebolla" },
] as unknown as Ingredient[]
let container: HTMLElement
let root: Root
beforeEach(() => {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("lista plegable de Importar receta (docs/348)", () => {
  it("muestra lo elegido, abre con los sugeridos de la base arriba y permite elegir otro", async () => {
    const onChange = vi.fn()
    await act(async () =>
      root.render(
        <ImportIngredientPicker value="1" readName="tomates" autoId="1" ingredients={base} language="es" createValue="__c" skipValue="__s" onChange={onChange} ariaLabel="x" />,
      ),
    )
    const trigger = container.querySelector("button[role=combobox]") as HTMLButtonElement
    expect(trigger.textContent).toContain("Tomate")
    await act(async () => {
      trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }))
      trigger.click()
    })
    const text = document.body.textContent || ""
    expect(text).toContain(es.recipe_import_pick_suggested)
    expect(text).toContain(es.recipe_import_auto_badge)
    expect(text).toContain(es.recipe_import_create_named.replace("{name}", "tomates"))
    const cherry = [...document.querySelectorAll("[cmdk-item]")].find((el) => el.textContent?.includes("Tomate cherry")) as HTMLElement
    await act(async () => cherry.click())
    expect(onChange).toHaveBeenCalledWith("2")
  })

  it("sin coincidencia: propone crearlo con el nombre leído", async () => {
    await act(async () =>
      root.render(
        <ImportIngredientPicker value="__c" readName="azafrán" autoId={null} ingredients={base} language="es" createValue="__c" skipValue="__s" onChange={() => {}} ariaLabel="x" />,
      ),
    )
    expect(container.textContent).toContain(es.recipe_import_create_named.replace("{name}", "azafrán"))
  })
})
