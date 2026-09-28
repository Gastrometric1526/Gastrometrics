/**
 * Baja en un clic de los correos no transaccionales (recordatorios y novedades) — ver
 * lib/email-unsubscribe.ts y docs/131. Apaga exactamente la misma casilla que
 * Configuración → Notificaciones → "Novedades y recordatorios"
 * (profiles.product_updates_opt_in), así que ambos caminos quedan siempre coherentes.
 *
 * GET muestra una página con un botón de confirmar (no da de baja solo por abrir el
 * link — los escáneres de seguridad de Outlook/Gmail abren los links de los correos
 * automáticamente, y darían de baja a gente que nunca hizo clic). POST hace la baja: lo
 * usa ese botón y también el "Cancelar suscripción" nativo de Gmail/Apple Mail
 * (cabecera List-Unsubscribe-Post, RFC 8058), que manda POST directo a esta URL.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { verifyUnsubscribeSignature } from "@/lib/email-unsubscribe"
import { escapeHtml } from "@/lib/services/email-templates"
import { normalizeEmailLang, type EmailLang } from "@/lib/i18n/email-labels"

const PAGE_TEXT: Record<EmailLang, { confirmTitle: string; confirmBody: string; confirmButton: string; doneTitle: string; doneBody: string; invalid: string; back: string }> = {
  es: {
    confirmTitle: "¿Dejar de recibir recordatorios?",
    confirmBody: "Vas a dejar de recibir los recordatorios y las novedades de Gastrometrics por correo. Los correos de tu cuenta (pagos, contraseña, equipo) siguen llegando igual.",
    confirmButton: "Sí, dejar de recibirlos",
    doneTitle: "Listo, no te vamos a mandar más",
    doneBody: "Si cambiás de idea, podés volver a activarlos en Configuración → Notificaciones dentro de la app.",
    invalid: "Este link no es válido o está incompleto.",
    back: "Ir a Gastrometrics",
  },
  en: {
    confirmTitle: "Stop receiving reminders?",
    confirmBody: "You'll stop receiving Gastrometrics reminders and product updates by email. Account emails (billing, password, team) will still arrive.",
    confirmButton: "Yes, stop sending them",
    doneTitle: "Done, we won't send you any more",
    doneBody: "If you change your mind, you can turn them back on in Settings → Notifications inside the app.",
    invalid: "This link is invalid or incomplete.",
    back: "Go to Gastrometrics",
  },
  da: {
    confirmTitle: "Stop med at modtage påmindelser?",
    confirmBody: "Du holder op med at modtage påmindelser og produktnyheder fra Gastrometrics via e-mail. Konto-e-mails (betaling, adgangskode, team) kommer stadig.",
    confirmButton: "Ja, stop dem",
    doneTitle: "Færdig, vi sender ikke flere",
    doneBody: "Hvis du fortryder, kan du slå dem til igen under Indstillinger → Notifikationer i appen.",
    invalid: "Dette link er ugyldigt eller ufuldstændigt.",
    back: "Gå til Gastrometrics",
  },
  fr: {
    confirmTitle: "Ne plus recevoir de rappels ?",
    confirmBody: "Tu ne recevras plus les rappels ni les nouveautés de Gastrometrics par e-mail. Les e-mails de ton compte (paiements, mot de passe, équipe) continueront d'arriver.",
    confirmButton: "Oui, ne plus les recevoir",
    doneTitle: "C'est fait, on ne t'en enverra plus",
    doneBody: "Si tu changes d'avis, tu peux les réactiver dans Paramètres → Notifications dans l'application.",
    invalid: "Ce lien est invalide ou incomplet.",
    back: "Aller sur Gastrometrics",
  },
  pt: {
    confirmTitle: "Parar de receber lembretes?",
    confirmBody: "Você vai parar de receber os lembretes e as novidades da Gastrometrics por e-mail. Os e-mails da sua conta (pagamentos, senha, equipe) continuam chegando.",
    confirmButton: "Sim, parar de receber",
    doneTitle: "Pronto, não vamos mandar mais",
    doneBody: "Se mudar de ideia, pode reativá-los em Configurações → Notificações dentro do app.",
    invalid: "Este link é inválido ou está incompleto.",
    back: "Ir para a Gastrometrics",
  },
  zh: {
    confirmTitle: "不再接收提醒？",
    confirmBody: "你将不再通过邮件收到 Gastrometrics 的提醒和产品更新。账户相关邮件（付款、密码、团队）仍会照常发送。",
    confirmButton: "是的，不再接收",
    doneTitle: "完成，我们不会再发送了",
    doneBody: "如果改变主意，可以在应用内的 设置 → 通知 中重新开启。",
    invalid: "此链接无效或不完整。",
    back: "前往 Gastrometrics",
  },
}

function page(lang: EmailLang, title: string, body: string, extraHtml: string, status = 200): NextResponse {
  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:32px 16px;background:#EFEAE5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #E4DCD4;border-radius:16px;overflow:hidden">
<div style="background:#F05324;padding:18px 28px;color:#fff;font-weight:800;font-size:17px">Gastrometrics</div>
<div style="padding:28px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:#1A1512">${escapeHtml(title)}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4A423C">${escapeHtml(body)}</p>
${extraHtml}
</div></div></body></html>`
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } })
}

async function getLanguage(accountId: string): Promise<EmailLang> {
  try {
    const admin = getSupabaseAdminClient()
    const { data } = await admin.from("profiles").select("preferred_language").eq("id", accountId).maybeSingle()
    return normalizeEmailLang(data?.preferred_language)
  } catch {
    return "es"
  }
}

function readParams(request: Request): { accountId: string; signature: string } {
  const url = new URL(request.url)
  return { accountId: url.searchParams.get("u") || "", signature: url.searchParams.get("s") || "" }
}

export async function GET(request: Request) {
  const { accountId, signature } = readParams(request)
  if (!verifyUnsubscribeSignature(accountId, signature)) {
    const txt = PAGE_TEXT.es
    return page("es", txt.invalid, "", "", 400)
  }
  const lang = await getLanguage(accountId)
  const txt = PAGE_TEXT[lang]
  const action = `/api/email/unsubscribe?u=${encodeURIComponent(accountId)}&s=${encodeURIComponent(signature)}`
  const form = `<form method="POST" action="${escapeHtml(action)}"><button type="submit" style="background:#F05324;color:#fff;border:0;border-radius:8px;padding:13px 22px;font-size:15px;font-weight:700;cursor:pointer">${escapeHtml(txt.confirmButton)}</button></form>`
  return page(lang, txt.confirmTitle, txt.confirmBody, form)
}

export async function POST(request: Request) {
  const { accountId, signature } = readParams(request)
  if (!verifyUnsubscribeSignature(accountId, signature)) {
    return page("es", PAGE_TEXT.es.invalid, "", "", 400)
  }
  const admin = getSupabaseAdminClient()
  const { error } = await admin.from("profiles").update({ product_updates_opt_in: false }).eq("id", accountId)
  if (error) {
    console.error("[api/email/unsubscribe] Error dando de baja:", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const lang = await getLanguage(accountId)
  const txt = PAGE_TEXT[lang]
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ""
  const back = `<a href="${escapeHtml(siteUrl || "/")}" style="color:#F05324;font-weight:700;text-decoration:none">${escapeHtml(txt.back)} →</a>`
  return page(lang, txt.doneTitle, txt.doneBody, back)
}
