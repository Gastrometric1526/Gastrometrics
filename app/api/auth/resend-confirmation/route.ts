/**
 * Reenviar el correo de confirmación (docs/204), desde «Revisa tu correo» y el inicio de sesión.
 * Responde igual exista o no la cuenta (no revela qué correos están registrados); solo avisa si
 * hay que esperar un minuto o si la cuenta ya está confirmada (para mandarla a iniciar sesión).
 */
import { NextResponse } from "next/server"
import { resendConfirmation } from "@/lib/services/confirmation-email"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: Request) {
  // docs/312: límite por dirección, además del minuto por correo: sin él, un script podía
  // probar miles de correos (la respuesta dice si la cuenta ya está confirmada) y gastar el envío.
  const limit = checkRateLimit(`resend-confirmation:${getClientIp(request)}`, { maxAttempts: 8, windowMs: 15 * 60_000, lockoutMs: 30 * 60_000 })
  if (!limit.allowed) return NextResponse.json({ error: "TOO_SOON" }, { status: 429 })
  let email = ""
  try {
    const body = await request.json()
    email = typeof body?.email === "string" ? body.email.trim() : ""
  } catch {
    /* cuerpo inválido */
  }
  if (!email || email.length > 320 || !email.includes("@")) return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 })
  const result = await resendConfirmation({ email })
  if (result === "too_soon") return NextResponse.json({ error: "TOO_SOON" }, { status: 429 })
  if (result === "already_confirmed") return NextResponse.json({ ok: true, alreadyConfirmed: true })
  return NextResponse.json({ ok: true })
}
