/**
 * Correo de aviso legal a TODAS las cuentas existentes (ver lib/services/
 * notify-legal-update.ts, docs/118) — a diferencia de product-update-email/route.ts
 * (solo opt-in), este va a toda cuenta con correo real, sin importar
 * product_updates_opt_in, porque es la notificación del cambio de Términos de
 * Uso/Política de Privacidad/Aviso de Responsabilidad, no una novedad opcional.
 *
 * Mismo patrón que product-update-email/route.ts: GET cuenta destinatarios sin
 * mandar nada, POST manda de verdad (requiere {confirm:true}). La idempotencia real
 * (máximo un envío por cuenta, para siempre) la garantiza activation_emails_sent
 * dentro de sendLegalUpdateNotice() — llamar POST más de una vez nunca duplica un
 * envío ya hecho.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { normalizeEmailLang } from "@/lib/i18n/email-labels"
import { sendLegalUpdateNotice } from "@/lib/services/notify-legal-update"

async function getAllAccountsWithLanguage() {
  const admin = getSupabaseAdminClient()

  let allUsers: { id: string; email: string }[] = []
  let page = 1
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    allUsers = allUsers.concat(data.users.map((u) => ({ id: u.id, email: u.email || "" })))
    if (data.users.length < 200) break
    page += 1
  }

  const { data: profileRows, error: profilesError } = await admin.from("profiles").select("id, preferred_language")
  if (profilesError) throw profilesError
  const langById = new Map((profileRows ?? []).map((r) => [r.id, r.preferred_language]))

  return allUsers
    .filter((u) => u.email)
    .map((u) => ({ id: u.id, email: u.email, language: normalizeEmailLang(langById.get(u.id) || "es") }))
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  try {
    const recipients = await getAllAccountsWithLanguage()

    // Cuántos YA lo recibieron, para que el panel muestre "N de M pendientes" en vez
    // de un número que siempre parece "todos otra vez" tras la primera corrida.
    const admin = getSupabaseAdminClient()
    const { data: alreadySentRows, error: alreadySentError } = await admin
      .from("activation_emails_sent")
      .select("account_id")
      .eq("email_type", "legal_update_notice")
    if (alreadySentError) throw alreadySentError
    const alreadySentIds = new Set((alreadySentRows ?? []).map((r) => r.account_id))

    const pending = recipients.filter((r) => !alreadySentIds.has(r.id))
    return NextResponse.json({ count: recipients.length, pendingCount: pending.length })
  } catch (error) {
    console.error("[api/admin/legal-update-email] Error contando destinatarios:", error)
    return NextResponse.json({ error: "No se pudo contar los destinatarios." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Falta confirmar el envío." }, { status: 400 })
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY no está configurada." }, { status: 500 })
  }

  let recipients: Awaited<ReturnType<typeof getAllAccountsWithLanguage>> = []
  try {
    recipients = await getAllAccountsWithLanguage()
  } catch (error) {
    console.error("[api/admin/legal-update-email] Error obteniendo destinatarios:", error)
    return NextResponse.json({ error: "No se pudo obtener la lista de destinatarios." }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  const failed: string[] = []

  for (const recipient of recipients) {
    try {
      const wasSent = await sendLegalUpdateNotice(recipient.id, recipient.email, recipient.language)
      if (wasSent) sent++
      else skipped++
    } catch (error) {
      console.error("[api/admin/legal-update-email] Error inesperado mandando a", recipient.email, error)
      failed.push(recipient.email)
    }
  }

  return NextResponse.json({ ok: true, sentCount: sent, skippedCount: skipped, failedCount: failed.length, failed })
}
