/**
 * Programa automático "100 cocinas fundadoras" (docs/158). La sesión actual pregunta si
 * le toca: el servidor decide (posición de la cuenta, minuto de espera, una sola vez, sin
 * tocar planes pagados) y, si corresponde, aplica Chef Ejecutivo por un mes. Lo llama
 * components/founder-grant-trigger.tsx desde el Dashboard; el cron diario hace de respaldo.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { runFounderGrant } from "@/lib/services/founder-grant"
import { notifyOwnerAccountConfirmed } from "@/lib/services/notify-signup"

export async function POST() {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })

  // Primera carga después de confirmar el correo: aviso al dueño de la cuenta nueva (docs/201).
  // Idempotente y nunca lanza.
  await notifyOwnerAccountConfirmed(user.id)

  try {
    return NextResponse.json(await runFounderGrant(user.id))
  } catch (error) {
    console.error("[api/plan/founder-grant] Error:", error)
    return NextResponse.json({ action: "wait", waitMs: 60_000 })
  }
}
