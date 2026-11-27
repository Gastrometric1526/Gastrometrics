// Mock global del cliente de Supabase para pruebas unitarias — las pruebas de
// lib/storage/*.ts y lib/recalculate.test.ts corren en jsdom sin variables de entorno
// de Supabase configuradas (no deberían necesitar red real para probar lógica pura de
// cálculo/cascada de precios). Sin este mock, cualquier módulo de storage migrado a
// Supabase (ver docs/52) lanza "Supabase no está configurado" al intentar persistir en
// segundo plano — la aserción de la prueba en sí no falla (la caché en memoria se
// actualiza de forma síncrona/optimista antes del await a Supabase), pero la promesa
// rechazada sin capturar hace que `vitest` marque la corrida completa como fallida.
import { vi } from "vitest"

// Node 25+ trae su propio `localStorage`/`sessionStorage` global (Web Storage), que sin
// `--localstorage-file` queda vacío (undefined) y tapa el de jsdom: las pruebas que usan
// `localStorage` fallaban con «Cannot read properties of undefined». Si el global no sirve,
// se pone el de la ventana de jsdom (vitest la deja en `globalThis.jsdom`). En Node 20/22
// el global ya es el de jsdom y esto no hace nada.
const jsdomWindow = (globalThis as { jsdom?: { window: Window } }).jsdom?.window
if (jsdomWindow) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    const current = (globalThis as Record<string, unknown>)[key] as Storage | undefined
    if (typeof current?.clear !== "function") {
      Object.defineProperty(globalThis, key, { value: jsdomWindow[key], configurable: true, writable: true })
    }
  }
}

function createQueryBuilder(): any {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    in: () => builder,
    order: () => builder,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    upsert: () => Promise.resolve({ data: null, error: null }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => builder,
    delete: () => builder,
    then: (resolve: (value: { data: never[]; error: null }) => void) => resolve({ data: [], error: null }),
  }
  return builder
}

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "test-user-id", email: "test@example.com" } } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => createQueryBuilder(),
  }),
}))
