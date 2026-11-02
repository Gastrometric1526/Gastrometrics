import { describe, it, expect, vi, afterEach } from "vitest"
import { createBusinessScopedCache, resetAllStorageCaches } from "./supabase-cache"

// docs/229: «entró y la app estaba vacía; al recargar ya funcionaba».
describe("supabase-cache: carga que falla y cambio de cuenta", () => {
  afterEach(() => vi.useRealTimers())

  it("un error no deja la caché «cargada» vacía: se reintenta solo", async () => {
    vi.useFakeTimers()
    const cache = createBusinessScopedCache<number>()
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("JWT expired")).mockResolvedValueOnce([1, 2])
    await cache.ensureLoaded("main", fetcher)
    expect(cache.isLoaded("main")).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(cache.isLoaded("main")).toBe(true)
    expect(cache.getSnapshot("main")).toEqual([1, 2])
  })

  it("al cambiar de cuenta se vacía y vuelve a cargar lo que estaba en uso", async () => {
    const cache = createBusinessScopedCache<string>()
    let account = "sin sesión"
    const fetcher = vi.fn(async () => (account === "sin sesión" ? [] : [account]))
    await cache.ensureLoaded("main", fetcher)
    expect(cache.getSnapshot("main")).toEqual([])
    account = "cuenta-a"
    resetAllStorageCaches()
    await vi.waitFor(() => expect(cache.getSnapshot("main")).toEqual(["cuenta-a"]))
  })

  it("una carga vieja que termina después del reinicio no pisa la nueva", async () => {
    const cache = createBusinessScopedCache<string>()
    // Primera carga (con la sesión vieja) queda colgada; después del reinicio, el mismo
    // fetcher ya responde con la sesión nueva.
    let resolveOld: (v: string[]) => void = () => {}
    let calls = 0
    const fetcher = () => (++calls === 1 ? new Promise<string[]>((r) => (resolveOld = r)) : Promise.resolve(["nuevo"]))
    void cache.ensureLoaded("biz", fetcher)
    const firstResolve = resolveOld
    resetAllStorageCaches()
    await vi.waitFor(() => expect(cache.getSnapshot("biz")).toEqual(["nuevo"]))
    firstResolve(["viejo"])
    await new Promise((r) => setTimeout(r, 0))
    expect(cache.getSnapshot("biz")).toEqual(["nuevo"])
  })
})
