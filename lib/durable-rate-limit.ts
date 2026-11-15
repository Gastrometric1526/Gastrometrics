/**
 * Límite de intentos guardado en la base (docs/312, migración 0042).
 *
 * El de `lib/rate-limit.ts` vive en la memoria de cada función de Vercel: una instancia nueva
 * empieza en cero, así que repartir los intentos lo saltaba. Este se guarda en
 * `security_rate_limits` (solo el servidor la toca) y vale para todas las instancias.
 *
 * Se usa en las entradas que protegen algo grande (el código de /admin y su contraseña). Si la
 * migración todavía no se corrió, o la base no responde, cae al límite en memoria: nunca deja
 * pasar a nadie sin ningún límite, y nunca bloquea a todos por un error de la base.
 */

import { createHash } from "crypto"
import { checkRateLimit, rateLimitLockedFor } from "@/lib/rate-limit"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

interface UntypedRpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export interface DurableLimit {
  maxAttempts: number
  windowMs: number
  lockoutMs: number
}

/** La llave se guarda como hash: sin correos ni direcciones en claro. */
export function hashLimitKey(key: string): string {
  return createHash("sha256").update(`gm-rate-limit-v1:${key}`).digest("hex")
}

async function callLimit(key: string, limit: DurableLimit, count: boolean): Promise<number | null> {
  try {
    // La función no está en types/database.ts (migración 0042): se llama sin tipos, pero como
    // método del cliente (sacar `rpc` suelto pierde `this` y la llamada falla siempre).
    const admin = getSupabaseAdminClient() as unknown as UntypedRpcClient
    const { data, error } = await admin.rpc(
      "security_rate_limit",
      {
        p_key: hashLimitKey(key),
        p_max: limit.maxAttempts,
        p_window_seconds: Math.ceil(limit.windowMs / 1000),
        p_lock_seconds: Math.ceil(limit.lockoutMs / 1000),
        p_count: count,
      },
    )
    if (error || typeof data !== "number") return null
    return data
  } catch {
    return null
  }
}

/** ¿Está bloqueada? No cuenta como intento. Mira la base y la memoria; manda el mayor. */
export async function durableLockedFor(key: string, limit: DurableLimit): Promise<number> {
  const memory = rateLimitLockedFor(key)
  const db = await callLimit(key, limit, false)
  return Math.max(memory, db ?? 0)
}

/** Cuenta un intento fallido en la base y en la memoria. Devuelve los segundos de bloqueo (0 = libre). */
export async function durableRecordFailure(key: string, limit: DurableLimit): Promise<number> {
  const memory = checkRateLimit(key, limit)
  const db = await callLimit(key, limit, true)
  return Math.max(memory.allowed ? 0 : memory.lockedForSeconds, db ?? 0)
}

/** Borra filas viejas (tarea diaria). Sin la migración, no hace nada. */
export async function pruneDurableRateLimits(): Promise<void> {
  try {
    const admin = getSupabaseAdminClient() as unknown as UntypedRpcClient
    await admin.rpc("security_rate_limits_prune", {})
  } catch {
    /* sin la migración 0042: nada que limpiar */
  }
}
