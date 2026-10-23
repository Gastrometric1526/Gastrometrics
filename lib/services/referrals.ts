/**
 * Programa de referidos (docs/179), parte con base de datos. Las decisiones son puras y
 * viven en lib/referrals.ts.
 *
 * Sin migración nueva, igual que el programa de fundadoras:
 * - El código sale del id de la cuenta (no se guarda); se busca por rango de uuid.
 * - La invitación vive en app_metadata.referral del invitado (InviteeReferral) y en un
 *   evento de product_events «referral_signup» con business_id = "<invita>:<invitado>",
 *   para listar los invitados de alguien y para /admin.
 * - Lo ganado por quien invita: app_metadata.referral_rewards (historial, para el tope
 *   anual) y app_metadata.referral_bank_days (meses guardados detrás de un plan mejor).
 * - Los cambios de plan son los mismos que hace /admin (account_plans + correo de cambio
 *   de plan + aviso del Dashboard).
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { sendPlanChangedEmail } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"
import { sendOwnerNotification } from "@/lib/services/notify-owner"
import { sendReferralEmail } from "@/lib/services/notify-referral"
import { getScheduledRenewal } from "@/lib/services/scheduled-renewal"
import { runFounderGrant } from "@/lib/services/founder-grant"
import { getPlanBySlug } from "@/lib/plans"
import { planTimeline } from "@/lib/plan-timeline"
import type { PaymentRecord } from "@/lib/payment-notice"
import {
  REFERRAL,
  activationStep,
  bankApplication,
  normalizeReferralCode,
  referralCodeFor,
  referralLink,
  rewardAction,
  rewardsInLastYear,
  uuidRangeForCode,
  windowDay,
  type InviteeReferral,
  type PlanState,
  type RewardAction,
  type RewardRecord,
} from "@/lib/referrals"

const EVENT = "referral_signup"
type Meta = Record<string, unknown>

async function getMeta(accountId: string): Promise<{ meta: Meta; email: string | null; createdAt: string | null } | null> {
  const { data, error } = await getSupabaseAdminClient().auth.admin.getUserById(accountId)
  if (error || !data?.user) return null
  return { meta: (data.user.app_metadata as Meta) || {}, email: data.user.email ?? null, createdAt: data.user.created_at ?? null }
}

async function patchMeta(accountId: string, patch: Meta): Promise<void> {
  const current = await getMeta(accountId)
  const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(accountId, { app_metadata: { ...(current?.meta || {}), ...patch } })
  if (error) console.error("[referrals] No se pudo guardar app_metadata:", error)
}

async function planState(accountId: string): Promise<PlanState & { customerId: string | null }> {
  const { data } = await getSupabaseAdminClient()
    .from("account_plans")
    .select("plan_slug, plan_expires_at, stripe_subscription_id, stripe_customer_id")
    .eq("account_id", accountId)
    .maybeSingle()
  return {
    planSlug: data?.plan_slug || "foodie",
    expiresAt: data?.plan_expires_at ?? null,
    hasStripeSubscription: Boolean(data?.stripe_subscription_id),
    customerId: data?.stripe_customer_id ?? null,
  }
}

const firstName = (full: string | null | undefined) => (full || "").trim().split(/\s+/)[0] || ""

// ─── Código y búsqueda ───

export async function lookupReferrer(code: string): Promise<{ id: string; firstName: string } | null> {
  const range = uuidRangeForCode(code)
  if (!range) return null
  const { data, error } = await getSupabaseAdminClient()
    .from("profiles")
    .select("id, full_name, created_at")
    .gte("id", range.from)
    .lte("id", range.to)
    .is("deletion_requested_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
  if (error || !data?.length) return null
  return { id: data[0].id, firstName: firstName(data[0].full_name) }
}

export function myReferralLink(accountId: string): { code: string; link: string } {
  const code = referralCodeFor(accountId)
  return { code, link: referralLink(process.env.NEXT_PUBLIC_SITE_URL || "https://www.gastrometrics.org", code) }
}

// ─── Registro del invitado ───

/** Se llama al crear la cuenta. Ignora códigos inválidos o propios sin romper el registro. */
export async function recordReferralAtSignup(
  inviteeId: string,
  rawCode: string | null | undefined,
  invitee: { email?: string; name?: string; language?: string } = {},
): Promise<boolean> {
  const code = normalizeReferralCode(rawCode)
  if (!code) return false
  const referrer = await lookupReferrer(code)
  if (!referrer || referrer.id === inviteeId) return false
  const referral: InviteeReferral = { by: referrer.id, code, at: new Date().toISOString(), status: "registered" }
  await patchMeta(inviteeId, { referral })
  const { error } = await getSupabaseAdminClient().from("product_events").insert({ event_name: EVENT, business_id: `${referrer.id}:${inviteeId}` } as never)
  if (error) console.error("[referrals] No se pudo registrar el evento de invitación:", error)

  // Aviso al dueño de GastroMetrics: cuenta nueva por invitación (docs/184). Va aparte del
  // aviso general de cuenta nueva para que se vea de un vistazo quién está trayendo gente.
  try {
    const referrerInfo = await getMeta(referrer.id)
    const total = (await referralPairs()).filter((p) => p.referrerId === referrer.id).length
    await sendOwnerNotification({
      subject: `Cuenta nueva por invitación: ${invitee.email || inviteeId}`,
      rows: [
        ["Cuenta nueva", invitee.email || inviteeId],
        ["Nombre", invitee.name || null],
        ["Idioma", invitee.language || null],
        ["Invitada por", `${referrer.firstName || "—"} (${referrerInfo?.email || referrer.id})`],
        ["Código", code],
        ["Invitaciones de esa persona", String(total)],
        ["Regalo", `${REFERRAL.giftDays} días de ${getPlanBySlug(REFERRAL.giftPlanSlug).name}, al abrir la app`],
      ],
      footnote: "Quien invitó gana su mes cuando esta cuenta guarde una receta con costo o elija un plan en sus primeros 30 días. Detalle en /admin → Activación → Referidos.",
      label: "cuenta nueva por invitación",
    })
  } catch (notifyError) {
    console.error("[referrals] No se pudo avisar al dueño de la cuenta por invitación:", notifyError)
  }
  return true
}

