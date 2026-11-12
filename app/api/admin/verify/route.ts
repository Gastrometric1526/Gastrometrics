import { NextResponse } from "next/server"
import { ADMIN_COOKIE_OPTIONS, ADMIN_SESSION_COOKIE_NAME, createAdminSessionValue, getAdminPasscode, safeEqual, type AdminIdentity } from "@/lib/admin-auth"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getAdminSessionInfo, getAppAccountEmail } from "@/lib/admin/session-info"
import { insertAdminMember, listAdminMembers, recordAdminLogin } from "@/lib/admin/members-server"
import { canSignIn } from "@/lib/admin/members"

// Historia: el código de acceso se leía de NEXT_PUBLIC_ADMIN_PASSCODE (viajaba al navegador,
// docs/33); luego la cookie valía el texto fijo "granted" y se podía falsificar a mano.
// Desde docs/154: comparación en tiempo constante, sin código por defecto en producción,
// límite de intentos por IP y cookie firmada que vence (lib/admin-auth.ts).
//
// Desde docs/282 se entra con la propia cuenta (app/api/admin/account-login) y el código
// queda como llave de emergencia. Si se entra con el código estando con una cuenta abierta
// y todavía no hay nadie en admin_members, esa cuenta queda como dueña del panel.

const LIMIT = { maxAttempts: 5, windowMs: 10 * 60_000, lockoutMs: 15 * 60_000 }

export async function POST(request: Request) {
  const passcode = getAdminPasscode()
  if (!passcode) {
    return NextResponse.json({ ok: false, error: "Admin no configurado." }, { status: 503 })
  }

  const ip = getClientIp(request)
  const body = await request.json().catch(() => null)
  const attempt = typeof body?.passcode === "string" ? body.passcode : ""

  if (!attempt || !safeEqual(attempt, passcode)) {
    // Solo los intentos fallidos cuentan para el bloqueo.
    const limit = checkRateLimit(`admin-verify:${ip}`, LIMIT)
    return NextResponse.json(
      { ok: false, lockedForSeconds: limit.allowed ? 0 : limit.lockedForSeconds },
      { status: limit.allowed ? 401 : 429 },
    )
  }

  // Con una cuenta abierta: si no hay dueño todavía, esta cuenta lo es; si ya tiene
  // acceso, la sesión queda a su nombre. Si no, la sesión es «código».
  let identity: AdminIdentity = { kind: "code" }
  let claimedOwner = false
  const accountEmail = await getAppAccountEmail()
  if (accountEmail) {
    const { ready, members } = await listAdminMembers()
    if (ready && members.length === 0) {
      claimedOwner = await insertAdminMember({ email: accountEmail, role: "owner", status: "active", createdBy: accountEmail })
      if (claimedOwner) identity = { kind: "account", email: accountEmail }
    } else {
      const member = members.find((m) => m.email === accountEmail)
      if (member && canSignIn(member)) {
        await recordAdminLogin(member)
        identity = { kind: "account", email: accountEmail }
      }
    }
  }

  const value = createAdminSessionValue(Date.now(), identity)
  if (!value) return NextResponse.json({ ok: false }, { status: 503 })
  const response = NextResponse.json({ ok: true, claimedOwner })
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, value, ADMIN_COOKIE_OPTIONS)
  return response
}

export async function GET() {
  return NextResponse.json(await getAdminSessionInfo())
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME)
  return response
}
