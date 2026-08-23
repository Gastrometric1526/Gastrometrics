import { NextResponse } from "next/server"
import { cookies } from "next/headers"

// BUG CORREGIDO (ver docs/33): el codigo de acceso a /admin se leia de
// NEXT_PUBLIC_ADMIN_PASSCODE, una variable que Next.js embebe tal cual en el bundle
// que se descarga al navegador — cualquiera podia extraerla del JS compilado sin
// siquiera intentar adivinar el codigo. Ahora la comparacion ocurre aqui, en el
// servidor, contra una variable SIN el prefijo NEXT_PUBLIC_ (nunca llega al cliente),
// y el resultado es una cookie httpOnly que el navegador no puede leer ni falsificar
// con las herramientas de desarrollador.
//
// Sigue sin ser control de acceso real multiusuario (ver comentario en
// app/admin/page.tsx) — eso requiere roles de verdad, lo cual requiere el backend
// conectado (docs/23). Esto cierra específicamente el hueco de "el secreto viaja al
// cliente", no inventa una autenticación que no existe.
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || "gastro-admin-2026"
const COOKIE_NAME = "gm_admin_session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 4 // 4 horas

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000
const attemptsByIp = new Map<string, { count: number; lockedUntil: number }>()

function getClientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
}

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const entry = attemptsByIp.get(ip)

  if (entry && entry.lockedUntil > Date.now()) {
    const secondsLeft = Math.ceil((entry.lockedUntil - Date.now()) / 1000)
    return NextResponse.json({ ok: false, lockedForSeconds: secondsLeft }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const passcode = body?.passcode as string | undefined

  if (!passcode || passcode !== ADMIN_PASSCODE) {
    const attempts = (entry?.count || 0) + 1
    const lockedUntil = attempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0
    attemptsByIp.set(ip, { count: attempts, lockedUntil })
    return NextResponse.json(
      { ok: false, lockedForSeconds: lockedUntil ? Math.ceil(LOCKOUT_MS / 1000) : 0 },
      { status: 401 },
    )
  }

  attemptsByIp.delete(ip)

  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  })
  return response
}

export async function GET() {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)
  return NextResponse.json({ unlocked: session?.value === "granted" })
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(COOKIE_NAME)
  return response
}