// ─── Aplicar lo ganado ───

async function applyAction(accountId: string, action: RewardAction, label: string): Promise<{ applied: boolean; date: string | null }> {
  const admin = getSupabaseAdminClient()
  if (action.kind === "grant" || action.kind === "extend") {
    const before = await planState(accountId)
    const row = { plan_slug: action.planSlug, plan_expires_at: action.expiresAt, updated_at: new Date().toISOString() }
    const { data: existing } = await admin.from("account_plans").select("account_id").eq("account_id", accountId).maybeSingle()
    const { error } = existing
      ? await admin.from("account_plans").update(row).eq("account_id", accountId).is("stripe_subscription_id", null)
      : await admin.from("account_plans").insert({ account_id: accountId, ...row })
    if (error) {
      console.error(`[referrals] No se pudo aplicar el plan (${label}):`, error)
      return { applied: false, date: null }
    }
    const expiresAtUnixSeconds = Math.floor(new Date(action.expiresAt).getTime() / 1000)
    if (before.planSlug !== action.planSlug) {
      try {
        await sendPlanChangedEmail({ accountId, fromPlanSlug: before.planSlug, toPlanSlug: action.planSlug, nextChargeUnixSeconds: null, nextChargeAmountCents: null, expiresAtUnixSeconds, source: "admin" })
      } catch (e) {
        console.error("[referrals] Error en el correo de cambio de plan:", e)
      }
      await recordPlanChangeNotice({ accountId, fromPlanSlug: before.planSlug, toPlanSlug: action.planSlug, amountCents: null, nextChargeUnixSeconds: null, expiresAtUnixSeconds, source: "admin" })
    }
    return { applied: true, date: action.expiresAt }
  }
  if (action.kind === "bank") {
    const current = await getMeta(accountId)
    const days = Number(current?.meta.referral_bank_days) || 0
    await patchMeta(accountId, { referral_bank_days: days + action.days })
    const state = await planState(accountId)
    return { applied: true, date: state.expiresAt }
  }
  if (action.kind === "stripe_credit") {
    const state = await planState(accountId)
    if (!isStripeConfigured() || !state.customerId) return { applied: false, date: null }
    try {
      await getStripeClient().customers.createBalanceTransaction(state.customerId, {
        amount: -action.amountCents,
        currency: "usd",
        description: `GastroMetrics: Regala un mes, gana un mes (${label})`,
      })
      return { applied: true, date: null }
    } catch (e) {
      console.error("[referrals] No se pudo abonar el saldo en Stripe:", e)
      return { applied: false, date: null }
    }
  }
  return { applied: false, date: null }
}

