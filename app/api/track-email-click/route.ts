/**
 * Registra que una cuenta entró desde un correo (docs/145, lib/email-tracking.ts).
 * Exige sesión: el clic queda a nombre de quien lo hizo. Como mucho un clic por cuenta,
 * correo y hora (no infla los números si recarga la página).
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { CLICK_PREFIX, sanitizeCampaign } from "@/lib/email-tracking"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const campaign = sanitizeCampaign(body?.campaign)
  if (!campaign) return NextResponse.json({ error: "Campaña inválida." }, { status: 400 })

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 })

  try {
    const admin = getSupabaseAdminClient()
    const type = `${CLICK_PREFIX}${campaign}`
    const { data: recent } = await admin
      .from("engagement_emails_sent")
      .select("id")
      .eq("account_id", user.id)
      .eq("email_type", type)
      .gte("sent_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .limit(1)
    if (recent && recent.length > 0) return NextResponse.json({ ok: true, duplicate: true })
    const { error } = await admin
      .from("engagement_emails_sent")
      .insert({ account_id: user.id, email_type: type, ref: "" } as never) // tabla no está en types/database.ts
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/track-email-click] Error:", error)
    return NextResponse.json({ error: "No se pudo registrar." }, { status: 500 })
  }
}
