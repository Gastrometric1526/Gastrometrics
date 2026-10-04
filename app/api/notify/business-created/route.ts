/**
 * Aviso al dueño del proyecto cuando alguien crea un negocio (docs/143). Los negocios se
 * crean desde el navegador (lib/storage/businesses.ts → addBusiness, insert directo a
 * Supabase), así que addBusiness llama a esta ruta justo después de guardar.
 *
 * La ruta no confía en el navegador: exige sesión, comprueba con el cliente admin que
 * el negocio existe, es de quien llama y se creó hace menos de 15 minutos, y avisa una
 * sola vez por negocio (marca en product_events: event_name "business_created_notified"
 * + business_id). Llamarla de nuevo, o para un negocio ajeno, no manda nada.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendOwnerNotification, hondurasTime } from "@/lib/services/notify-owner"

const MAX_AGE_MS = 15 * 60 * 1000
const MARK = "business_created_notified"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const businessId = typeof body?.businessId === "string" ? body.businessId : ""
  if (!businessId) return NextResponse.json({ error: "Falta el negocio." }, { status: 400 })

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 })

  try {
    const admin = getSupabaseAdminClient()
    const { data: business, error } = await admin
      .from("businesses")
      .select("id, name, owner_id, created_at, data")
      .eq("id", businessId)
      .maybeSingle()
    if (error) throw error
    if (!business || business.owner_id !== user.id) {
      return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 })
    }
    if (Date.now() - new Date(business.created_at).getTime() > MAX_AGE_MS) {
      return NextResponse.json({ ok: true, skipped: "antiguo" })
    }

    const { data: already } = await admin
      .from("product_events")
      .select("id")
      .eq("event_name", MARK)
      .eq("business_id", businessId)
      .limit(1)
    if (already && already.length > 0) return NextResponse.json({ ok: true, skipped: "ya avisado" })

    const [{ data: profile }, { count }] = await Promise.all([
      admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      admin.from("businesses").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    ])
    const data = (business.data ?? {}) as { type?: string; businessType?: string; location?: string; currency?: string }

    const sent = await sendOwnerNotification({
      subject: `Nuevo negocio creado: ${business.name}`,
      rows: [
        ["Negocio", business.name],
        ["Tipo", data.type || data.businessType],
        ["Ubicación", data.location],
        ["Moneda", data.currency],
        ["Creado por", `${profile?.full_name ? `${profile.full_name} — ` : ""}${user.email ?? user.id}`],
        ["Negocios de esta cuenta", String(count ?? 1)],
      ],
      footnote: `Negocio creado el ${hondurasTime(business.created_at)}.`,
      label: "aviso de negocio nuevo",
    })
    if (sent) {
      const { error: markError } = await admin.from("product_events").insert({ event_name: MARK, business_id: businessId } as never) // product_events no está en types/database.ts
      if (markError) console.error("[api/notify/business-created] No se pudo marcar el aviso:", markError)
    }
    return NextResponse.json({ ok: true, sent })
  } catch (error) {
    console.error("[api/notify/business-created] Error:", error)
    return NextResponse.json({ error: "No se pudo avisar." }, { status: 500 })
  }
}
