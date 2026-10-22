/**
 * Confirmación de cobros (docs/183), parte con base de datos y correo. Cada cobro de
 * Stripe —hecho o fallido— queda en app_metadata de la cuenta:
 * - `last_payment`: el último, con `seen` para el aviso de la app (components/payment-notice.tsx);
 * - `payment_history`: los últimos 12, para Mi Plan y para la radiografía de /admin.
 * Además: correo a la persona en su idioma (transaccional: sale aunque no acepte novedades)
 * y aviso al dueño. Sin migraciones.
 */

import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { sendOwnerBillingNotification } from "./notify-billing"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getEmailLabels, fillLabel, normalizeEmailLang, type EmailLang } from "@/lib/i18n/email-labels"
import { buildUnsubscribeUrl } from "@/lib/email-unsubscribe"
import { withEmailTracking } from "@/lib/email-tracking"
import { formatDate } from "@/lib/date-format"
import { getPlanBySlug } from "@/lib/plans"
import { pushPayment, type PaymentRecord } from "@/lib/payment-notice"

type Kind = "paid" | "failed"
interface Copy {
  subject: string
  heading: string
  body: string
  next: string
  cta: string
}
interface LangCopy {
  eyebrow: string
  hello: string
  helloNoName: string
  footnote: string
  footer2: string
  unsubscribe: string
  paid: Copy
  failed: Copy
}

