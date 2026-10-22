/**
 * Correos del programa de referidos (docs/179), en el idioma de cada destinatario (6
 * idiomas). Usan la plantilla de recordatorio (12-recordatorio.html).
 * - A quien invita: ganó un mes (según cómo se le entregó) o un recordatorio de que su
 *   invitado todavía no empieza (días 3 y 14).
 * - Al invitado: solo cuando su mes regalo no empieza de inmediato (se guarda detrás de
 *   un plan mejor, o se abona en Stripe). Si empieza ya, le llega el correo normal de
 *   cambio de plan.
 */

import { Resend } from "resend"
import { sendWithRetry } from "./send-email"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getEmailLabels, fillLabel, normalizeEmailLang, type EmailLang } from "@/lib/i18n/email-labels"
import { withEmailTracking } from "@/lib/email-tracking"
import { buildUnsubscribeUrl } from "@/lib/email-unsubscribe"
import { formatDate } from "@/lib/date-format"

export type ReferralEmailType = "reward_grant" | "reward_extend" | "reward_bank" | "reward_credit" | "gift_bank" | "gift_credit" | "nudge"

interface Copy {
  subject: string
  heading: string
  body: string
  cta: string
}

interface LangCopy {
  eyebrow: string
  hello: string
  helloNoName: string
  footnote: string
  unsubscribe: string
  footer2: string
  emails: Record<ReferralEmailType, Copy>
}

