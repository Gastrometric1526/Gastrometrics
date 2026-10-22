/** Resumen para /invita (docs/179): enlace, invitados con su estado y meses ganados. */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { referralOverview } from "@/lib/services/referrals"

export const dynamic = "force-dynamic"

export async function GET() {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    return NextResponse.json(await referralOverview(user.id))
  } catch (error) {
    console.error("[api/referral/me] Error:", error)
    return NextResponse.json({ error: "No se pudo cargar." }, { status: 500 })
  }
}
