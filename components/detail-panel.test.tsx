import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createPortal } from "react-dom"
import { createRoot, type Root } from "react-dom/client"
import { Pencil, Trash2, Eye } from "lucide-react"

vi.mock("@/contexts/language-context", () => ({ useLanguage: () => ({ language: "es", t: (key: string) => key }) }))

import { DetailPanel, openOnActivate } from "./detail-panel"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

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

const click = (el: Element) => act(() => el.dispatchEvent(new MouseEvent("click", { bubbles: true })))

describe("panel de acciones (docs/219)", () => {
  it("un clic en la fila abre el panel; un botón o un portal de adentro no", () => {
    const open = vi.fn()
    const portalHost = document.createElement("div")
    document.body.appendChild(portalHost)
    act(() =>
      root.render(
        <div data-testid="row" {...openOnActivate(open)}>
          <span data-testid="name">Pollo</span>
          <button type="button" data-testid="inner">Fecha</button>
          {createPortal(<div data-testid="popover">popover</div>, portalHost)}
        </div>,
      ),
    )
    click(container.querySelector('[data-testid="name"]')!)
    expect(open).toHaveBeenCalledTimes(1)
    click(container.querySelector('[data-testid="inner"]')!)
    click(portalHost.querySelector('[data-testid="popover"]')!)
    expect(open).toHaveBeenCalledTimes(1)
    const row = container.querySelector('[data-testid="row"]')!
    expect(row.getAttribute("role")).toBe("button")
    act(() => row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
    expect(open).toHaveBeenCalledTimes(2)
    portalHost.remove()
  })

  it("muestra datos y acciones (la principal primero) y se cierra al tocar una", () => {
    const onOpenChange = vi.fn()
    const edit = vi.fn()
    const del = vi.fn()
    act(() =>
      root.render(
        <DetailPanel
          open
          onOpenChange={onOpenChange}
          title="Pollo a la plancha"
          badges={[{ label: "Plato fuerte" }]}
          stats={[{ label: "Costo total", value: "L 85.00" }]}
          actions={[
            { key: "view", label: "Ver", icon: Eye, primary: true, onClick: () => {} },
            { key: "edit", label: "Editar", icon: Pencil, onClick: edit },
          ]}
          danger={{ key: "delete", label: "Eliminar", icon: Trash2, onClick: del }}
        />,
      ),
    )
    const panel = document.querySelector("[data-detail-panel]")!
    expect(panel.textContent).toContain("Pollo a la plancha")
    expect(panel.textContent).toContain("Plato fuerte")
    expect(panel.textContent).toContain("L 85.00")
    const buttons = Array.from(panel.querySelectorAll('[data-tour="detail-panel-actions"] button'))
    expect(buttons.map((b) => b.textContent)).toEqual(["Ver", "Editar"])
    click(buttons[1])
    expect(edit).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    const danger = Array.from(panel.querySelectorAll("button")).find((b) => b.textContent === "Eliminar")!
    click(danger)
    expect(del).toHaveBeenCalled()
  })
})