// {name} = nombre del invitado · {date} = fecha dd/mm/aaaa · {amount} = monto en USD
export const REFERRAL_EMAIL_COPY: Record<EmailLang, LangCopy> = {
  es: {
    eyebrow: "Regala un mes, gana un mes",
    hello: "Hola {name},",
    helloNoName: "Hola,",
    footnote: "Recibes este correo porque participas en el programa «Regala un mes, gana un mes» de GastroMetrics.",
    unsubscribe: "Dejar de recibir estos correos",
    footer2: "Programa de referidos de tu cuenta GastroMetrics.",
    emails: {
      reward_grant: { subject: "Ganaste un mes de Chef de Partie", heading: "¡Ganaste un mes!", body: "{name} ya está usando GastroMetrics gracias a tu invitación. Tienes Chef de Partie gratis hasta el {date}: inventario, menús, órdenes de compra y estadísticas. Al terminar vuelves solo a tu plan gratis, sin ningún cobro.", cta: "Invitar a alguien más" },
      reward_extend: { subject: "Sumamos un mes a tu Chef de Partie", heading: "¡Un mes más!", body: "{name} ya está usando GastroMetrics gracias a tu invitación. Sumamos 30 días a tu Chef de Partie: ahora vence el {date}.", cta: "Invitar a alguien más" },
      reward_bank: { subject: "Ganaste un mes: lo guardamos para ti", heading: "¡Ganaste un mes!", body: "{name} ya está usando GastroMetrics gracias a tu invitación. Como tu plan actual es mejor, guardamos tu mes de Chef de Partie: empieza solo cuando termine tu plan actual, el {date}. No pierdes nada de lo que tienes hoy.", cta: "Ver mis meses guardados" },
      reward_credit: { subject: "Ganaste un mes: te abonamos {amount}", heading: "¡Ganaste un mes!", body: "{name} ya está usando GastroMetrics gracias a tu invitación. Abonamos {amount} a tu cuenta: se descuentan solos de tu próximo cobro.", cta: "Invitar a alguien más" },
      gift_bank: { subject: "Tu mes de regalo te espera", heading: "Tu mes de regalo está guardado", body: "Gracias por entrar por la invitación de un colega. Como ahora tienes un plan mejor, tu mes de Chef de Partie se guarda y empieza solo cuando termine tu plan actual, el {date}. Nunca te pediremos una tarjeta para usarlo.", cta: "Abrir GastroMetrics" },
      gift_credit: { subject: "Tu mes de regalo: te abonamos {amount}", heading: "Tu mes de regalo", body: "Gracias por entrar por la invitación de un colega. Como ya pagas un plan, abonamos {amount} a tu cuenta: se descuentan solos de tu próximo cobro.", cta: "Abrir GastroMetrics" },
      nudge: { subject: "{name} todavía no arma su primera receta", heading: "¿Le das un empujoncito?", body: "{name} aceptó tu invitación, pero todavía no arma su primera receta con costo. Ganas tu mes cuando lo haga, dentro de sus 30 días gratis. Un mensaje tuyo por WhatsApp suele ser lo que más ayuda.", cta: "Recordarle por WhatsApp" },
    },
  },
  en: {
    eyebrow: "Give a month, get a month",
    hello: "Hi {name},",
    helloNoName: "Hi there,",
    footnote: "You're getting this email because you take part in GastroMetrics' «Give a month, get a month» program.",
    unsubscribe: "Stop receiving these emails",
    footer2: "Referral program of your GastroMetrics account.",
    emails: {
      reward_grant: { subject: "You earned a month of Chef de Partie", heading: "You earned a month!", body: "{name} is now using GastroMetrics thanks to your invitation. You have Chef de Partie for free until {date}: inventory, menus, purchase orders and reports. When it ends you go back to your free plan on your own, with no charge.", cta: "Invite someone else" },
      reward_extend: { subject: "We added a month to your Chef de Partie", heading: "One more month!", body: "{name} is now using GastroMetrics thanks to your invitation. We added 30 days to your Chef de Partie: it now ends on {date}.", cta: "Invite someone else" },
      reward_bank: { subject: "You earned a month: we saved it for you", heading: "You earned a month!", body: "{name} is now using GastroMetrics thanks to your invitation. Since your current plan is better, we saved your month of Chef de Partie: it starts on its own when your current plan ends, on {date}. You don't lose anything you have today.", cta: "See my saved months" },
      reward_credit: { subject: "You earned a month: we credited {amount}", heading: "You earned a month!", body: "{name} is now using GastroMetrics thanks to your invitation. We credited {amount} to your account: it comes off your next charge automatically.", cta: "Invite someone else" },
      gift_bank: { subject: "Your gift month is waiting", heading: "Your gift month is saved", body: "Thanks for joining through a colleague's invitation. Since you now have a better plan, your month of Chef de Partie is saved and starts on its own when your current plan ends, on {date}. We'll never ask for a card to use it.", cta: "Open GastroMetrics" },
      gift_credit: { subject: "Your gift month: we credited {amount}", heading: "Your gift month", body: "Thanks for joining through a colleague's invitation. Since you already pay for a plan, we credited {amount} to your account: it comes off your next charge automatically.", cta: "Open GastroMetrics" },
      nudge: { subject: "{name} hasn't made their first recipe yet", heading: "Give them a little nudge?", body: "{name} accepted your invitation but hasn't made their first costed recipe yet. You earn your month when they do, within their 30 free days. A WhatsApp message from you usually helps the most.", cta: "Remind them on WhatsApp" },
    },
  },
  da: {
    eyebrow: "Giv en måned, få en måned",
    hello: "Hej {name},",
    helloNoName: "Hej,",
    footnote: "Du får denne e-mail, fordi du deltager i GastroMetrics' program «Giv en måned, få en måned».",
    unsubscribe: "Stop med at modtage disse e-mails",
    footer2: "Henvisningsprogram for din GastroMetrics-konto.",
    emails: {
      reward_grant: { subject: "Du har vundet en måned med Chef de Partie", heading: "Du har vundet en måned!", body: "{name} bruger nu GastroMetrics takket være din invitation. Du har Chef de Partie gratis indtil {date}: lager, menuer, indkøbsordrer og statistik. Når den slutter, går du selv tilbage til din gratis plan, uden betaling.", cta: "Inviter en til" },
      reward_extend: { subject: "Vi har lagt en måned til din Chef de Partie", heading: "En måned mere!", body: "{name} bruger nu GastroMetrics takket være din invitation. Vi har lagt 30 dage til din Chef de Partie: den udløber nu den {date}.", cta: "Inviter en til" },
      reward_bank: { subject: "Du har vundet en måned: vi har gemt den til dig", heading: "Du har vundet en måned!", body: "{name} bruger nu GastroMetrics takket være din invitation. Da din nuværende plan er bedre, har vi gemt din måned med Chef de Partie: den starter af sig selv, når din nuværende plan slutter, den {date}. Du mister intet af det, du har i dag.", cta: "Se mine gemte måneder" },
      reward_credit: { subject: "Du har vundet en måned: vi har krediteret {amount}", heading: "Du har vundet en måned!", body: "{name} bruger nu GastroMetrics takket være din invitation. Vi har krediteret {amount} på din konto: det trækkes automatisk fra din næste betaling.", cta: "Inviter en til" },
      gift_bank: { subject: "Din gavemåned venter", heading: "Din gavemåned er gemt", body: "Tak, fordi du kom med via en kollegas invitation. Da du nu har en bedre plan, er din måned med Chef de Partie gemt og starter af sig selv, når din nuværende plan slutter, den {date}. Vi beder aldrig om et kort for at bruge den.", cta: "Åbn GastroMetrics" },
      gift_credit: { subject: "Din gavemåned: vi har krediteret {amount}", heading: "Din gavemåned", body: "Tak, fordi du kom med via en kollegas invitation. Da du allerede betaler for en plan, har vi krediteret {amount} på din konto: det trækkes automatisk fra din næste betaling.", cta: "Åbn GastroMetrics" },
      nudge: { subject: "{name} har endnu ikke lavet sin første opskrift", heading: "Giver du et lille skub?", body: "{name} har accepteret din invitation, men har endnu ikke lavet sin første opskrift med kostpris. Du vinder din måned, når det sker, inden for vedkommendes 30 gratis dage. En besked fra dig på WhatsApp hjælper som regel mest.", cta: "Påmind på WhatsApp" },
    },
  },
  fr: {
    eyebrow: "Offrez un mois, gagnez un mois",
    hello: "Bonjour {name},",
    helloNoName: "Bonjour,",
    footnote: "Vous recevez cet e-mail parce que vous participez au programme « Offrez un mois, gagnez un mois » de GastroMetrics.",
    unsubscribe: "Ne plus recevoir ces e-mails",
    footer2: "Programme de parrainage de votre compte GastroMetrics.",
    emails: {
      reward_grant: { subject: "Vous avez gagné un mois de Chef de Partie", heading: "Vous avez gagné un mois !", body: "{name} utilise maintenant GastroMetrics grâce à votre invitation. Vous avez Chef de Partie gratuitement jusqu’au {date} : stock, menus, bons de commande et statistiques. À la fin, vous revenez seul à votre formule gratuite, sans aucun prélèvement.", cta: "Inviter quelqu’un d’autre" },
      reward_extend: { subject: "Nous avons ajouté un mois à votre Chef de Partie", heading: "Un mois de plus !", body: "{name} utilise maintenant GastroMetrics grâce à votre invitation. Nous avons ajouté 30 jours à votre Chef de Partie : il se termine désormais le {date}.", cta: "Inviter quelqu’un d’autre" },
      reward_bank: { subject: "Vous avez gagné un mois : nous vous le gardons", heading: "Vous avez gagné un mois !", body: "{name} utilise maintenant GastroMetrics grâce à votre invitation. Comme votre formule actuelle est meilleure, nous gardons votre mois de Chef de Partie : il commence tout seul à la fin de votre formule actuelle, le {date}. Vous ne perdez rien de ce que vous avez aujourd’hui.", cta: "Voir mes mois gardés" },
      reward_credit: { subject: "Vous avez gagné un mois : nous avons crédité {amount}", heading: "Vous avez gagné un mois !", body: "{name} utilise maintenant GastroMetrics grâce à votre invitation. Nous avons crédité {amount} sur votre compte : ils sont déduits automatiquement de votre prochain prélèvement.", cta: "Inviter quelqu’un d’autre" },
      gift_bank: { subject: "Votre mois offert vous attend", heading: "Votre mois offert est gardé", body: "Merci d’être arrivé grâce à l’invitation d’un collègue. Comme vous avez maintenant une meilleure formule, votre mois de Chef de Partie est gardé et commence tout seul à la fin de votre formule actuelle, le {date}. Nous ne vous demanderons jamais de carte pour l’utiliser.", cta: "Ouvrir GastroMetrics" },
      gift_credit: { subject: "Votre mois offert : nous avons crédité {amount}", heading: "Votre mois offert", body: "Merci d’être arrivé grâce à l’invitation d’un collègue. Comme vous payez déjà une formule, nous avons crédité {amount} sur votre compte : ils sont déduits automatiquement de votre prochain prélèvement.", cta: "Ouvrir GastroMetrics" },
      nudge: { subject: "{name} n’a pas encore créé sa première recette", heading: "Un petit coup de pouce ?", body: "{name} a accepté votre invitation, mais n’a pas encore créé sa première recette avec coût. Vous gagnez votre mois dès que c’est fait, pendant ses 30 jours gratuits. Un message de votre part sur WhatsApp aide généralement le plus.", cta: "Le relancer sur WhatsApp" },
    },
  },
  pt: {
    eyebrow: "Dê um mês, ganhe um mês",
    hello: "Olá {name},",
    helloNoName: "Olá,",
    footnote: "Você recebe este e-mail porque participa do programa «Dê um mês, ganhe um mês» do GastroMetrics.",
    unsubscribe: "Parar de receber estes e-mails",
    footer2: "Programa de indicações da sua conta GastroMetrics.",
    emails: {
      reward_grant: { subject: "Você ganhou um mês de Chef de Partie", heading: "Você ganhou um mês!", body: "{name} já está usando o GastroMetrics graças ao seu convite. Você tem o Chef de Partie grátis até {date}: estoque, cardápios, pedidos de compra e estatísticas. Ao terminar, você volta sozinho ao plano grátis, sem nenhuma cobrança.", cta: "Convidar mais alguém" },
      reward_extend: { subject: "Somamos um mês ao seu Chef de Partie", heading: "Mais um mês!", body: "{name} já está usando o GastroMetrics graças ao seu convite. Somamos 30 dias ao seu Chef de Partie: agora ele vence em {date}.", cta: "Convidar mais alguém" },
      reward_bank: { subject: "Você ganhou um mês: guardamos para você", heading: "Você ganhou um mês!", body: "{name} já está usando o GastroMetrics graças ao seu convite. Como o seu plano atual é melhor, guardamos o seu mês de Chef de Partie: ele começa sozinho quando o seu plano atual terminar, em {date}. Você não perde nada do que tem hoje.", cta: "Ver meus meses guardados" },
      reward_credit: { subject: "Você ganhou um mês: creditamos {amount}", heading: "Você ganhou um mês!", body: "{name} já está usando o GastroMetrics graças ao seu convite. Creditamos {amount} na sua conta: o valor é descontado automaticamente da sua próxima cobrança.", cta: "Convidar mais alguém" },
      gift_bank: { subject: "Seu mês de presente está esperando", heading: "Seu mês de presente está guardado", body: "Obrigado por entrar pelo convite de um colega. Como agora você tem um plano melhor, o seu mês de Chef de Partie fica guardado e começa sozinho quando o seu plano atual terminar, em {date}. Nunca vamos pedir cartão para usá-lo.", cta: "Abrir o GastroMetrics" },
      gift_credit: { subject: "Seu mês de presente: creditamos {amount}", heading: "Seu mês de presente", body: "Obrigado por entrar pelo convite de um colega. Como você já paga um plano, creditamos {amount} na sua conta: o valor é descontado automaticamente da sua próxima cobrança.", cta: "Abrir o GastroMetrics" },
      nudge: { subject: "{name} ainda não fez a primeira receita", heading: "Que tal um empurrãozinho?", body: "{name} aceitou o seu convite, mas ainda não fez a primeira receita com custo. Você ganha o seu mês quando isso acontecer, dentro dos 30 dias grátis dessa pessoa. Uma mensagem sua pelo WhatsApp costuma ser o que mais ajuda.", cta: "Lembrar pelo WhatsApp" },
    },
  },
  zh: {
    eyebrow: "送一个月，得一个月",
    hello: "{name}，你好：",
    helloNoName: "你好：",
    footnote: "你收到这封邮件，是因为你参加了 GastroMetrics 的「送一个月，得一个月」计划。",
    unsubscribe: "不再接收此类邮件",
    footer2: "你的 GastroMetrics 账户推荐计划。",
    emails: {
      reward_grant: { subject: "你获得了一个月的 Chef de Partie", heading: "你获得了一个月！", body: "{name} 通过你的邀请开始使用 GastroMetrics。你可以免费使用 Chef de Partie 直到 {date}：库存、菜单、采购单和统计。到期后会自动回到免费套餐，不会产生任何费用。", cta: "再邀请一位" },
      reward_extend: { subject: "你的 Chef de Partie 增加了一个月", heading: "再加一个月！", body: "{name} 通过你的邀请开始使用 GastroMetrics。你的 Chef de Partie 增加了 30 天：现在到期日为 {date}。", cta: "再邀请一位" },
      reward_bank: { subject: "你获得了一个月：我们为你保留着", heading: "你获得了一个月！", body: "{name} 通过你的邀请开始使用 GastroMetrics。由于你当前的套餐更好，我们为你保留了一个月的 Chef de Partie：它会在你当前套餐结束时（{date}）自动开始。你今天拥有的一切都不会受影响。", cta: "查看我保留的月份" },
      reward_credit: { subject: "你获得了一个月：我们已为你充值 {amount}", heading: "你获得了一个月！", body: "{name} 通过你的邀请开始使用 GastroMetrics。我们已为你的账户充值 {amount}：会自动从你的下一次扣款中抵扣。", cta: "再邀请一位" },
      gift_bank: { subject: "你的赠送月份正在等你", heading: "你的赠送月份已保留", body: "感谢你通过同行的邀请加入。由于你现在的套餐更好，你的一个月 Chef de Partie 已被保留，会在你当前套餐结束时（{date}）自动开始。我们永远不会要求你绑定银行卡才能使用。", cta: "打开 GastroMetrics" },
      gift_credit: { subject: "你的赠送月份：我们已为你充值 {amount}", heading: "你的赠送月份", body: "感谢你通过同行的邀请加入。由于你已经在付费使用套餐，我们已为你的账户充值 {amount}：会自动从你的下一次扣款中抵扣。", cta: "打开 GastroMetrics" },
      nudge: { subject: "{name} 还没有做第一个菜谱", heading: "要不要提醒一下？", body: "{name} 接受了你的邀请，但还没有做出第一个带成本的菜谱。只要对方在 30 天免费期内完成，你就能获得一个月。你通过 WhatsApp 发一条消息通常最有帮助。", cta: "通过 WhatsApp 提醒" },
    },
  },
}

