/**
 * Registro con correo de confirmación propio de marca, sin depender del SMTP de
 * Supabase (bloqueado — necesita que alguien pegue la API key de Resend en el
 * dashboard de Supabase a mano, ver docs/53). supabase.auth.signUp() del lado del
 * cliente (el que usaba antes contexts/auth-context.tsx) dispara automáticamente el
 * correo GENÉRICO de confirmación de Supabase apenas se llama — no hay forma de
 * evitarlo desde ahí. admin.generateLink({type:"signup"}) en cambio CREA la cuenta
 * (sin confirmar) y devuelve el link de confirmación real, sin mandar ningún correo
 * por su cuenta — el envío lo hace esta ruta con Resend, con la plantilla de marca.
 *
 * El resto del flujo de app/signup/page.tsx no cambia: sigue intentando login()
 * justo después, que falla con el error real de Supabase "Email not confirmed"
 * mientras la cuenta no se confirme — esa parte no se simula, es el comportamiento
 * real de Supabase Auth.
 */

import { NextResponse } from "next/server"
import { sendWithRetry } from "@/lib/services/send-email"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getPlanBySlug } from "@/lib/plans"
import { CURRENT_LEGAL_VERSION } from "@/lib/legal"
import { renderEmailTemplate, escapeHtml } from "@/lib/services/email-templates"
import { getEmailLabels, fillLabel, normalizeEmailLang } from "@/lib/i18n/email-labels"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { recordReferralAtSignup } from "@/lib/services/referrals"
import { REFERRAL } from "@/lib/referrals"
import { sendConfirmationEmail } from "@/lib/services/confirmation-email"

export async function POST(request: Request) {
  // Límite por IP contra registro masivo (cuentas de spam, o correr Resend a cero
  // mandando confirmaciones a direcciones inventadas — ver docs/61).
  const rateLimit = checkRateLimit(`signup:${getClientIp(request)}`, {
    maxAttempts: 8,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiados intentos de registro. Espera unos minutos e intenta de nuevo." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === "string" ? body.email.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  const acceptedTerms = body?.acceptedTerms === true
  const profile = body?.profile || {}
  const preferredLanguage = normalizeEmailLang(profile.preferredLanguage)

  if (!email || !password) {
    return NextResponse.json({ error: "Falta el correo o la contraseña." }, { status: 400 })
  }
  // Igual que el mínimo de 8 caracteres de la contraseña (ver comentario abajo): la
  // casilla de términos también se revisaba solo en el formulario — alguien podía
  // llamar esta ruta directo y crear una cuenta sin haberla aceptado nunca. Los nuevos
  // Términos de Uso/Política de Privacidad/Aviso de Responsabilidad (ver docs/118)
  // exigen que el registro quede condicionado a esta aceptación.
  if (!acceptedTerms) {
    return NextResponse.json({ error: "Debes aceptar los Términos de Uso, la Política de Privacidad y el Aviso de Responsabilidad." }, { status: 400 })
  }
  // El mínimo de 8 caracteres antes solo se revisaba en el formulario (Zod, ver
  // lib/validations/auth.ts) — alguien podía llamar esta ruta directo, sin pasar por
  // el formulario, y crear una cuenta con una contraseña de un carácter (ver docs/61).
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const admin = getSupabaseAdminClient()

  // BUG CORREGIDO: admin.generateLink({type:"signup"}) NO rechaza de forma confiable un
  // correo que ya tiene cuenta — contra una cuenta sin confirmar (ej. alguien invitado a
  // un equipo que nunca completó su propio registro) devuelve éxito ({ok:true}) en vez
  // de error, sin tocar la contraseña real de esa cuenta. app/signup/page.tsx entonces
  // intenta iniciar sesión de inmediato con la contraseña nueva recién escrita, que no
  // coincide con la real — falla con "Invalid login credentials", un mensaje que no se
  // parece a "already registered"/"already exists" (lo único que ese formulario sabía
  // reconocer), así que la persona terminaba viendo el error genérico "hubo un error,
  // intenta de nuevo" sin ninguna pista de que el correo ya era suyo. Se verifica acá,
  // explícitamente, ANTES de intentar crear nada — ver docs/75.
  const { data: existingUsersPage, error: listUsersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listUsersError) {
    console.error("[api/auth/signup] Error verificando correos existentes:", listUsersError)
  } else if (existingUsersPage.users.some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: "EMAIL_ALREADY_REGISTERED" }, { status: 409 })
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: {
      redirectTo: `${siteUrl}/dashboard`,
      data: {
        full_name: profile.fullName || "",
        nationality: profile.nationality || "",
        currency: profile.currency || "",
        business_type: profile.businessType || "",
        business_size: profile.businessSize || "",
        industry_experience: profile.industryExperience || "",
        preferred_language: preferredLanguage,
        product_updates_opt_in: profile.productUpdatesOptIn === true,
        terms_accepted_at: new Date().toISOString(),
        terms_version: CURRENT_LEGAL_VERSION,
      },
    },
  })

  if (error || !data?.properties?.action_link) {
    console.error("[api/auth/signup] Error creando la cuenta:", error)
    return NextResponse.json({ error: error?.message || "No se pudo crear la cuenta." }, { status: 400 })
  }

  // Invitación de un colega (docs/179): el código llega del formulario o de la cookie que
  // dejó /r/<código>. Nunca rompe el registro si el código no sirve.
  const cookieCode = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFERRAL.cookieName}=`))
    ?.slice(REFERRAL.cookieName.length + 1)
  const referralCode = typeof body?.referralCode === "string" && body.referralCode ? body.referralCode : cookieCode
  if (referralCode && data.user?.id) {
    try {
      await recordReferralAtSignup(data.user.id, referralCode, { email, name: profile.fullName || undefined, language: preferredLanguage })
    } catch (referralError) {
      console.error("[api/auth/signup] Error registrando la invitación:", referralError)
    }
  }

  // Best-effort: la cuenta ya se creó arriba sin importar si este correo sale o no. Se puede
  // reenviar desde «Revisa tu correo», el inicio de sesión o /admin (docs/204).
  await sendConfirmationEmail({ email, actionLink: data.properties.action_link, fullName: profile.fullName, language: preferredLanguage })

  // El aviso al dueño ya no sale aquí (docs/201): una cuenta sin confirmar no es un usuario.
  // Sale al confirmar el correo (notifyOwnerAccountConfirmed, primera carga del Dashboard), y
  // el resumen diario del cron lista las cuentas confirmadas en 24 h.

  // Evento de embudo (ver supabase/migrations/0029_product_events.sql) — server-side
  // acá en vez de un trackEvent() de cliente en app/signup/page.tsx: esta ruta ya sabe
  // con certeza que la cuenta se creó de verdad. También se espera (mismo motivo que arriba).
  const { error: eventError } = await admin.from("product_events").insert([{ event_name: "signup_completed" }] as never) // product_events no está en types/database.ts
  if (eventError) console.error("[api/auth/signup] Error registrando eventos de registro:", eventError)

  return NextResponse.json({ ok: true })
}
