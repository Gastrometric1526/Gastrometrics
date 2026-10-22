/**
 * Quién invita (docs/179): para el mensaje del registro «Fulano te regala un mes». Solo
 * devuelve el primer nombre; con límite por IP para que no se use para adivinar cuentas.
 */

import { NextResponse } from "next/server"
import { lookupReferrer } from "@/lib/services/referrals"
import { normalizeReferralCode, REFERRAL } from "@/lib/referrals"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const limit = checkRateLimit(`referral-lookup:${getClientIp(request)}`, { maxAttempts: 30, windowMs: 10 * 60 * 1000, lockoutMs: 10 * 60 * 1000 })
  if (!limit.allowed) return NextResponse.json({ valid: false }, { status: 429 })
  const code = normalizeReferralCode(new URL(request.url).searchParams.get("code"))
  if (!code) return NextResponse.json({ valid: false })
  try {
    const referrer = await lookupReferrer(code)
    if (!referrer) return NextResponse.json({ valid: false })
    return NextResponse.json({ valid: true, code, firstName: referrer.firstName, giftPlanSlug: REFERRAL.giftPlanSlug, giftDays: REFERRAL.giftDays })
  } catch (error) {
    console.error("[api/referral/lookup] Error:", error)
    return NextResponse.json({ valid: false })
  }
}