async function accountInfo(accountId: string): Promise<{ email: string; language: string; name: string } | null> {
  const admin = getSupabaseAdminClient()
  const [{ data, error }, { data: profile }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("preferred_language, full_name").eq("id", accountId).maybeSingle(),
  ])
  if (error || !data.user?.email) return null
  return { email: data.user.email, language: profile?.preferred_language || "es", name: (profile?.full_name || "").split(" ")[0] }
}

/** Correo puro (para pruebas y vista previa). */
export function renderReferralEmail(input: {
  type: ReferralEmailType
  language: string | null | undefined
  recipientName?: string
  inviteeName?: string
  date?: string | null
  amountCents?: number | null
  actionUrl: string
  unsubscribeUrl: string
}): { subject: string; html: string } {
  const lang = normalizeEmailLang(input.language)
  const copy = REFERRAL_EMAIL_COPY[lang]
  const email = copy.emails[input.type]
  const vars = {
    name: escapeHtml(input.inviteeName || "—"),
    date: input.date ? formatDate(input.date, { timeZone: "America/Tegucigalpa" }) : "—",
    amount: typeof input.amountCents === "number" ? `US$${(input.amountCents / 100).toFixed(2)}` : "—",
  }
  const plain = { ...vars, name: input.inviteeName || "—" }
  const subject = fillLabel(email.subject, plain)
  const safeRecipient = input.recipientName ? escapeHtml(input.recipientName) : ""
  const html = renderEmailTemplate("12-recordatorio.html", {
    htmlLang: lang,
    title: escapeHtml(subject),
    preheader: escapeHtml(fillLabel(email.body, plain).slice(0, 140)),
    accent: "#F05324",
    eyebrow: copy.eyebrow,
    heading: email.heading,
    greeting: safeRecipient ? fillLabel(copy.hello, { name: safeRecipient }) : copy.helloNoName,
    body: fillLabel(email.body, vars),
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

export async function sendReferralEmail(input: {
  type: ReferralEmailType
  accountId: string
  inviteeName?: string
  date?: string | null
  amountCents?: number | null
  /** Para el recordatorio: enlace de WhatsApp ya armado. */
  actionUrl?: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const account = await accountInfo(input.accountId)
  if (!account) return
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const actionUrl = input.actionUrl || withEmailTracking(`${siteUrl}${input.type.startsWith("gift") ? "/dashboard" : "/invita"}`, `referral_${input.type}`)
  const { subject, html } = renderReferralEmail({
    type: input.type,
    language: account.language,
    recipientName: account.name,
    inviteeName: input.inviteeName,
    date: input.date,
    amountCents: input.amountCents,
    actionUrl,
    unsubscribeUrl: buildUnsubscribeUrl(input.accountId),
  })
  const { error } = await sendWithRetry(new Resend(process.env.RESEND_API_KEY), {
    from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
    to: [account.email],
    subject,
    html,
  })
  if (error) console.error("[notify-referral] Error mandando el correo:", input.type, error)
}
