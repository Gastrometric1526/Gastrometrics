import { NextResponse } from "next/server"
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE_NAME, createAdminSessionValue } from "@/lib/admin-auth"
import { getAppAccountEmail } from "@/lib/admin/session-info"
import { getAdminMember, recordAdminLogin } from "@/lib/admin/members-server"
import { canSignIn } from "@/lib/admin/members"

/**
 * Entrar a /admin con la propia cuenta (docs/282): la sesión de la app ya está abierta en
 * este navegador (con su contraseña, en /login); aquí solo se comprueba que ese correo
 * tenga acceso al panel y se abre la sesión del panel a su nombre. Un acceso guardado
 * «sin enviar» todavía no deja entrar.
 */
export async function POST() {
  const email = await getAppAccountEmail()
  if (!email) return NextResponse.json({ ok: false, error: "no_account" }, { status: 401 })

  const { ready, member } = await getAdminMember(email)
  if (!ready) return NextResponse.json({ ok: false, error: "not_ready" }, { status: 503 })
  if (!member || !canSignIn(member)) return NextResponse.json({ ok: false, error: "not_allowed" }, { status: 403 })

  await recordAdminLogin(member)
  const value = createAdminSessionValue(Date.now(), { kind: "account", email })
  if (!value) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 })
  const response = NextResponse.json({ ok: true, role: member.role, firstTime: member.status !== "active" })
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, value, ADMIN_COOKIE_OPTIONS)
  return response
}
