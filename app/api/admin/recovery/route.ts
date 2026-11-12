import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

/**
 * /admin → Mensajes → «Recuperar cuentas» (docs/285): las solicitudes de quien no recuerda
 * su correo, perdió acceso a él o pide restaurar su contenido. GET la lista (más nuevas
 * primero); PATCH { id, status } la marca resuelta o la vuelve a abrir.
 * Sin la migración 0041, responde `ready: false` y el panel lo dice.
 */
export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const { data, error } = await getSupabaseAdminClient().from("account_recovery_requests").select("*").order("created_at", { ascending: false }).limit(200)
  if (error) return NextResponse.json({ ready: false, requests: [], pending: 0 })
  const requests = data ?? []
  return NextResponse.json({ ready: true, requests, pending: requests.filter((r) => r.status === "nuevo").length })
}

export async function PATCH(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : null
  const status = body?.status === "resuelto" || body?.status === "nuevo" ? body.status : null
  if (!id || !status) return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  const { error } = await getSupabaseAdminClient()
    .from("account_recovery_requests")
    .update({ status, resolved_at: status === "resuelto" ? new Date().toISOString() : null })
    .eq("id", id)
  return error ? NextResponse.json({ error: "save_failed" }, { status: 500 }) : NextResponse.json({ ok: true })
}
