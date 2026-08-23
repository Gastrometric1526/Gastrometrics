/**
 * Adaptador de backend — ver docs/12-guia-backend.md para la guía completa
 * de cómo conectar un backend real.
 *
 * QUÉ ES ESTO: una interfaz que define cómo la app guarda y lee datos, sin
 * amarrarla a localStorage. Hoy la única implementación es localStorage
 * (LocalStorageBackend, abajo) — exactamente el mismo comportamiento que ya
 * tenía la app, solo que ahora pasa por esta interfaz. El día que se
 * contrate un backend real, se escribe una segunda clase que implemente
 * `StorageBackend` (ej. SupabaseBackend) y se cambia una sola línea al
 * final de este archivo — nada más en la app necesita cambiar, siempre que
 * los módulos de lib/storage/*.ts se actualicen para llamar a este
 * adaptador en vez de a localStorage directamente (ver sección "Cómo migrar
 * un módulo" en la guía).
 *
 * IMPORTANTE — decisión de diseño: los métodos son async (devuelven
 * Promise) aunque la implementación actual (localStorage) es síncrona.
 * Esto es intencional: un backend real siempre es asíncrono (llamadas de
 * red), así que la interfaz ya está lista para eso desde ahora. Migrar un
 * módulo de storage a usar este adaptador significa que las funciones que
 * lo llamen también deben volverse async — es un cambio real, no
 * automático, y por eso NO se hizo de golpe en toda la app (ver la guía
 * para el porqué y el orden recomendado).
 */

export interface StorageBackend {
  get<T>(key: string, businessId?: string | null): Promise<T | null>
  set<T>(key: string, data: T, businessId?: string | null): Promise<void>
  remove(key: string, businessId?: string | null): Promise<void>
}

/**
 * Implementación actual: localStorage, envuelta en Promise para cumplir la
 * interfaz. Reutiliza exactamente la misma lógica de claves múltiples
 * (business-prefixed, gastrometrics-prefixed, etc.) que ya vivía en
 * lib/storage/core.ts, para no cambiar el comportamiento de lectura de
 * datos ya guardados por usuarios existentes.
 */
class LocalStorageBackend implements StorageBackend {
  async get<T>(key: string, businessId?: string | null): Promise<T | null> {
    if (typeof window === "undefined") return null

    const possibleKeys = businessId
      ? [`${key}_${businessId}`, `business_${businessId}_${key}`, `gastrometrics_${key}`, key]
      : [`gastrometrics_${key}`, key]

    for (const storageKey of possibleKeys) {
      try {
        const data = localStorage.getItem(storageKey)
        if (data) {
          const parsed = JSON.parse(data)
          if (Array.isArray(parsed) ? parsed.length > 0 : parsed) {
            return parsed
          }
        }
      } catch (error) {
        console.error(`[StorageBackend] Error reading key ${storageKey}:`, error)
      }
    }
    return null
  }

  async set<T>(key: string, data: T, businessId?: string | null): Promise<void> {
    if (typeof window === "undefined") return

    const targetBusinessId = businessId || "main"
    const keys = [`${key}_${targetBusinessId}`, `business_${targetBusinessId}_${key}`, `gastrometrics_${key}`, key]
    const serializedData = JSON.stringify(data)

    keys.forEach((storageKey) => {
      try {
        localStorage.setItem(storageKey, serializedData)
      } catch (error) {
        console.error(`[StorageBackend] Error saving key ${storageKey}:`, error)
      }
    })
  }

  async remove(key: string, businessId?: string | null): Promise<void> {
    if (typeof window === "undefined") return

    const targetBusinessId = businessId || "main"
    const keys = [`${key}_${targetBusinessId}`, `business_${targetBusinessId}_${key}`, `gastrometrics_${key}`, key]

    keys.forEach((storageKey) => {
      try {
        localStorage.removeItem(storageKey)
      } catch (error) {
        console.error(`[StorageBackend] Error removing key ${storageKey}:`, error)
      }
    })
  }
}

