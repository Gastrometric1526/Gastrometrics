/**
 * Notificaciones push de /admin (docs/240), con la sesión de admin.
 * GET ?endpoint=: clave pública, cuántos aparatos reciben avisos y si este está registrado.
 * POST: { action: "subscribe", subscription, label } o { action: "test" }.
 * DELETE: { endpoint } deja de avisar a ese aparato.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { addAdminPushDevice, getAdminPushInfo, removeAdminPushDevice, sendAdminPush } from "@/lib/services/admin-push"

export const dynamic = "force-dynamic"

const unauthorized = () => NextResponse.json({ error: "No autorizado." }, { status: 401 })

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return unauthorized()
  try {
    return NextResponse.json(await getAdminPushInfo(new URL(request.url).searchParams.get("endpoint")))
  } catch (error) {
    console.error("[api/admin/push] Error leyendo la configuración:", error)
    return NextResponse.json({ error: "No se pudo preparar las notificaciones." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await hasAdminSession())) return unauthorized()
  const body = await request.json().catch(() => null)
  try {
    if (body?.action === "test") {
      const sent = await sendAdminPush({ title: "GastroMetrics", body: "Las notificaciones de /admin funcionan en este aparato.", url: "/admin" })
      return NextResponse.json({ sent })
    }
    const subscription = body?.subscription
    if (body?.action !== "subscribe" || typeof subscription?.endpoint !== "string" || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Suscripción no válida." }, { status: 400 })
    }
    await addAdminPushDevice(subscription, typeof body?.label === "string" ? body.label : "")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/admin/push] Error guardando la suscripción:", error)
    return NextResponse.json({ error: "No se pudo activar." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!(await hasAdminSession())) return unauthorized()
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Falta endpoint." }, { status: 400 })
  try {
    await removeAdminPushDevice(body.endpoint)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/admin/push] Error quitando la suscripción:", error)
    return NextResponse.json({ error: "No se pudo desactivar." }, { status: 500 })
  }
}
