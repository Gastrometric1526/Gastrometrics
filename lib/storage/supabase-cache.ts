/**
 * Caché reactiva compartida por los módulos de lib/storage/*.ts que ya migraron a
 * Supabase (ver docs/52). Existe para resolver un problema concreto: casi toda la app
 * llama a getIngredients(businessId)/getRecipes(businessId)/etc. de forma SÍNCRONA
 * durante el render (dentro de useMemo), en ~20 pantallas — convertir cada una de esas
 * pantallas a async (useState + useEffect + loading state) habría sido un refactor
 * enorme y riesgoso para hacerlo de una sola vez en una sesión.
 *
 * En su lugar: cada módulo (ingredients.ts, recipes.ts, ...) mantiene una instancia de
 * esta caché. getXxx(businessId) sigue siendo síncrona (lee lo que ya está en memoria —
 * `[]` antes de la primera carga, igual que localStorage vacío antes). useXxx(businessId)
 * es un hook nuevo que dispara la carga real desde Supabase la primera vez que se usa
 * ese businessId, y usa useSyncExternalStore para que el componente se re-renderice
 * solo cuando la caché de ESE businessId cambie — sin tener que envolver cada pantalla
 * en su propio useEffect/useState. Las escrituras (saveXxx/addXxx/...) actualizan la
 * caché de inmediato (optimista) y en paralelo escriben a Supabase — mismo patrón de
 * "la UI no espera a la red" que ya tenía localStorage, ahora con persistencia real.
 */

import { useEffect, useSyncExternalStore } from "react"

// BUG REAL CORREGIDO (docs/229, «entró y la app estaba vacía; al recargar ya funcionaba»):
// 1. Si la primera carga fallaba (token vencido al volver tras horas, corte de red), el
//    fetcher devolvía [] y la caché lo marcaba como «cargado»: la pantalla quedaba vacía
//    hasta recargar. Ahora un error NO marca cargado y se reintenta solo (1 s, 3 s, 8 s).
// 2. La caché nunca se limpiaba al iniciar o cerrar sesión: lo que se cargó sin sesión
//    (RLS devuelve [] sin error) o con otra cuenta en la misma pestaña se quedaba. Ahora
//    auth-context llama a resetAllStorageCaches() cuando cambia la cuenta, y cada caché
//    vuelve a cargar lo que las pantallas montadas estaban mirando.
const registry = new Set<{ reset: () => void }>()

/** Vacía todas las cachés y recarga lo que estaba en uso (cambio de cuenta o de sesión). */
export function resetAllStorageCaches(): void {
  registry.forEach((c) => c.reset())
}

const RETRY_DELAYS_MS = [1000, 3000, 8000]

