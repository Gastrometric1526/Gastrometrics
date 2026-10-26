/**
 * Programa automático "100 cocinas fundadoras" (docs/158), parte con base de datos. La
 * decisión (quién, cuándo) es pura y vive en lib/founder-program.ts.
 *
 * - La posición de la cuenta sale de profiles.created_at (la fila se crea al registrarse):
 *   cuenta todas las cuentas, también las que ya existían antes del programa.
 * - Desde docs/201 (pedido del dueño) solo cuentan las cuentas con el correo CONFIRMADO, y el
 *   plan solo se da cuando la persona confirma: sin confirmar no puede entrar, no es usuario.
 *   Las que ya lo recibieron lo conservan.
 * - "Una sola vez" se guarda en app_metadata.founder_grant del usuario (Supabase Auth),
 *   sin migración nueva. Si llegan varias llamadas a la vez, el candado es el cambio
 *   condicional de account_plans (solo cambia si sigue en Foodie): una sola avisa (docs/163).
 * - El cambio de plan es el mismo que hace /admin (account_plans + correo de cambio de
 *   plan + aviso del Dashboard), así que se ve y se puede deshacer desde /admin igual.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { FOUNDER_PROGRAM, founderDecision, type FounderDecision } from "@/lib/founder-program"
import { sendPlanChangedEmail } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"
import { sendOwnerNotification, hondurasTime } from "@/lib/services/notify-owner"
import { isConfirmedAccount } from "@/lib/admin/confirmed-accounts"
import { selectAll } from "@/lib/admin/select-all"

/** Ids de las cuentas con el correo confirmado (Supabase Auth). */
async function confirmedAccountIds(): Promise<Set<string>> {
  const admin = getSupabaseAdminClient()
  const ids = new Set<string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) if (isConfirmedAccount(u)) ids.add(u.id)
    if (data.users.length < 200) break
  }
  return ids
}

export type FounderGrantResult = FounderDecision & { ordinal?: number; planSlug?: string }

async function accountOrdinal(createdAt: string): Promise<number | null> {
  const admin = getSupabaseAdminClient()
  // Cuentas eliminadas no cuentan (docs/165): las borradas desde /admin ya no tienen fila;
  // las que pidieron su eliminación (30 días de gracia) se excluyen aquí.
  // Y solo las confirmadas (docs/201).
  try {
    const [confirmed, { data, error }] = await Promise.all([
      confirmedAccountIds(),
      selectAll<{ id: string }>((from, to) =>
        admin.from("profiles").select("id").lte("created_at", createdAt).is("deletion_requested_at", null).order("created_at").range(from, to),
      ),
    ])
    if (error) throw error
    return (data ?? []).filter((p) => confirmed.has(p.id)).length
  } catch (error) {
    console.error("[founder-grant] No se pudo contar las cuentas:", error)
    return null
  }
}

