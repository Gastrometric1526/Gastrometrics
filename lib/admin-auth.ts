/**
 * Chequeo compartido de la cookie de sesión admin — misma cookie que
 * app/api/admin/verify/route.ts ya otorga tras validar ADMIN_PASSCODE. Cualquier
 * ruta de servidor que solo el dueño del proyecto debe poder llamar (leer/responder
 * feedback, cambiar el plan de una cuenta a mano, etc.) usa esto en vez de duplicar
 * el nombre de la cookie en cada archivo.
 */

import { cookies } from "next/headers"

const ADMIN_SESSION_COOKIE_NAME = "gm_admin_session"

export async function hasAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === "granted"
}
