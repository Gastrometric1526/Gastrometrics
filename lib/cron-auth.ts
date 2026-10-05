/**
 * Quién puede llamar a las rutas /api/cron/* (docs/154).
 *
 * - Con CRON_SECRET configurada (lo recomendado): solo quien manda
 *   `Authorization: Bearer <CRON_SECRET>`, que Vercel Cron agrega solo en cada ejecución.
 * - Sin CRON_SECRET, en producción: antes cualquiera podía disparar el cron (y mandar los
 *   correos) con solo abrir la URL. Ahora solo se acepta la llamada programada de Vercel
 *   (user-agent "vercel-cron") y nunca los modos de prueba, que piden sesión de /admin.
 *   Es un respaldo para no cortar los correos diarios mientras falta la variable; el
 *   user-agent se puede imitar, así que configurar CRON_SECRET sigue siendo el paso real.
 * - En desarrollo: libre, como siempre (los modos de prueba no mandan nada).
 */

import { hasAdminSession, safeEqual } from "@/lib/admin-auth"

export async function isAuthorizedCronRequest(request: Request, { dryRun = false } = {}): Promise<boolean> {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const header = request.headers.get("authorization") ?? ""
    if (safeEqual(header, `Bearer ${secret}`)) return true
    return dryRun && (await hasAdminSession())
  }
  if (process.env.NODE_ENV !== "production") return true
  if (dryRun) return hasAdminSession()
  return (request.headers.get("user-agent") ?? "").toLowerCase().startsWith("vercel-cron")
}
