import { NextResponse } from "next/server"
import { REFERRAL, normalizeReferralCode } from "@/lib/referrals"

// Enlace de invitación (docs/179): gastrometrics.org/r/<código>. Recuerda el código 30
// días en este navegador (por si se registra después) y lleva al registro con el regalo.
export function GET(request: Request, { params }: { params: { code: string } }) {
  const code = normalizeReferralCode(params.code)
  const url = new URL(code ? `/signup?ref=${code}` : "/signup", request.url)
  const response = NextResponse.redirect(url)
  if (code) {
    response.cookies.set(REFERRAL.cookieName, code, {
      maxAge: REFERRAL.cookieDays * 86_400,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    })
  }
  return response
}
