/**
 * Aviso a los aparatos de /admin cuando alguien entra a la app o hace una acción importante,
 * en un negocio o en su dashboard personal (docs/248). Lo llama logActivity en segundo plano.
 * Solo manda push, no correo. El nombre del negocio y de la persona salen del servidor: del
 * navegador solo se aceptan acciones de la lista y un negocio al que tenga acceso.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { sendAdminPush } from "@/lib/services/admin-push"
import { activityPushText, isOwnerEmail, isPushActivity } from "@/lib/services/activity-push"

const MINUTE = 60 * 1000

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const area = typeof body?.module === "string" ? body.module : ""
  const action = typeof body?.action === "string" ? body.action : ""
  if (!isPushActivity(area, action)) return NextResponse.json({ ok: false }, { status: 400 })

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  if (isOwnerEmail(user.email, process.env.FEEDBACK_NOTIFY_TO)) return NextResponse.json({ ok: true, skipped: "dueño" })

  // Tope por persona y acción, para que una sesión muy activa no llene el celular.
  const opened = area === "app"
  const limit = checkRateLimit(`activity-push:${user.id}:${area}:${action}`, {
    maxAttempts: opened ? 1 : 5,
    windowMs: (opened ? 60 : 10) * MINUTE,
    lockoutMs: (opened ? 60 : 10) * MINUTE,
  })
  if (!limit.allowed) return NextResponse.json({ ok: true, skipped: "tope" })

  try {
    const admin = getSupabaseAdminClient()
    const businessId = typeof body?.businessId === "string" && body.businessId !== "main" ? body.businessId : null
    let businessName: string | null = null
    if (businessId) {
      const [{ data: business }, { data: member }] = await Promise.all([
        admin.from("businesses").select("name, owner_id").eq("id", businessId).maybeSingle(),
        admin.from("business_members").select("user_id").eq("business_id", businessId).eq("user_id", user.id).maybeSingle(),
      ])
      if (!business || (business.owner_id !== user.id && !member)) return NextResponse.json({ ok: false }, { status: 404 })
      businessName = business.name
    }
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
    const who = [profile?.full_name, user.email].filter(Boolean).join(" · ")
    const count = typeof body?.count === "number" && Number.isFinite(body.count) ? Math.round(body.count) : null
    const sent = await sendAdminPush({ ...activityPushText({ module: area, action, who, businessName, count }), url: "/admin" })
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error("[api/notify/activity] Error:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
