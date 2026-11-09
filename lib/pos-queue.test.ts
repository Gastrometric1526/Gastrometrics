// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { dequeueOrder, enqueueOrder, overlayQueued, readQueue } from "@/lib/pos-queue"
import type { PosOrder } from "@/types/pos"

const o = (id: string, n: number): PosOrder =>
  ({ id, tableId: "t", tableLabel: "5", areaName: null, channel: "dine_in", guests: n, waiter: null, openedAt: "", status: "open", items: [], updatedAt: String(n) }) as PosOrder

describe("cola del POS sin conexión (docs/275)", () => {
  beforeEach(() => localStorage.clear())

  it("guarda el último cambio y conserva la base del primero", () => {
    enqueueOrder("main", o("a", 1), o("a", 2))
    enqueueOrder("main", o("a", 2), o("a", 3))
    const q = readQueue("main")
    expect(q.a.base?.guests).toBe(1)
    expect(q.a.mine.guests).toBe(3)
    dequeueOrder("main", "a")
    expect(readQueue("main")).toEqual({})
  })

  it("la pantalla muestra lo que está en cola encima de lo leído, sin revivir mesas cerradas", () => {
    enqueueOrder("main", o("a", 1), o("a", 5))
    enqueueOrder("main", null, o("nuevo", 2))
    enqueueOrder("main", o("cerrado", 1), o("cerrado", 4))
    const shown = overlayQueued([o("a", 1), o("b", 1)], readQueue("main"))
    expect(shown.find((x) => x.id === "a")?.guests).toBe(5)
    expect(shown.map((x) => x.id).sort()).toEqual(["a", "b", "nuevo"])
  })

  it("cada negocio tiene su propia cola", () => {
    enqueueOrder("main", null, o("a", 1))
    expect(readQueue("otro")).toEqual({})
  })
})
