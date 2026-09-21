/**
 * Aviso por correo a usuarios EXISTENTES sobre la nueva versión de los Términos de
 * Uso/Política de Privacidad/Aviso de Responsabilidad (ver docs/118) — pedido
 * explícito del dueño del proyecto: "a los usuarios que ya existen se debe enviar un
 * correo hablando de esto".
 *
 * A diferencia del correo de "novedades del producto" (product-update-email/route.ts,
 * que solo va a cuentas con product_updates_opt_in=true), este se manda a TODA cuenta
 * existente — no es opcional, es la notificación legal del cambio de documentos
 * (Términos §9: "los cambios materiales... se comunicarán con al menos 14 días de
 * antelación... por correo o aviso en la app").
 *
 * Idempotente vía activation_emails_sent (unique account_id+email_type, ver
 * supabase/migrations/0028) con email_type="legal_update_notice" — como máximo un
 * envío por cuenta, para siempre (si el dueño publica una versión legal más adelante,
 * hace falta un nuevo email_type, igual que ya pasó con las otras versiones de este
 * mecanismo).
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate } from "./email-templates"
import { getEmailLabels, normalizeEmailLang } from "@/lib/i18n/email-labels"

/** Mismo patrón que claimSend() en notify-activation.ts. */
async function claimSend(accountId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("activation_emails_sent")
    .insert({ account_id: accountId, email_type: "legal_update_notice" })
    .select("id")
  if (error) {
    // Código 23505 = violación de unique constraint (ya se había mandado) — no es un
    // error real, es exactamente el caso que este insert existe para detectar.
    if ((error as { code?: string }).code !== "23505") {
      console.error("[notify-legal-update] Error reservando envío:", error)
    }
    return false
  }
  return (data?.length ?? 0) > 0
}

export async function sendLegalUpdateNotice(accountId: string, email: string, language: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const claimed = await claimSend(accountId)
  if (!claimed) return false

  const normalizedLang = normalizeEmailLang(language)
  const labels = getEmailLabels(normalizedLang)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  const html = renderEmailTemplate("11-actualizacion-legal.html", {
    htmlLang: normalizedLang,
    title: labels.e11_title,
    preheader: labels.e11_preheader,
    heading: labels.e11_heading,
    body: labels.e11_body,
    termsUrl: `${siteUrl}/terminos-de-uso`,
    termsLabel: labels.e11_terms_label,
    privacyUrl: `${siteUrl}/politica-privacidad`,
    privacyLabel: labels.e11_privacy_label,
    liabilityUrl: `${siteUrl}/aviso-de-responsabilidad`,
    liabilityLabel: labels.e11_liability_label,
    cta: labels.e11_cta,
    ctaUrl: `${siteUrl}/dashboard`,
    footnote: labels.e11_footnote,
    footerAddress: labels.footer_address,
    footer2: labels.e11_footer2,
  })

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [email],
    subject: labels.e11_subject,
    html,
  })
  if (error) {
    console.error("[notify-legal-update] Resend rechazó el envío:", email, error)
    return false
  }
  return true
}
