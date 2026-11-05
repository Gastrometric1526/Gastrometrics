/**
 * Aparatos que reciben notificaciones de la cuenta con sesión (docs/241).
 * GET ?endpoint=: clave pública y si ese aparato ya está registrado.
 * POST { subscription, label } lo registra. DELETE { endpoint } lo quita.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { addUserPushDevice, getUserPushInfo, removeUserPushDevice } from "@/lib/services/user-push"

export const dynamic = "force-dynamic"

async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  return user?.id ?? null
}

const unauthorized = () => NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 })

export async function GET(request: Request) {
  const userId = await currentUserId()
  if (!userId) return unauthorized()
  try {
    return NextResponse.json(await getUserPushInfo(userId, new URL(request.url).searchParams.get("endpoint")))
  } catch (error) {
    console.error("[api/push] Error leyendo los aparatos:", error)
    return NextResponse.json({ error: "No se pudo revisar." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId()
  if (!userId) return unauthorized()
  const body = await request.json().catch(() => null)
  const subscription = body?.subscription
  if (typeof subscription?.endpoint !== "string" || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: "Suscripción no válida." }, { status: 400 })
  }
  try {
    await addUserPushDevice(userId, subscription, typeof body?.label === "string" ? body.label : "")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/push] Error guardando el aparato:", error)
    return NextResponse.json({ error: "No se pudo activar." }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const userId = await currentUserId()
  if (!userId) return unauthorized()
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Falta endpoint." }, { status: 400 })
  try {
    await removeUserPushDevice(userId, body.endpoint)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[api/push] Error quitando el aparato:", error)
    return NextResponse.json({ error: "No se pudo desactivar." }, { status: 500 })
  }
}