// {amount} {plan} {date} {next}
export const PAYMENT_EMAIL_COPY: Record<EmailLang, LangCopy> = {
  es: {
    eyebrow: "Pagos",
    hello: "Hola {name},",
    helloNoName: "Hola,",
    footnote: "Si no reconoces este cobro, responde a este correo.",
    footer2: "Recibes este correo porque hubo un cobro o un intento de cobro de tu suscripción a GastroMetrics.",
    unsubscribe: "Preferencias de correo",
    paid: { subject: "Pago confirmado: {amount}", heading: "Recibimos tu pago", body: "Cobramos {amount} por tu plan {plan} el {date}. Gracias por seguir con GastroMetrics.", next: "Tu siguiente cobro es el {next}.", cta: "Ver mi plan y la factura" },
    failed: { subject: "No pudimos cobrar tu plan {plan}", heading: "Tu pago no se pudo completar", body: "Intentamos cobrar tu plan {plan} el {date} y el banco lo rechazó. No se te cobró nada. Stripe lo volverá a intentar en los próximos días; para no perder tu plan, revisa o cambia tu tarjeta.", next: "Próximo intento: {next}.", cta: "Actualizar mi tarjeta" },
  },
  en: {
    eyebrow: "Payments",
    hello: "Hi {name},",
    helloNoName: "Hi,",
    footnote: "If you don't recognize this charge, reply to this email.",
    footer2: "You're receiving this email because there was a charge or a charge attempt on your GastroMetrics subscription.",
    unsubscribe: "Email preferences",
    paid: { subject: "Payment confirmed: {amount}", heading: "We received your payment", body: "We charged {amount} for your {plan} plan on {date}. Thanks for staying with GastroMetrics.", next: "Your next charge is on {next}.", cta: "See my plan and invoice" },
    failed: { subject: "We couldn't charge your {plan} plan", heading: "Your payment couldn't be completed", body: "We tried to charge your {plan} plan on {date} and the bank declined it. You were not charged. Stripe will try again over the next few days; to keep your plan, check or change your card.", next: "Next attempt: {next}.", cta: "Update my card" },
  },
  da: {
    eyebrow: "Betalinger",
    hello: "Hej {name},",
    helloNoName: "Hej,",
    footnote: "Genkender du ikke denne opkrævning, så svar på denne e-mail.",
    footer2: "Du modtager denne e-mail, fordi der var en opkrævning eller et opkrævningsforsøg på dit GastroMetrics-abonnement.",
    unsubscribe: "E-mailindstillinger",
    paid: { subject: "Betaling bekræftet: {amount}", heading: "Vi har modtaget din betaling", body: "Vi har opkrævet {amount} for din {plan}-plan den {date}. Tak, fordi du bliver hos GastroMetrics.", next: "Din næste opkrævning er den {next}.", cta: "Se min plan og faktura" },
    failed: { subject: "Vi kunne ikke opkræve din {plan}-plan", heading: "Din betaling kunne ikke gennemføres", body: "Vi forsøgte at opkræve din {plan}-plan den {date}, og banken afviste den. Du er ikke blevet opkrævet. Stripe prøver igen i de kommende dage; tjek eller skift dit kort for at beholde din plan.", next: "Næste forsøg: {next}.", cta: "Opdater mit kort" },
  },
  fr: {
    eyebrow: "Paiements",
    hello: "Bonjour {name},",
    helloNoName: "Bonjour,",
    footnote: "Si vous ne reconnaissez pas ce prélèvement, répondez à cet e-mail.",
    footer2: "Vous recevez cet e-mail car un prélèvement ou une tentative de prélèvement a eu lieu sur votre abonnement GastroMetrics.",
    unsubscribe: "Préférences e-mail",
    paid: { subject: "Paiement confirmé : {amount}", heading: "Nous avons reçu votre paiement", body: "Nous avons prélevé {amount} pour votre forfait {plan} le {date}. Merci de rester avec GastroMetrics.", next: "Votre prochain prélèvement est le {next}.", cta: "Voir mon forfait et la facture" },
    failed: { subject: "Nous n'avons pas pu prélever votre forfait {plan}", heading: "Votre paiement n'a pas abouti", body: "Nous avons tenté de prélever votre forfait {plan} le {date} et la banque l'a refusé. Rien ne vous a été prélevé. Stripe réessaiera dans les prochains jours ; pour garder votre forfait, vérifiez ou changez votre carte.", next: "Prochaine tentative : {next}.", cta: "Mettre à jour ma carte" },
  },
  pt: {
    eyebrow: "Pagamentos",
    hello: "Olá {name},",
    helloNoName: "Olá,",
    footnote: "Se você não reconhece esta cobrança, responda a este e-mail.",
    footer2: "Você recebe este e-mail porque houve uma cobrança ou uma tentativa de cobrança na sua assinatura do GastroMetrics.",
    unsubscribe: "Preferências de e-mail",
    paid: { subject: "Pagamento confirmado: {amount}", heading: "Recebemos seu pagamento", body: "Cobramos {amount} pelo seu plano {plan} em {date}. Obrigado por continuar com o GastroMetrics.", next: "Sua próxima cobrança é em {next}.", cta: "Ver meu plano e a fatura" },
    failed: { subject: "Não conseguimos cobrar seu plano {plan}", heading: "Seu pagamento não foi concluído", body: "Tentamos cobrar seu plano {plan} em {date} e o banco recusou. Nada foi cobrado. A Stripe vai tentar de novo nos próximos dias; para não perder seu plano, revise ou troque seu cartão.", next: "Próxima tentativa: {next}.", cta: "Atualizar meu cartão" },
  },
  zh: {
    eyebrow: "付款",
    hello: "{name}，你好：",
    helloNoName: "你好：",
    footnote: "如果你不认识这笔扣费，请回复此邮件。",
    footer2: "你收到此邮件是因为你的 GastroMetrics 订阅发生了一笔扣费或扣费尝试。",
    unsubscribe: "邮件偏好",
    paid: { subject: "付款成功：{amount}", heading: "我们已收到你的付款", body: "我们于 {date} 为你的 {plan} 套餐扣费 {amount}。感谢你继续使用 GastroMetrics。", next: "下次扣费日期：{next}。", cta: "查看我的套餐和发票" },
    failed: { subject: "你的 {plan} 套餐扣费失败", heading: "你的付款未能完成", body: "我们于 {date} 尝试为你的 {plan} 套餐扣费，但被银行拒绝。没有向你收取任何费用。Stripe 会在接下来几天重试；为保留你的套餐，请检查或更换银行卡。", next: "下次尝试：{next}。", cta: "更新我的银行卡" },
  },
}

const money = (cents: number | null, currency: string) =>
  typeof cents === "number" ? `${currency.toUpperCase() === "USD" ? "US$" : `${currency.toUpperCase()} `}${(cents / 100).toFixed(2)}` : "—"