// ─── Regalo del invitado ───

export type GiftResult = { status: "none" | "already" | "wait" | "applied"; kind?: RewardAction["kind"]; planSlug?: string; waitMs?: number }

/**
 * Mes regalo del invitado. Primero se resuelve el programa de fundadoras (si le toca
 * Chef Ejecutivo, el regalo se guarda detrás); por eso, si fundadoras dice «espera», se
 * espera. Idempotente: se marca giftAt antes de aplicar.
 */
export async function claimInviteeGift(accountId: string): Promise<GiftResult> {
  const info = await getMeta(accountId)
  const referral = info?.meta.referral as InviteeReferral | undefined
  if (!referral) return { status: "none" }
  if (referral.giftAt) return { status: "already" }

  const founder = await runFounderGrant(accountId)
  if (founder.action === "wait") return { status: "wait", waitMs: founder.waitMs }

  await patchMeta(accountId, { referral: { ...referral, giftAt: new Date().toISOString() } })
  const state = await planState(accountId)
  const action = rewardAction(state, Date.now())
  const result = await applyAction(accountId, action, "regalo del invitado")
  if (result.applied && action.kind === "bank") await sendReferralEmail({ type: "gift_bank", accountId, date: result.date })
  if (result.applied && action.kind === "stripe_credit") await sendReferralEmail({ type: "gift_credit", accountId, amountCents: action.amountCents })
  return { status: "applied", kind: action.kind, planSlug: action.kind === "grant" || action.kind === "extend" ? action.planSlug : undefined }
}

// ─── Meses guardados ───

/**
 * Usa los meses guardados cuando el plan gratis venció y la cuenta no paga. Si dejó un
 * pago programado para esa fecha, los meses se abonan en Stripe (un mes del plan
 * programado por cada 30 días). Devuelve true si cambió algo.
 */
export async function applyDueReferralBank(accountId: string): Promise<boolean> {
  const info = await getMeta(accountId)
  const bankDays = Number(info?.meta.referral_bank_days) || 0
  if (!(bankDays > 0)) return false
  const state = await planState(accountId)
  const now = Date.now()
  const due = bankApplication(state, bankDays, now)
  if (!due) return false

  const renewal = await getScheduledRenewal(accountId)
  if (renewal?.customerId && isStripeConfigured()) {
    const cents = Math.round((getPlanBySlug(renewal.planSlug).priceUsdCents * bankDays) / 30)
    try {
      await getStripeClient().customers.createBalanceTransaction(renewal.customerId, {
        amount: -cents,
        currency: "usd",
        description: "GastroMetrics: meses ganados con Regala un mes, gana un mes",
      })
      await patchMeta(accountId, { referral_bank_days: 0 })
      return true
    } catch (e) {
      console.error("[referrals] No se pudo abonar los meses guardados en Stripe:", e)
      return false
    }
  }

  // Se vacía antes de aplicar: en el peor caso se pierde un aviso, nunca se duplica el mes.
  await patchMeta(accountId, { referral_bank_days: 0 })
  const { applied } = await applyAction(accountId, { kind: "grant", planSlug: due.planSlug, expiresAt: due.expiresAt }, "meses guardados")
  if (!applied) await patchMeta(accountId, { referral_bank_days: bankDays })
  return applied
}

// ─── Revisión diaria: activaciones, recordatorios y vencimientos ───

async function isActivated(inviteeId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient()
  const [{ count }, state] = await Promise.all([
    admin.from("recipes").select("id", { count: "exact", head: true }).eq("owner_id", inviteeId).gt("total_cost", 0),
    planState(inviteeId),
  ])
  return (count ?? 0) > 0 || state.hasStripeSubscription
}

