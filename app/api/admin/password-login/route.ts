import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE_NAME, createAdminSessionValue } from "@/lib/admin-auth"
import { checkRateLimit, getClientIp, rateLimitLockedFor } from "@/lib/rate-limit"
import { getSupabaseEnv } from "@/lib/supabase/env"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getAdminMember, recordAdminLogin } from "@/lib/admin/members-server"
import { canSignIn } from "@/lib/admin/members"

/**
 * Entrar a /admin con correo y contraseña, sin abrir la sesión de la app (pedido del dueño,
 * docs/298: «no creo que sea necesario que abra sesión en mi cuenta de GastroMetrics para
 * poder ingresar a la cuenta de admin»). La contraseña es la de su cuenta, pero se comprueba
 * aquí con un cliente que no guarda nada: la sesión de Supabase que crea se cierra en el
 * acto y en el navegador solo queda la cookie del panel. Abrir o cerrar la app no la toca.
 * La contraseña nunca se guarda ni se escribe en los registros.
 */

const LIMIT = { maxAttempts: 5, windowMs: 10 * 60_000, lockoutMs: 15 * 60_000 }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : ""
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : ""
  if (!email || !password) return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 })

  const ip = getClientIp(request)
  // Solo los intentos fallidos cuentan, por IP y por correo.
  const fail = (status: number, error: string) => {
    const byIp = checkRateLimit(`admin-password:${ip}`, LIMIT)
    const byEmail = checkRateLimit(`admin-password:${email}`, LIMIT)
    const locked = !byIp.allowed || !byEmail.allowed
    return NextResponse.json(
      { ok: false, error: locked ? "locked" : error, lockedForSeconds: locked ? Math.max(byIp.lockedForSeconds ?? 0, byEmail.lockedForSeconds ?? 0) : 0 },
      { status: locked ? 429 : status },
    )
  }

  // Bloqueado: ni se prueba la contraseña.
  const lockedFor = Math.max(rateLimitLockedFor(`admin-password:${ip}`), rateLimitLockedFor(`admin-password:${email}`))
  if (lockedFor > 0) return NextResponse.json({ ok: false, error: "locked", lockedForSeconds: lockedFor }, { status: 429 })

  const { url, anonKey } = getSupabaseEnv()
  if (!url || !anonKey) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 })
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error || !data.session) return fail(401, "invalid")
  // Esa sesión no se usa: se cierra para que no quede abierta en ningún lado.
  await getSupabaseAdminClient().auth.admin.signOut(data.session.access_token, "local").catch(() => undefined)

  const { ready, member } = await getAdminMember(email)
  if (!ready) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 503 })
  if (!member || !canSignIn(member)) return fail(403, "not_allowed")

  await recordAdminLogin(member)
  const value = createAdminSessionValue(Date.now(), { kind: "account", email })
  if (!value) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 })
  const response = NextResponse.json({ ok: true, role: member.role, firstTime: member.status !== "active" })
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, value, ADMIN_COOKIE_OPTIONS)
  return response
}
