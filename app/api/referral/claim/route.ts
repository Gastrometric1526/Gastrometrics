/**
 * Mes regalo del invitado (docs/179). Lo llama components/referral-trigger.tsx al abrir la
 * app; el cron diario hace de respaldo. Espera a que se resuelva el programa de fundadoras.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { claimInviteeGift } from "@/lib/services/referrals"

export async function POST() {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  try {
    return NextResponse.json(await claimInviteeGift(user.id))
  } catch (error) {
    console.error("[api/referral/claim] Error:", error)
    return NextResponse.json({ status: "wait", waitMs: 60_000 })
  }
}