/** Correo puro (para pruebas y vista previa). */
export function renderPaymentEmail(input: { record: PaymentRecord; language: string | null | undefined; recipientName?: string; actionUrl: string; unsubscribeUrl: string }) {
  const lang = normalizeEmailLang(input.language)
  const copy = PAYMENT_EMAIL_COPY[lang]
  const email = copy[input.record.status as Kind]
  const tz = { timeZone: "America/Tegucigalpa" }
  const vars = {
    amount: money(input.record.amountCents, input.record.currency),
    plan: escapeHtml(input.record.planSlug ? getPlanBySlug(input.record.planSlug).name : "GastroMetrics"),
    date: formatDate(input.record.at, tz),
    next: input.record.nextAt ? formatDate(input.record.nextAt, tz) : "",
  }
  const body = fillLabel(email.body, vars) + (vars.next ? ` ${fillLabel(email.next, vars)}` : "")
  const subject = fillLabel(email.subject, vars)
  const html = renderEmailTemplate("12-recordatorio.html", {
    htmlLang: lang,
    title: escapeHtml(subject),
    preheader: escapeHtml(body.slice(0, 140)),
    accent: "#F05324",
    eyebrow: copy.eyebrow,
    heading: email.heading,
    greeting: input.recipientName ? fillLabel(copy.hello, { name: escapeHtml(input.recipientName) }) : copy.helloNoName,
    body,
    statBlock: "",
    cta: escapeHtml(email.cta),
    actionUrl: input.actionUrl,
    footnote: copy.footnote,
    footerAddress: getEmailLabels(lang).footer_address,
    footer2: copy.footer2,
    unsubscribeUrl: input.unsubscribeUrl,
    unsubscribeLabel: copy.unsubscribe,
  })
  return { subject, html }
}

async function getMeta(accountId: string) {
  const { data } = await getSupabaseAdminClient().auth.admin.getUserById(accountId)
  if (!data?.user) return null
  return { email: data.user.email || "", meta: (data.user.app_metadata as Record<string, unknown>) || {} }
}

/**
 * Registra un cobro (si no estaba ya) y lo confirma: correo a la persona y aviso al dueño.
 * Idempotente por `record.key` (Stripe reintenta webhooks).
 */
export async function confirmPayment(accountId: string, record: PaymentRecord): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const info = await getMeta(accountId)
  if (!info) return false
  const { history, added } = pushPayment(info.meta.payment_history as PaymentRecord[] | undefined, record)
  if (!added) return false
  const { error } = await admin.auth.admin.updateUserById(accountId, {
    app_metadata: { ...info.meta, payment_history: history, last_payment: { ...record, seen: false } },
  })
  if (error) console.error("[payment-notice] No se pudo guardar el cobro:", error)

  try {
    if (process.env.RESEND_API_KEY && info.email) {
      const { data: profile } = await admin.from("profiles").select("preferred_language, full_name").eq("id", accountId).maybeSingle()
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      const { subject, html } = renderPaymentEmail({
        record,
        language: profile?.preferred_language,
        recipientName: (profile?.full_name || "").trim().split(/\s+/)[0] || undefined,
        actionUrl: withEmailTracking(`${siteUrl}/mi-plan`, `payment_${record.status}`),
        unsubscribeUrl: buildUnsubscribeUrl(accountId),
      })
      const { error: sendError } = await sendWithRetry(new Resend(process.env.RESEND_API_KEY), {
        from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
        to: [info.email],
        subject,
        html,
      })
      if (sendError) console.error("[payment-notice] Error mandando el correo:", sendError)
    }
    await sendOwnerBillingNotification({
      event: record.status === "paid" ? "payment_succeeded" : "payment_failed",
      accountId,
      toPlanSlug: record.planSlug || undefined,
      amountCents: record.amountCents,
    })
  } catch (notifyError) {
    console.error("[payment-notice] Error avisando el cobro:", notifyError)
  }
  return true
}

/** Para el aviso de la app: el último cobro si todavía no se vio. */
export async function unseenPayment(accountId: string): Promise<PaymentRecord | null> {
  const info = await getMeta(accountId)
  const last = info?.meta.last_payment as PaymentRecord | undefined
  return last && !last.seen ? last : null
}

export async function markPaymentSeen(accountId: string): Promise<void> {
  const info = await getMeta(accountId)
  const last = info?.meta.last_payment as PaymentRecord | undefined
  if (!info || !last || last.seen) return
  await getSupabaseAdminClient().auth.admin.updateUserById(accountId, { app_metadata: { ...info.meta, last_payment: { ...last, seen: true } } })
}

export async function paymentHistory(accountId: string): Promise<PaymentRecord[]> {
  const info = await getMeta(accountId)
  return (info?.meta.payment_history as PaymentRecord[] | undefined) || []
}
