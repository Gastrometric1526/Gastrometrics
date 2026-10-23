/** Registra que alguien compartió su enlace de invitación (docs/186), para contar en /admin. */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { REFERRAL_SHARE_CHANNELS, recordReferralShare, type ReferralShareChannel } from "@/lib/services/referrals"

export async function POST(request: Request) {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const body = await request.json().catch(() => null)
  const channel = body?.channel as ReferralShareChannel
  if (!REFERRAL_SHARE_CHANNELS.includes(channel)) return NextResponse.json({ error: "Canal no válido." }, { status: 400 })
  // Un toque repetido no infla el conteo: máximo 20 por cuenta cada 10 minutos.
  const limit = checkRateLimit(`referral-share:${user.id}`, { maxAttempts: 20, windowMs: 10 * 60 * 1000, lockoutMs: 10 * 60 * 1000 })
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 })
  await recordReferralShare(user.id, channel)
  return NextResponse.json({ ok: true })
}
