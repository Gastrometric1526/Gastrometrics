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
import { FOUNDER_PROGRAM, founderDecision, founderPeriodEnd, founderSeatReleased, type FounderDecision } from "@/lib/founder-program"
import { sendPlanChangedEmail } from "@/lib/services/notify-billing"
import { recordPlanChangeNotice } from "@/lib/services/plan-change-notice"
import { sendOwnerNotification, hondurasTime } from "@/lib/services/notify-owner"
import { isConfirmedAccount } from "@/lib/admin/confirmed-accounts"
import { selectAll } from "@/lib/admin/select-all"
import { adminAccountUrl } from "@/lib/admin/open-account"

/**
 * Cuentas con el correo confirmado (Supabase Auth) y, de las fundadoras, cuándo se les dio
 * el plan (app_metadata.founder_grant.at).
 */
async function confirmedAccounts(): Promise<{ ids: Set<string>; founders: Map<string, string> }> {
  const admin = getSupabaseAdminClient()
  const ids = new Set<string>()
  const founders = new Map<string, string>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) {
      if (!isConfirmedAccount(u)) continue
      ids.add(u.id)
      const at = ((u.app_metadata as Record<string, unknown> | undefined)?.founder_grant as { at?: string } | undefined)?.at
      if (at) founders.set(u.id, at)
    }
    if (data.users.length < 200) break
  }
  return { ids, founders }
}

/**
 * Recetas que cada fundadora con el período terminado creó dentro de sus 30 días (docs/289):
 * las que siguen (por `created_at`) y las que mandó a la papelera antes de que terminara.
 */
async function founderRecipeCounts(ended: [string, string][]): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (ended.length === 0) return counts
  const admin = getSupabaseAdminClient()
  const ids = ended.map(([id]) => id)
  const [recipes, trash] = await Promise.all([
    selectAll<{ owner_id: string; created_at: string }>((from, to) => admin.from("recipes").select("owner_id, created_at").in("owner_id", ids).range(from, to)),
    selectAll<{ owner_id: string; deleted_at: string }>((from, to) => admin.from("recipes_trash").select("owner_id, deleted_at").in("owner_id", ids).range(from, to)),
  ])
  if (recipes.error) throw recipes.error
  if (trash.error) throw trash.error
  for (const [id, at] of ended) {
    const end = founderPeriodEnd(at)
    counts.set(
      id,
      (recipes.data ?? []).filter((r) => r.owner_id === id && new Date(r.created_at).getTime() <= end).length +
        (trash.data ?? []).filter((r) => r.owner_id === id && new Date(r.deleted_at).getTime() <= end).length,
    )
  }
  return counts
}

/**
 * Fundadoras que liberaron su lugar (docs/289): terminaron sus 30 días con menos de
 * `minRecipesToKeepSeat` recetas creadas dentro del período.
 */
export async function releasedFounderIds(founders: Map<string, string>, now = Date.now()): Promise<Set<string>> {
  const ended = [...founders].filter(([, at]) => now >= founderPeriodEnd(at))
  const released = new Set<string>()
  const counts = await founderRecipeCounts(ended)
  for (const [id, at] of ended) {
    if (founderSeatReleased({ grantedAt: at, recipesInPeriod: counts.get(id) ?? 0, now })) released.add(id)
  }
  return released
}

/**
 * Revisión diaria de las fundadoras que terminaron sus 30 días (pedido del dueño, docs/296):
 * se anota en `app_metadata.founder_grant` si conservó su lugar o lo liberó (`seat`, `recipes`,
 * `reviewed_at`), una sola vez, y si lo liberó se avisa al dueño (correo y aparatos de /admin).
 * Va antes de `runPendingFounderGrants`, para que el lugar pase el mismo día a la siguiente cuenta.
 * La persona no recibe nada aparte: su plan vence a los 30 días igual que el de todas.
 */