export function createBusinessScopedCache<T>() {
  const cache = new Map<string, T[]>()
  const loaded = new Set<string>()
  const inFlight = new Map<string, Promise<void>>()
  const listeners = new Set<() => void>()
  // Último fetcher pedido por cada key: para recargar después de un reset o un error.
  const fetchers = new Map<string, () => Promise<T[]>>()
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  // Cuenta de reinicios: una carga que empezó antes de un reset no pisa la nueva.
  let generation = 0
  // BUG REAL CORREGIDO (ver docs/55): useCached() le pasaba a useSyncExternalStore un
  // getSnapshot que, mientras la caché de ese businessId todavía estuviera fría, devolvía
  // `?? []` — un array literal NUEVO en cada llamada. useSyncExternalStore compara
  // snapshots por referencia (Object.is), así que cada render veía un snapshot
  // "distinto" aunque los datos siguieran siendo "vacío", entraba en re-render
  // inmediato, volvía a llamar a getSnapshot, veía OTRO array nuevo... bucle infinito
  // real ("Maximum update depth exceeded") en cualquier pantalla que montara con un
  // businessId que la caché nunca hubiera cargado — reproducido en vivo entrando
  // directo a /business/[id] con la sesión recién iniciada, antes de que cualquier otra
  // pantalla hubiera precalentado la caché de negocios. Una única referencia vacía
  // estable por instancia de caché rompe el bucle: sigue siendo "[]" para quien lo lee,
  // pero la MISMA referencia en cada llamada mientras no haya datos reales.
  const EMPTY: T[] = []

  function keyFor(businessId?: string | null): string {
    return businessId || "main"
  }

  function notify(): void {
    listeners.forEach((listener) => listener())
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot(businessId?: string | null): T[] {
    return cache.get(keyFor(businessId)) ?? EMPTY
  }

  function isLoaded(businessId?: string | null): boolean {
    return loaded.has(keyFor(businessId))
  }

  function setSnapshot(businessId: string | null | undefined, items: T[]): void {
    cache.set(keyFor(businessId), items)
    loaded.add(keyFor(businessId))
    notify()
  }

  /** Actualización optimista: cambia la caché al instante, sin esperar a Supabase. */
  function mutateSnapshot(businessId: string | null | undefined, updater: (current: T[]) => T[]): T[] {
    const key = keyFor(businessId)
    const next = updater(cache.get(key) ?? [])
    cache.set(key, next)
    loaded.add(key)
    notify()
    return next
  }

  function ensureLoaded(
    businessId: string | null | undefined,
    fetcher: () => Promise<T[]>,
    attempt = 0,
  ): Promise<void> {
    const key = keyFor(businessId)
    fetchers.set(key, fetcher)
    if (loaded.has(key)) return Promise.resolve()
    const existing = inFlight.get(key)
    if (existing) return existing

    const startedAt = generation
    const promise = Promise.resolve()
      .then(fetcher)
      .then((items) => {
        if (startedAt !== generation) return
        setSnapshot(businessId, items)
      })
      .catch((error) => {
        console.error("[storage] Error cargando datos de Supabase:", error)
        if (startedAt !== generation || attempt >= RETRY_DELAYS_MS.length) return
        // No se marca como cargado: se reintenta solo y, si no, la próxima pantalla que
        // lo pida vuelve a intentarlo.
        clearTimeout(retryTimers.get(key))
        retryTimers.set(
          key,
          setTimeout(() => {
            retryTimers.delete(key)
            const latest = fetchers.get(key)
            if (latest && !loaded.has(key)) void ensureLoaded(businessId, latest, attempt + 1)
          }, RETRY_DELAYS_MS[attempt]),
        )
      })
      .finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key)
      })

    inFlight.set(key, promise)
    return promise
  }

  /** Fuerza una recarga real desde Supabase, ignorando lo que ya haya en caché. */
  function invalidate(businessId: string | null | undefined): void {
    loaded.delete(keyFor(businessId))
  }

  function reset(): void {
    generation++
    retryTimers.forEach((t) => clearTimeout(t))
    retryTimers.clear()
    inFlight.clear()
    cache.clear()
    loaded.clear()
    notify()
    // Lo que alguna pantalla ya pidió se vuelve a cargar con la sesión nueva.
    fetchers.forEach((fetcher, key) => void ensureLoaded(key === "main" ? null : key, fetcher))
  }
  registry.add({ reset })

  function useCached(businessId: string | null | undefined, fetcher: () => Promise<T[]>): T[] {
    const key = keyFor(businessId)
    useEffect(() => {
      ensureLoaded(businessId, fetcher)
      // Solo depende de la key real del negocio — pasar `fetcher` en deps causaría un
      // loop si el llamador no lo memoiza; es una función pura de `businessId` en todos
      // los usos reales, así que omitirla es seguro.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])
    return useSyncExternalStore(
      subscribe,
      () => getSnapshot(businessId),
      () => EMPTY,
    )
  }

  return { getSnapshot, setSnapshot, mutateSnapshot, ensureLoaded, invalidate, isLoaded, useCached, subscribe }
}
