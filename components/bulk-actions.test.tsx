import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import translations from "@/lib/i18n/translations"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock("@/contexts/language-context", () => ({
  useLanguage: () => ({ language: "es", t: (key: string) => (translations.es as Record<string, string>)[key] ?? key }),
}))

import { BulkDeleteDialog, BulkSelectBar, useBulkSelection } from "./bulk-actions"

const es = translations.es as Record<string, string>
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

const button = (label: string) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === label) as HTMLButtonElement | undefined

function Harness({ onMigrate, onDelete }: { onMigrate: () => void; onDelete: () => void }) {
  const bulk = useBulkSelection()
  const items = ["a", "b", "c"]
  return (
    <div>
      {!bulk.active && <button onClick={bulk.start}>{es.bulk_select}</button>}
      {bulk.active &&
        items.map((id) => (
          <button key={id} aria-pressed={bulk.ids.has(id)} onClick={() => bulk.toggle(id)}>
            item-{id}
          </button>
        ))}
      {bulk.active && (
        <BulkSelectBar
          count={bulk.ids.size}
          total={items.length}
          onSelectAll={() => bulk.setAll(items)}
          onClear={bulk.clear}
          onDone={bulk.stop}
          onMigrate={onMigrate}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

describe("selección múltiple (docs/345)", () => {
  it("elige, elige todo, quita y termina; migrar y borrar se apagan sin nada elegido", () => {
    const onMigrate = vi.fn()
    const onDelete = vi.fn()
    act(() => root.render(<Harness onMigrate={onMigrate} onDelete={onDelete} />))
    act(() => button(es.bulk_select)!.click())
    expect(container.textContent).toContain(es.bulk_selected_count.replace("{count}", "0"))
    expect(button(es.bulk_migrate)!.disabled).toBe(true)
    expect(button(es.common_delete)!.disabled).toBe(true)

    act(() => button("item-b")!.click())
    expect(container.textContent).toContain(es.bulk_selected_count.replace("{count}", "1"))
    act(() => button(es.bulk_migrate)!.click())
    expect(onMigrate).toHaveBeenCalledTimes(1)

    act(() => button(es.bulk_select_all)!.click())
    expect(container.textContent).toContain(es.bulk_selected_count.replace("{count}", "3"))
    act(() => button(es.bulk_clear)!.click())
    expect(container.textContent).toContain(es.bulk_selected_count.replace("{count}", "0"))

    act(() => button("item-a")!.click())
    act(() => button(es.common_delete)!.click())
    expect(onDelete).toHaveBeenCalledTimes(1)

    act(() => (document.querySelector(`[aria-label="${es.bulk_done}"]`) as HTMLButtonElement).click())
    expect(button(es.bulk_select)).toBeTruthy()
  })

  it("borrar pide confirmación antes de hacer nada", async () => {
    const onConfirm = vi.fn(async () => {})
    function D() {
      const [open, setOpen] = useState(true)
      return <BulkDeleteDialog open={open} onOpenChange={setOpen} title="¿Borrar 2?" description="desc" confirmLabel="Borrar ya" onConfirm={onConfirm} />
    }
    act(() => root.render(<D />))
    expect(document.body.textContent).toContain("¿Borrar 2?")
    expect(onConfirm).not.toHaveBeenCalled()
    await act(async () => button("Borrar ya")!.click())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe("lo que un filtro esconde deja de estar elegido (docs/353)", () => {
  it("keepOnly conserva solo lo visible", () => {
    let api: ReturnType<typeof useBulkSelection>
    function H() {
      api = useBulkSelection()
      return null
    }
    act(() => root.render(<H />))
    act(() => api.setAll(["a", "b", "c"]))
    act(() => api.keepOnly(["b"]))
    expect([...api!.ids]).toEqual(["b"])
  })
})
