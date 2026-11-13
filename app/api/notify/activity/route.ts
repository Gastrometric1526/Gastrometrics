/**
 * Aviso a los aparatos de /admin cuando alguien entra a la app o hace algo, en un negocio o
 * en su dashboard personal (docs/248; casi todas las acciones desde docs/295). Lo llama
 * logActivity en segundo plano. Solo manda push, no correo. El nombre del negocio y de la
 * persona salen del servidor: del navegador solo se aceptan acciones de la lista, un negocio
 * al que tenga acceso y un nombre corto de lo que hizo.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { sendActivityPush } from "@/lib/services/activity-push-server"

const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null)

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const area = typeof body?.module === "string" ? body.module : ""
  const action = typeof body?.action === "string" ? body.action : ""

  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const result = await sendActivityPush({
    user: { id: user.id, email: user.email },
    module: area,
    action,
    businessId: typeof body?.businessId === "string" ? body.businessId : null,
    count: typeof body?.count === "number" && Number.isFinite(body.count) ? Math.round(body.count) : null,
    label: text(body?.label, 80),
    kind: text(body?.kind, 30),
  })
  if (!result.ok) return NextResponse.json({ ok: false }, { status: result.status })
  return NextResponse.json(result)
}