/**
 * Implementación real con Supabase — código completo, NO activada todavía
 * (ver la línea final de este archivo: `storageBackend` sigue siendo
 * `LocalStorageBackend`). No se ha probado contra un proyecto real porque
 * no existe uno en este entorno (ver docs/12-guia-backend.md).
 *
 * DIFERENCIA DE FORMA IMPORTANTE: localStorage guarda un blob por
 * "colección" (ej. la clave "recipes" es un array con TODAS las recetas del
 * negocio). Supabase es relacional — cada receta es su propia fila. Esta
 * clase traduce entre ambos mundos para no tener que tocar la interfaz
 * `StorageBackend` ni, todavía, los ~15 módulos de lib/storage/*.ts que la
 * usarían (ver la guía, sección "Cómo migrar un módulo", sobre por qué esa
 * migración se deja para después, con este adaptador ya listo para
 * recibirla).
 *
 * `key` mapea a nombre de tabla vía TABLE_MAP. Las claves legado sin tabla
 * propia en supabase/migrations/0001_init.sql ("inventoryHistory" — se
 * modela hoy como snapshots dentro de inventory_snapshots, no una tabla
 * aparte) lanzan un error explícito en vez de fallar en silencio.
 */
class SupabaseBackend implements StorageBackend {
  private readonly TABLE_MAP: Partial<Record<string, string>> = {
    recipes: "recipes",
    ingredients: "ingredients",
    businesses: "businesses",
    purchaseOrders: "purchase_orders",
    inventory: "inventory_items",
    pricingDefaults: "businesses", // se lee/escribe como columnas de businesses, no una tabla propia
  }

  private tableFor(key: string): string {
    const table = this.TABLE_MAP[key]
    if (!table) {
      throw new Error(
        `[SupabaseBackend] La clave "${key}" todavía no tiene tabla asignada — revisa TABLE_MAP en ` +
          `lib/storage/backend-adapter.ts y supabase/migrations/0001_init.sql antes de usarla contra Supabase.`,
      )
    }
    return table
  }

  async get<T>(key: string, businessId?: string | null): Promise<T | null> {
    // Import perezoso: si nunca se llama a este método (que es el caso hoy,
    // storageBackend sigue siendo LocalStorageBackend), no hace falta que
    // @supabase/ssr ni las variables de entorno estén listas para que el
    // resto de la app importe este archivo sin romperse.
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
    const supabase = getSupabaseBrowserClient()
    const table = this.tableFor(key)

    let query = supabase.from(table).select("*")
    if (businessId && businessId !== "main") {
      query = query.eq("business_id", businessId)
    } else {
      query = query.is("business_id", null)
    }

    const { data, error } = await query
    if (error) {
      console.error(`[SupabaseBackend] Error leyendo "${key}":`, error)
      return null
    }
    return (data as T) ?? null
  }

  async set<T>(key: string, data: T, businessId?: string | null): Promise<void> {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
    const supabase = getSupabaseBrowserClient()
    const table = this.tableFor(key)

    if (!Array.isArray(data)) {
      console.error(`[SupabaseBackend] set("${key}") esperaba un array (una fila por ítem), recibió:`, data)
      return
    }

    const targetBusinessId = businessId && businessId !== "main" ? businessId : null
    const rows = (data as unknown[]).map((row) => ({ ...(row as object), business_id: targetBusinessId }))

    // Upsert por id — asume que cada fila ya trae su propio `id` (uuid),
    // igual que hace hoy la app al generar ids del lado del cliente.
    const { error } = await supabase.from(table).upsert(rows as never[])
    if (error) {
      console.error(`[SupabaseBackend] Error guardando "${key}":`, error)
    }
  }

  async remove(key: string, businessId?: string | null): Promise<void> {
    const { getSupabaseBrowserClient } = await import("@/lib/supabase/client")
    const supabase = getSupabaseBrowserClient()
    const table = this.tableFor(key)

    let query = supabase.from(table).delete()
    if (businessId && businessId !== "main") {
      query = query.eq("business_id", businessId)
    } else {
      query = query.is("business_id", null)
    }

    const { error } = await query
    if (error) {
      console.error(`[SupabaseBackend] Error borrando "${key}":`, error)
    }
  }
}

// ÚNICA línea a cambiar cuando se conecte un backend real:
// export const storageBackend: StorageBackend = new SupabaseBackend()
export const storageBackend: StorageBackend = new LocalStorageBackend()