async function referralPairs(): Promise<{ referrerId: string; inviteeId: string; at: string }[]> {
  const { data, error } = await getSupabaseAdminClient().from("product_events").select("business_id, created_at").eq("event_name", EVENT).order("created_at", { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as { business_id: string | null; created_at: string }[] // product_events no está en types/database.ts
  return rows
    .map((r) => {
      const [referrerId, inviteeId] = (r.business_id || "").split(":")
      return { referrerId, inviteeId, at: r.created_at }
    })
    .filter((p) => p.referrerId && p.inviteeId)
}

function whatsappNudgeUrl(language: string, inviteeName: string, link: string): string {
  const text: Record<string, string> = {
    es: `Hola ${inviteeName}, ¿ya probaste GastroMetrics? Arma tu primera receta y ve su costo real en 3 minutos: ${link}`,
    en: `Hi ${inviteeName}, have you tried GastroMetrics yet? Build your first recipe and see its real cost in 3 minutes: ${link}`,
    da: `Hej ${inviteeName}, har du prøvet GastroMetrics endnu? Lav din første opskrift og se den reelle kostpris på 3 minutter: ${link}`,
    fr: `Bonjour ${inviteeName}, tu as essayé GastroMetrics ? Crée ta première recette et vois son coût réel en 3 minutes : ${link}`,
    pt: `Olá ${inviteeName}, já testou o GastroMetrics? Monte a sua primeira receita e veja o custo real em 3 minutos: ${link}`,
    zh: `${inviteeName}，你好！试过 GastroMetrics 了吗？3 分钟做出第一个菜谱，看看它的真实成本：${link}`,
  }
  return `https://wa.me/?text=${encodeURIComponent(text[language] || text.es)}`
}

export async function runReferralChecks(now = Date.now()): Promise<{ checked: number; rewarded: number; expired: number; nudged: number; gifts: number }> {
  const admin = getSupabaseAdminClient()
  const pairs = await referralPairs()
  let rewarded = 0
  let expired = 0
  let nudged = 0
  let gifts = 0
  for (const pair of pairs) {
    let invitee = await getMeta(pair.inviteeId)
    let referral = invitee?.meta.referral as InviteeReferral | undefined
    if (!referral || referral.by !== pair.referrerId) continue

    // Respaldo: invitados que nunca abrieron la app después de registrarse.
    if (!referral.giftAt) {
      const gift = await claimInviteeGift(pair.inviteeId)
      if (gift.status === "applied") gifts++
      // Se vuelve a leer: claimInviteeGift guardó giftAt.
      invitee = await getMeta(pair.inviteeId)
      referral = invitee?.meta.referral as InviteeReferral | undefined
      if (!referral) continue
    }
    if (referral.status !== "registered") continue

    const referrer = await getMeta(pair.referrerId)
    if (!referrer) continue
    const rewards = (referrer.meta.referral_rewards as RewardRecord[] | undefined) || []
    const step = activationStep({ referral, isActive: await isActivated(pair.inviteeId), rewardsLastYear: rewardsInLastYear(rewards, now), now })
    const { data: inviteeProfile } = await admin.from("profiles").select("full_name").eq("id", pair.inviteeId).maybeSingle()
    const inviteeName = firstName(inviteeProfile?.full_name) || (invitee?.email || "").split("@")[0]

    if (step.action === "reward") {
      const nowIso = new Date(now).toISOString()
      await patchMeta(pair.inviteeId, { referral: { ...referral, status: "rewarded", activatedAt: nowIso, rewardedAt: nowIso } })
      const action = rewardAction(await planState(pair.referrerId), now)
      await patchMeta(pair.referrerId, { referral_rewards: [...rewards, { invitee: pair.inviteeId, at: nowIso, kind: action.kind }] })
      const result = await applyAction(pair.referrerId, action, "premio por invitar")
      if (result.applied) {
        rewarded++
        const type = action.kind === "grant" ? "reward_grant" : action.kind === "extend" ? "reward_extend" : action.kind === "bank" ? "reward_bank" : "reward_credit"
        await sendReferralEmail({ type, accountId: pair.referrerId, inviteeName, date: result.date, amountCents: action.kind === "stripe_credit" ? action.amountCents : null })
        await sendOwnerNotification({
          subject: `Referido activo: ${inviteeName} (invitó ${referrer.email})`,
          rows: [
            ["Invitó", referrer.email],
            ["Invitado", invitee?.email],
            ["Premio", action.kind],
          ],
          footnote: "Programa «Regala un mes, gana un mes» (docs/179). Se ve en /admin → Referidos.",
          label: "referido activo",
        })
      }
    } else if (step.action === "activate_capped") {
      const nowIso = new Date(now).toISOString()
      await patchMeta(pair.inviteeId, { referral: { ...referral, status: "active", activatedAt: nowIso } })
    } else if (step.action === "expire") {
      await patchMeta(pair.inviteeId, { referral: { ...referral, status: "expired" } })
      expired++
    } else if (step.action === "nudge") {
      await patchMeta(pair.inviteeId, { referral: { ...referral, nudges: [...(referral.nudges || []), step.day] } })
      const { data: referrerProfile } = await admin.from("profiles").select("product_updates_opt_in, preferred_language").eq("id", pair.referrerId).maybeSingle()
      if (referrerProfile?.product_updates_opt_in !== false) {
        const { link } = myReferralLink(pair.referrerId)
        await sendReferralEmail({ type: "nudge", accountId: pair.referrerId, inviteeName, actionUrl: whatsappNudgeUrl(referrerProfile?.preferred_language || "es", inviteeName, link) })
        nudged++
      }
    }
  }
  return { checked: pairs.length, rewarded, expired, nudged, gifts }
}

// ─── Lectura para /invita y /admin ───

export interface InviteView {
  name: string
  status: InviteeReferral["status"]
  registeredAt: string
  day: number
  daysLeft: number
}

export async function referralOverview(accountId: string, now = Date.now()) {
  const admin = getSupabaseAdminClient()
  const info = await getMeta(accountId)
  const { code, link } = myReferralLink(accountId)
  const pairs = (await referralPairs()).filter((p) => p.referrerId === accountId)
  const invites: InviteView[] = []
  for (const pair of pairs.reverse()) {
    const invitee = await getMeta(pair.inviteeId)
    const referral = invitee?.meta.referral as InviteeReferral | undefined
    if (!referral) continue
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", pair.inviteeId).maybeSingle()
    const day = Math.min(windowDay(referral.at, now), REFERRAL.activationWindowDays)
    invites.push({
      name: firstName(profile?.full_name) || (invitee?.email || "").split("@")[0],
      status: referral.status,
      registeredAt: referral.at,
      day,
      daysLeft: Math.max(REFERRAL.activationWindowDays - day, 0),
    })
  }
  const rewards = (info?.meta.referral_rewards as RewardRecord[] | undefined) || []
  const state = await planState(accountId)
  const bankDays = Number(info?.meta.referral_bank_days) || 0
  // Vencimiento y siguiente cobro (docs/180), para la tarjeta «Tu plan» de /invita y /mi-plan.
  const [{ data: billing }, scheduled] = await Promise.all([
    admin.from("account_plans").select("current_period_end, cancel_at_period_end").eq("account_id", accountId).maybeSingle(),
    getScheduledRenewal(accountId),
  ])
  const timeline = planTimeline({
    planSlug: state.planSlug,
    expiresAt: state.expiresAt,
    hasStripeSubscription: state.hasStripeSubscription,
    currentPeriodEnd: billing?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(billing?.cancel_at_period_end),
    scheduled: scheduled ? { planSlug: scheduled.planSlug, startsAt: scheduled.startsAt } : null,
    bankDays,
  })
  return {
    code,
    link,
    invites,
    rewardsEarned: rewards.filter((r) => r.kind !== "none").length,
    rewardsThisYear: rewardsInLastYear(rewards, now),
    maxRewardsPerYear: REFERRAL.maxRewardsPerYear,
    bankDays,
    timeline,
    /** Últimos cobros de Stripe, hechos o fallidos (docs/183), para «Tu plan». */
    payments: ((info?.meta.payment_history as PaymentRecord[] | undefined) || []).slice(0, 3),
    /** Cuándo empiezan los meses guardados: al vencer el plan actual. */
    bankStartsAt: state.expiresAt,
    planSlug: state.planSlug,
    giftPlanSlug: REFERRAL.giftPlanSlug,
    giftDays: REFERRAL.giftDays,
    referredBy: (info?.meta.referral as InviteeReferral | undefined)?.status ?? null,
  }
}

export async function adminReferralList(now = Date.now()) {
  const pairs = await referralPairs()
  const out: { referrer: string | null; invitee: string | null; status: string; registeredAt: string; day: number; activatedAt: string | null }[] = []
  for (const pair of pairs.reverse()) {
    const [referrer, invitee] = await Promise.all([getMeta(pair.referrerId), getMeta(pair.inviteeId)])
    const referral = invitee?.meta.referral as InviteeReferral | undefined
    out.push({
      referrer: referrer?.email ?? null,
      invitee: invitee?.email ?? null,
      status: referral?.status ?? "—",
      registeredAt: referral?.at ?? pair.at,
      day: referral ? Math.min(windowDay(referral.at, now), REFERRAL.activationWindowDays) : 0,
      activatedAt: referral?.activatedAt ?? null,
    })
  }
  return out
}

/** Referidos de una cuenta para la radiografía de /admin (docs/183). */
export async function adminReferralSummary(accountId: string, now = Date.now()) {
  const info = await getMeta(accountId)
  const own = info?.meta.referral as InviteeReferral | undefined
  const pairs = (await referralPairs()).filter((p) => p.referrerId === accountId || p.inviteeId === accountId)
  const invitedBy = own ? (await getMeta(own.by))?.email ?? null : null
  const invites: { email: string | null; status: string; registeredAt: string }[] = []
  for (const pair of pairs.filter((p) => p.referrerId === accountId).reverse()) {
    const invitee = await getMeta(pair.inviteeId)
    const referral = invitee?.meta.referral as InviteeReferral | undefined
    invites.push({ email: invitee?.email ?? null, status: referral?.status ?? "—", registeredAt: referral?.at ?? pair.at })
  }
  const rewards = (info?.meta.referral_rewards as RewardRecord[] | undefined) || []
  const counts = (await referralCountsFor([accountId])).get(accountId) || { sent: 0, created: 0, active: 0 }
  return {
    code: referralCodeFor(accountId),
    sent: counts.sent,
    active: counts.active,
    invitedBy,
    invitedStatus: own?.status ?? null,
    giftAt: own?.giftAt ?? null,
    invites,
    rewardsEarned: rewards.filter((r) => r.kind !== "none").length,
    rewardsThisYear: rewardsInLastYear(rewards, now),
    bankDays: Number(info?.meta.referral_bank_days) || 0,
  }
}

// ─── Invitaciones enviadas (docs/186) ───

export const REFERRAL_SHARE_CHANNELS = ["copy", "whatsapp", "email", "remind"] as const
export type ReferralShareChannel = (typeof REFERRAL_SHARE_CHANNELS)[number]
const SHARE_EVENT = "referral_share"

/** Cada vez que alguien copia su enlace o lo manda por WhatsApp/correo (o le recuerda a un invitado). */
export async function recordReferralShare(accountId: string, channel: ReferralShareChannel): Promise<void> {
  const { error } = await getSupabaseAdminClient().from("product_events").insert({ event_name: SHARE_EVENT, business_id: `${accountId}:${channel}` } as never)
  if (error) console.error("[referrals] No se pudo registrar la invitación enviada:", error)
}

export interface ReferralCounts {
  /** Veces que compartió su enlace (copiar, WhatsApp, correo). */
  sent: number
  /** Cuentas creadas con su enlace. */
  created: number
  /** De esas, las que ya empezaron (receta con costo o plan pagado) o le dieron su mes. */
  active: number
}

/** Conteos de invitaciones por cuenta, para /admin. */
export async function referralCountsFor(accountIds: string[]): Promise<Map<string, ReferralCounts>> {
  const out = new Map<string, ReferralCounts>()
  if (!accountIds.length) return out
  const wanted = new Set(accountIds)
  const get = (id: string) => out.get(id) || (out.set(id, { sent: 0, created: 0, active: 0 }), out.get(id)!)
  const { data, error } = await getSupabaseAdminClient().from("product_events").select("event_name, business_id").in("event_name", [SHARE_EVENT, EVENT])
  if (error) throw error
  const rows = (data ?? []) as unknown as { event_name: string; business_id: string | null }[]
  const invitees: { referrerId: string; inviteeId: string }[] = []
  for (const r of rows) {
    const [a, b] = (r.business_id || "").split(":")
    if (!a || !wanted.has(a)) continue
    if (r.event_name === SHARE_EVENT && b !== "remind") get(a).sent++
    if (r.event_name === EVENT && b) {
      get(a).created++
      invitees.push({ referrerId: a, inviteeId: b })
    }
  }
  await Promise.all(
    invitees.map(async ({ referrerId, inviteeId }) => {
      const status = ((await getMeta(inviteeId))?.meta.referral as InviteeReferral | undefined)?.status
      if (status === "active" || status === "rewarded") get(referrerId).active++
    }),
  )
  return out
}
