import { NextResponse } from "next/server"
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionValue,
  getAdminPasscode,
  hasAdminSession,
  safeEqual,
} from "@/lib/admin-auth"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// Historia: el código de acceso se leía de NEXT_PUBLIC_ADMIN_PASSCODE (viajaba al navegador,
// docs/33); luego la cookie valía el texto fijo "granted" y se podía falsificar a mano.
// Desde docs/154: comparación en tiempo constante, sin código por defecto en producción,
// límite de intentos por IP y cookie firmada que vence (lib/admin-auth.ts).

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

  const value = createAdminSessionValue()
  if (!value) return NextResponse.json({ ok: false }, { status: 503 })
  const response = NextResponse.json({ ok: true })
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    path: "/",
  })
  return response
}

export async function GET() {
  return NextResponse.json({ unlocked: await hasAdminSession() })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ADMIN_SESSION_COOKIE_NAME)
  return response
}
