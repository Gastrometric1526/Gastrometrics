/**
 * Login sin contraseña, SOLO en local (ver docs/82 — se había quitado en una sesión
 * posterior a pedido del dueño del proyecto, se reintroduce ahora porque pidió
 * explícitamente poder probar la app autenticada). Dos capas de protección:
 *
 * 1. `NODE_ENV !== "development"` → 404. Esta ruta de servidor SÍ se incluye en el
 *    bundle de producción (a diferencia de código de cliente detrás de un `if`, que
 *    se elimina del todo) — por eso el chequeo es en tiempo de EJECUCIÓN, no solo de
 *    build. Un build de producción real (`next build`, lo que corre Vercel siempre
 *    con NODE_ENV=production) nunca ejecuta la rama de abajo.
 * 2. `isTesterEmail(email)` — el mismo helper que ya usa app/api/plan/dev-account/
 *    route.ts, contra TESTER_ALLOWLIST_EMAILS (variable de entorno, nunca en el
 *    código). Nunca cualquier correo, solo cuentas reales ya en la lista blanca.
 *
 * Mecanismo: genera un magic link real de Supabase Auth con el cliente admin
 * (service role) y lo canjea del lado del servidor — dan una sesión real, en las
 * cookies httpOnly de la respuesta, sin que el cliente vea ni maneje ningún token.
 * No crea ninguna cuenta nueva (la cuenta del tester ya existe) y no maneja ninguna
 * contraseña en ningún momento.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { isTesterEmail } from "@/lib/tester-allowlist"

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { email } = await request.json().catch(() => ({ email: null }))
  if (!isTesterEmail(email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email })
  if (error || !data?.properties?.hashed_token) {
    console.error("[api/auth/dev-login] Error generando el magic link:", error)
    return NextResponse.json({ error: "No se pudo generar la sesión" }, { status: 500 })
  }

  const supabase = getSupabaseServerClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  })
  if (verifyError) {
    console.error("[api/auth/dev-login] Error canjeando el magic link:", verifyError)
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