export async function runFounderGrant(accountId: string, now = Date.now()): Promise<FounderGrantResult> {
  const admin = getSupabaseAdminClient()
  const [{ data: authData, error: authError }, { data: profile }, { data: planRow }] = await Promise.all([
    admin.auth.admin.getUserById(accountId),
    admin.from("profiles").select("created_at, full_name").eq("id", accountId).maybeSingle(),
    admin.from("account_plans").select("plan_slug, stripe_subscription_id").eq("account_id", accountId).maybeSingle(),
  ])
  const authUser = authData?.user
  if (authError || !authUser) return { action: "skip", reason: "before_program" }
  // Sin confirmar el correo todavía no es usuario: se le da cuando confirme (docs/201).
  if (!isConfirmedAccount(authUser)) return { action: "wait", waitMs: 60_000 }
  const createdAt = profile?.created_at || authUser.created_at
  // Atajos antes de contar posiciones (contar recorre todas las cuentas): ya la recibió o es
  // de antes del programa.
  if ((authUser.app_metadata as Record<string, unknown> | undefined)?.founder_grant) return { action: "skip", reason: "already_granted" }
  if (new Date(createdAt).getTime() < new Date(FOUNDER_PROGRAM.startsAt).getTime()) return { action: "skip", reason: "before_program" }
  const ordinal = await accountOrdinal(createdAt)
  if (ordinal === null) return { action: "wait", waitMs: 60_000 }

  const decision = founderDecision({
    accountCreatedAt: createdAt,
    ordinal,
    now,
    alreadyGranted: Boolean((authUser.app_metadata as Record<string, unknown> | undefined)?.founder_grant),
    currentPlanSlug: planRow?.plan_slug ?? null,
    hasStripeSubscription: Boolean(planRow?.stripe_subscription_id),
  })
  if (decision.action !== "grant") return { ...decision, ordinal }

  // 1) Plan, igual que /admin (sin tocar los negocios/cupos extra), con un cambio
  //    condicional que hace de candado: solo gana la llamada que encuentra la cuenta
  //    todavía en Foodie (o sin fila). docs/163: antes se leía la marca y luego se
  //    escribía, y 3 llamadas en el mismo segundo (pestañas abiertas, el minuto de espera
  //    que vence a la vez) pasaban las tres y mandaban 3 correos al dueño y 3 a la persona.
  const previousPlanSlug = planRow?.plan_slug || "foodie"
  const newPlan = {
    plan_slug: FOUNDER_PROGRAM.planSlug,
    plan_expires_at: decision.expiresAt,
    updated_at: new Date(now).toISOString(),
  }
  const claim = planRow
    ? await admin
        .from("account_plans")
        .update(newPlan)
        .eq("account_id", accountId)
        .eq("plan_slug", previousPlanSlug)
        .is("stripe_subscription_id", null)
        .select("account_id")
    : await admin.from("account_plans").insert({ account_id: accountId, ...newPlan }).select("account_id")
  if (claim.error) {
    // 23505: otra llamada creó la fila en el mismo instante, esa es la que avisa.
    if ((claim.error as { code?: string }).code === "23505") return { action: "skip", reason: "already_granted", ordinal }
    console.error("[founder-grant] No se pudo aplicar el plan:", claim.error)
    return { action: "wait", waitMs: 60_000, ordinal }
  }
  if (!claim.data || claim.data.length === 0) return { action: "skip", reason: "already_granted", ordinal }

  // 2) Marca "ya se dio" (una sola vez para siempre, aunque después vuelva a Foodie).
  const { error: markError } = await admin.auth.admin.updateUserById(accountId, {
    app_metadata: { ...(authUser.app_metadata || {}), founder_grant: { at: new Date(now).toISOString(), ordinal } },
  })
  if (markError) console.error("[founder-grant] No se pudo marcar la cuenta (el plan ya quedó aplicado):", markError)

  // 3) Avisos (best-effort: el plan ya quedó aplicado).
  const expiresAtUnixSeconds = Math.floor(new Date(decision.expiresAt).getTime() / 1000)
  try {
    await sendPlanChangedEmail({
      accountId,
      fromPlanSlug: previousPlanSlug,
      toPlanSlug: FOUNDER_PROGRAM.planSlug,
      nextChargeUnixSeconds: null,
      nextChargeAmountCents: null,
      expiresAtUnixSeconds,
      source: "admin",
    })
  } catch (error) {
    console.error("[founder-grant] Error mandando el correo de cambio de plan:", error)
  }
  await recordPlanChangeNotice({
    accountId,
    fromPlanSlug: previousPlanSlug,
    toPlanSlug: FOUNDER_PROGRAM.planSlug,
    amountCents: null,
    nextChargeUnixSeconds: null,
    expiresAtUnixSeconds,
    source: "admin",
  })
  await sendOwnerNotification({
    subject: `Cocina fundadora #${ordinal} de ${FOUNDER_PROGRAM.maxAccounts}: Chef Ejecutivo por 1 mes`,
    rows: [
      ["Cuenta", authUser.email],
      ["Nombre", profile?.full_name],
      ["Posición", `${ordinal} de ${FOUNDER_PROGRAM.maxAccounts}`],
      ["Plan", `Chef Ejecutivo (antes: ${previousPlanSlug})`],
      ["Vence", hondurasTime(decision.expiresAt)],
      ["Quedan", `${Math.max(FOUNDER_PROGRAM.maxAccounts - ordinal, 0)} lugares`],
    ],
    footnote: "Asignado automáticamente por el programa de 100 cocinas fundadoras. Se puede cambiar o quitar en Cuentas y planes.",
    label: "fundadora automática",
  })

  return { ...decision, ordinal, planSlug: FOUNDER_PROGRAM.planSlug }
}

/**
 * Respaldo del cron diario: cuentas del programa que no abrieron la app después del
 * minuto (la activación normal la dispara el Dashboard). Idempotente.
 */
export async function runPendingFounderGrants(now = Date.now()): Promise<{ checked: number; granted: number }> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", new Date(FOUNDER_PROGRAM.startsAt).toISOString())
    .lte("created_at", new Date(now - FOUNDER_PROGRAM.delayMs).toISOString())
    .order("created_at", { ascending: true })
  if (error) throw error
  let granted = 0
  for (const row of data ?? []) {
    const result = await runFounderGrant(row.id, now)
    if (result.action === "grant") granted++
    if (result.action === "skip" && result.reason === "over_limit") break
  }
  return { checked: data?.length ?? 0, granted }
}
