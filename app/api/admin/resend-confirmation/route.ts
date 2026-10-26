/** /admin: reenviar el correo de confirmación a una cuenta sin confirmar (docs/204). */
import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { resendConfirmation } from "@/lib/services/confirmation-email"

export async function POST(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  let userId = ""
  let email = ""
  try {
    const body = await request.json()
    userId = typeof body?.userId === "string" ? body.userId : ""
    email = typeof body?.email === "string" ? body.email.trim() : ""
  } catch {
    /* cuerpo inválido */
  }
  if (!userId && !email) return NextResponse.json({ error: "Falta la cuenta." }, { status: 400 })
  const result = await resendConfirmation(userId ? { userId } : { email })
  return NextResponse.json({ result }, { status: result === "sent" || result === "already_confirmed" ? 200 : result === "too_soon" ? 429 : 500 })
}
