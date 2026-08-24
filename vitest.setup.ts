// Mock global del cliente de Supabase para pruebas unitarias — las pruebas de
// lib/storage/*.ts y lib/recalculate.test.ts corren en jsdom sin variables de entorno
// de Supabase configuradas (no deberían necesitar red real para probar lógica pura de
// cálculo/cascada de precios). Sin este mock, cualquier módulo de storage migrado a
// Supabase (ver docs/52) lanza "Supabase no está configurado" al intentar persistir en
// segundo plano — la aserción de la prueba en sí no falla (la caché en memoria se
// actualiza de forma síncrona/optimista antes del await a Supabase), pero la promesa
// rechazada sin capturar hace que `vitest` marque la corrida completa como fallida.
import { vi } from "vitest"

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
