import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { AdminLiveProvider, ADMIN_LIVE_INTERVAL_MS, useAdminLive, useAdminLiveReload } from "./live"

// React 18: habilita act() fuera de testing-library.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let reloads = 0
let refresh: () => void = () => {}
function Probe() {
  useAdminLiveReload(() => {
    reloads++
  })
  refresh = useAdminLive().refreshNow
  return null
}

let visibility: "visible" | "hidden" = "visible"
let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers()
  reloads = 0
  visibility = "visible"
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<AdminLiveProvider><Probe /></AdminLiveProvider>))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

const setVisibility = (v: "visible" | "hidden") => {
  visibility = v
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"))
  })
}

describe("/admin en vivo (docs/192)", () => {
  it("no recarga al montar (de eso se encarga la carga normal del panel)", () => {
    expect(reloads).toBe(0)
  })
  it("recarga cada 30 s mientras la pestaña está visible", () => {
    act(() => vi.advanceTimersByTime(ADMIN_LIVE_INTERVAL_MS))
    expect(reloads).toBe(1)
    act(() => vi.advanceTimersByTime(ADMIN_LIVE_INTERVAL_MS))
    act(() => vi.advanceTimersByTime(ADMIN_LIVE_INTERVAL_MS))
    expect(reloads).toBe(3)
  })
  it("en segundo plano no gasta consultas; al volver recarga al momento", () => {
    setVisibility("hidden")
    act(() => vi.advanceTimersByTime(ADMIN_LIVE_INTERVAL_MS * 5))
    expect(reloads).toBe(0)
    setVisibility("visible")
    expect(reloads).toBe(1)
    act(() => vi.advanceTimersByTime(ADMIN_LIVE_INTERVAL_MS))
    expect(reloads).toBe(2)
  })
  it("«Actualizar ahora» recarga sin esperar", () => {
    act(() => refresh())
    expect(reloads).toBe(1)
  })
})
