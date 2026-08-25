/**
 * Límite de intentos en memoria, compartido entre rutas de servidor — mismo patrón
 * que ya usaba app/api/admin/verify/route.ts (bandeja de intentos + bloqueo temporal),
 * extraído aquí para no repetirlo cada vez que hace falta (ver docs/61).
 *
 * Limitación real, aceptada a propósito: es un Map en memoria del proceso de la
 * función serverless — no persiste entre instancias/cold starts de Vercel, así que no
 * es un límite matemáticamente perfecto bajo carga distribuida. Sigue siendo una
 * defensa real: la mayoría de instancias sí se reusan entre pedidos seguidos (el caso
 * que importa, alguien apretando el botón repetido o un script simple), y levanta la
 * vara lo suficiente sin necesitar contratar Redis/Upstash solo para esto. Documentado
 * así en vez de fingir que es infalible.
 */

interface RateLimitEntry {
  count: number
  windowStartMs: number
  lockedUntilMs: number
}

const buckets = new Map<string, RateLimitEntry>()

export interface RateLimitResult {
  allowed: boolean
  lockedForSeconds: number
}

/**
 * `key` debe identificar a quién se le está limitando el paso (p. ej. `checkout:${userId}`
 * o `feedback:${ip}`) — usar un prefijo distinto por ruta para que un límite no se mezcle
 * con otro. `maxAttempts` intentos dentro de `windowMs`; al superarlo, bloquea por
 * `lockoutMs`.
 */
export function checkRateLimit(
  key: string,
  { maxAttempts, windowMs, lockoutMs }: { maxAttempts: number; windowMs: number; lockoutMs: number },
): RateLimitResult {
  const now = Date.now()
  const entry = buckets.get(key)

  if (entry && entry.lockedUntilMs > now) {
    return { allowed: false, lockedForSeconds: Math.ceil((entry.lockedUntilMs - now) / 1000) }
  }

  if (!entry || now - entry.windowStartMs > windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now, lockedUntilMs: 0 })
    return { allowed: true, lockedForSeconds: 0 }
  }

  const count = entry.count + 1
  if (count > maxAttempts) {
    const lockedUntilMs = now + lockoutMs
    buckets.set(key, { ...entry, count, lockedUntilMs })
    return { allowed: false, lockedForSeconds: Math.ceil(lockoutMs / 1000) }
  }

  buckets.set(key, { ...entry, count })
  return { allowed: true, lockedForSeconds: 0 }
}

/** IP real del cliente detrás de Vercel/cualquier proxy — mismo criterio que ya usaba admin/verify. */
export function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}
