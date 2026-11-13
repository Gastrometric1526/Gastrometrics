import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { normalizeRecoveryRequest } from "@/lib/account-recovery"
import { sendOwnerNotification } from "@/lib/services/notify-owner"
import { adminAccountUrl } from "@/lib/admin/open-account"

/**
 * Solicitud para recuperar una cuenta (docs/285). Público (para quien no puede entrar),
 * con límite por IP: cada solicitud avisa al dueño por correo y en sus aparatos.
 * «Restaurar contenido» exige la sesión abierta y guarda de qué cuenta es.
 * Nunca dice si un correo existe o no: siempre responde lo mismo.
 */
const LIMIT = { maxAttempts: 4, windowMs: 60 * 60 * 1000, lockoutMs: 60 * 60 * 1000 }

const KIND_LABEL: Record<string, string> = {
  forgot_email: "No recuerda su correo",
  lost_email: "Ya no tiene acceso a su correo",
  restore_content: "Pide restaurar su contenido",
}

export async function POST(request: Request) {
  const limit = checkRateLimit(`account-recovery:${getClientIp(request)}`, LIMIT)
  if (!limit.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 })

  const body = await request.json().catch(() => null)
  let sessionUser: { id: string; email: string | null } | null = null
  try {
    const { data } = await getSupabaseServerClient().auth.getUser()
    if (data.user) sessionUser = { id: data.user.id, email: data.user.email?.toLowerCase() ?? null }
  } catch {}

  const parsed = normalizeRecoveryRequest(body, { email: sessionUser?.email ?? null })
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (parsed.row.kind === "restore_content" && !sessionUser) return NextResponse.json({ error: "no_session" }, { status: 401 })

  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("account_recovery_requests").insert({
    ...parsed.row,
    user_id: sessionUser?.id ?? null,
    user_email: sessionUser?.email ?? null,
  })
  if (error) {
    console.error("[api/account/recovery] no se pudo guardar:", error.message)
    return NextResponse.json({ error: "save_failed" }, { status: 500 })
  }

  await sendOwnerNotification({
    subject: `Recuperar cuenta: ${KIND_LABEL[parsed.row.kind]}`,
    rows: [
      ["Qué pasa", KIND_LABEL[parsed.row.kind]],
      ["Nombre", parsed.row.full_name],
      ["Negocio", parsed.row.business_name],
      ["Contacto", parsed.row.contact],
      ["Correos que cree haber usado", parsed.row.possible_emails],
      ["Cuenta con sesión", sessionUser?.email],
      ["Detalles", parsed.row.details],
    ],
    footnote: "Resuélvela en /admin → Mensajes → Recuperar cuentas. Verifica que sea la dueña de la cuenta antes de cambiar el correo o restaurar.",
    label: "solicitud de recuperación de cuenta",
    // Con sesión se sabe de qué cuenta es; sin sesión, a la lista de solicitudes.
    url: sessionUser ? adminAccountUrl({ userId: sessionUser.id }, { tab: "buzon", sub: "recuperar" }) : undefined,
  })

  return NextResponse.json({ ok: true })
}
