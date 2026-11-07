/**
 * Completar el perfil después de entrar con Google (docs/254). Google solo da el nombre y el
 * correo: aquí se guardan país, moneda, idioma y la aceptación de los Términos, igual que en
 * el registro con correo (app/api/auth/signup/route.ts), y la invitación de un colega si venía
 * de un enlace /r/<código>.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { CURRENT_LEGAL_VERSION } from "@/lib/legal"
import { COUNTRIES } from "@/lib/types/user"
import { normalizeEmailLang } from "@/lib/i18n/email-labels"
import { REFERRAL } from "@/lib/referrals"
import { recordReferralAtSignup } from "@/lib/services/referrals"

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 })

  const body = await request.json().catch(() => null)
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().slice(0, 120) : ""
  const nationality = typeof body?.nationality === "string" ? body.nationality : ""
  const currency = typeof body?.currency === "string" ? body.currency : ""
  const language = normalizeEmailLang(body?.preferredLanguage)
  const productUpdatesOptIn = body?.productUpdatesOptIn === true

  if (body?.acceptedTerms !== true) {
    return NextResponse.json({ error: "Debes aceptar los Términos de Uso, la Política de Privacidad y el Aviso de Responsabilidad." }, { status: 400 })
  }
  if (!fullName || !COUNTRIES.some((c) => c.code === nationality) || !COUNTRIES.some((c) => c.currency === currency)) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 })
  }

  const admin = getSupabaseAdminClient()
  const acceptedAt = new Date().toISOString()
  const { data: before } = await admin.from("profiles").select("terms_version").eq("id", user.id).maybeSingle()
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      nationality,
      currency,
      preferred_language: language,
      product_updates_opt_in: productUpdatesOptIn,
      terms_accepted_at: acceptedAt,
      terms_version: CURRENT_LEGAL_VERSION,
    } as never)
    .eq("id", user.id)
  if (error) {
    console.error("[api/auth/complete-profile] No se pudo guardar el perfil:", error)
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 })
  }
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...(user.user_metadata || {}),
      full_name: fullName,
      nationality,
      currency,
      preferred_language: language,
      product_updates_opt_in: productUpdatesOptIn,
      terms_accepted_at: acceptedAt,
      terms_version: CURRENT_LEGAL_VERSION,
    },
  })

  // Solo la primera vez: invitación de un colega y evento de registro del embudo.
  if (!(before as { terms_version?: string | null } | null)?.terms_version) {
    const cookieCode = (request.headers.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFERRAL.cookieName}=`))
      ?.slice(REFERRAL.cookieName.length + 1)
    const referralCode = typeof body?.referralCode === "string" && body.referralCode ? body.referralCode : cookieCode
    if (referralCode) {
      try {
        await recordReferralAtSignup(user.id, referralCode, { email: user.email || undefined, name: fullName, language })
      } catch (referralError) {
        console.error("[api/auth/complete-profile] Error registrando la invitación:", referralError)
      }
    }
    const { error: eventError } = await admin.from("product_events").insert([{ event_name: "signup_completed" }] as never)
    if (eventError) console.error("[api/auth/complete-profile] Error registrando el evento:", eventError)
  }

  return NextResponse.json({ ok: true })
}
