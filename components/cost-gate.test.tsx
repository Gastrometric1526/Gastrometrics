// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"

let allowed: boolean | null = true
vi.mock("@/lib/plan-access", () => ({ usePart: () => allowed }))

import { CostOnly } from "./cost-gate"

let root: Root | null = null
let container: HTMLElement | null = null
afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

function render(node: React.ReactNode) {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(node))
  return container
}

describe("quién ve costos (docs/304)", () => {
  it("con permiso, se ve el costo", () => {
    allowed = true
    expect(render(<CostOnly>L 45.00</CostOnly>).textContent).toBe("L 45.00")
  })
  it("sin permiso, no se ve (y se puede mostrar otra cosa)", () => {
    allowed = false
    expect(render(<CostOnly fallback="—">L 45.00</CostOnly>).textContent).toBe("—")
  })
  it("mientras no se sabe quién es, no se muestra", () => {
    allowed = null
    expect(render(<CostOnly>L 45.00</CostOnly>).textContent).toBe("")
  })
})