export async function runFounderSeatReviews(now = Date.now()): Promise<{ reviewed: number; released: number }> {
  const admin = getSupabaseAdminClient()
  const pending: { id: string; email?: string; meta: Record<string, unknown>; grant: { at: string; ordinal?: number } }[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    for (const u of data.users) {
      const meta = (u.app_metadata || {}) as Record<string, unknown>
      const grant = meta.founder_grant as { at?: string; ordinal?: number; reviewed_at?: string } | undefined
      if (!grant?.at || grant.reviewed_at || now < founderPeriodEnd(grant.at)) continue
      pending.push({ id: u.id, email: u.email, meta, grant: { at: grant.at, ordinal: grant.ordinal } })
    }
    if (data.users.length < 200) break
  }
  if (pending.length === 0) return { reviewed: 0, released: 0 }

  const counts = await founderRecipeCounts(pending.map((p) => [p.id, p.grant.at]))
  let released = 0
  for (const founder of pending) {
    const recipes = counts.get(founder.id) ?? 0
    const isReleased = founderSeatReleased({ grantedAt: founder.grant.at, recipesInPeriod: recipes, now })
    const { error } = await admin.auth.admin.updateUserById(founder.id, {
      app_metadata: {
        ...founder.meta,
        founder_grant: {
          ...(founder.meta.founder_grant as Record<string, unknown>),
          seat: isReleased ? "released" : "kept",
          recipes,
          reviewed_at: new Date(now).toISOString(),
        },
      },
    })
    // Sin la marca no se avisa: mañana se vuelve a intentar, y nunca sale dos veces.
    if (error) {
      console.error("[founder-grant] No se pudo anotar la revisión de la fundadora:", error)
      continue
    }
    if (!isReleased) continue
    released++
    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", founder.id).maybeSingle()
    await sendOwnerNotification({
      subject: `Cocina fundadora #${founder.grant.ordinal ?? "?"} liberó su lugar (${recipes} de ${FOUNDER_PROGRAM.minRecipesToKeepSeat} recetas)`,
      rows: [
        ["Cuenta", founder.email],
        ["Nombre", profile?.full_name],
        ["Posición que tenía", founder.grant.ordinal ? `${founder.grant.ordinal} de ${FOUNDER_PROGRAM.maxAccounts}` : null],
        ["Recetas en sus 30 días", `${recipes} (mínimo ${FOUNDER_PROGRAM.minRecipesToKeepSeat})`],
        ["Período", `${hondurasTime(founder.grant.at)} → ${hondurasTime(new Date(founderPeriodEnd(founder.grant.at)).toISOString())}`],
      ],
      footnote: "Ya no cuenta entre las 100 cocinas fundadoras: su lugar pasa a la siguiente cuenta en la fila. Su plan vence igual que el de todas, al terminar los 30 días.",
      label: "fundadora liberó su lugar",
      url: adminAccountUrl({ userId: founder.id }),
    })
  }
  return { reviewed: pending.length, released }
}

export type FounderGrantResult = FounderDecision & { ordinal?: number; planSlug?: string }

async function accountOrdinal(createdAt: string, accountId: string, now: number): Promise<number | null> {
  const admin = getSupabaseAdminClient()
  // Cuentas eliminadas no cuentan (docs/165): las borradas desde /admin ya no tienen fila;
  // las que pidieron su eliminación (30 días de gracia) se excluyen aquí.
  // Y solo las confirmadas (docs/201), sin las fundadoras que liberaron su lugar (docs/289).
  try {
    const [{ ids: confirmed, founders }, { data, error }] = await Promise.all([
      confirmedAccounts(),
      selectAll<{ id: string }>((from, to) =>
        admin.from("profiles").select("id").lte("created_at", createdAt).is("deletion_requested_at", null).order("created_at").range(from, to),
      ),
    ])
    if (error) throw error
    founders.delete(accountId)
    const released = await releasedFounderIds(founders, now)
    return (data ?? []).filter((p) => confirmed.has(p.id) && !released.has(p.id)).length
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
  const ordinal = await accountOrdinal(createdAt, accountId, now)
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
    url: adminAccountUrl({ userId: accountId }),
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
