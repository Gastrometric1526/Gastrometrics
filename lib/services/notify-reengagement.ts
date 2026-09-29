/**
 * Recordatorios / re-enganche por correo (ver docs/131) — pedido del dueño del
 * proyecto: a quien tenga activada la casilla de recibir información de Gastrometrics
 * (profiles.product_updates_opt_in) y lleve días sin entrar, mandarle UN correo que lo
 * traiga de vuelta según lo último que estaba haciendo.
 *
 * 5 tipos, en este orden de prioridad (el primero que aplique gana):
 *
 *   1. unfinished_recipe — dejó una receta NUEVA a medias en Ficha Técnica (borrador de
 *      recipe_drafts, supabase/migrations/0032) hace entre 2 y 24 horas, y no ha vuelto.
 *      Es el único que no exige días de inactividad: el borrador vence a las 24 h.
 *   2. (el tipo que corresponda al ÚLTIMO módulo que usó — ver MODULE_TO_TYPE: si lo
 *      último fue Inventario, se prioriza el de inventario; si fue Estadísticas, el de
 *      reportes; si fue Ingredientes/Recetas, el de precios)
 *   3. inventory_count  — ya hizo al menos un conteo, y el último fue hace ≥ 7 días.
 *   4. review_reports   — registró ventas en los últimos 60 días, pero no abre
 *      Estadísticas hace ≥ 7 días.
 *   5. update_prices    — tiene ≥ 1 receta y ≥ 3 ingredientes cuyo precio
 *      (data.pricing.lastUpdated — NO la columna updated_at, que el upsert de
 *      lib/storage/ingredients.ts nunca actualiza) tiene más de 30 días.
 *   6. we_miss_you      — fallback: ≥ 14 días sin entrar.
 *
 * Límites anti-spam (todos a la vez):
 *   - Solo cuentas con product_updates_opt_in = true y sin eliminación pedida.
 *   - Todos menos unfinished_recipe exigen ≥ 3 días sin actividad.
 *   - Nada si lleva > 90 días inactiva (cuenta dormida — dejamos de insistir).
 *   - Máximo 1 recordatorio cada 4 días por cuenta (cualquier tipo).
 *   - El mismo tipo no se repite antes de 21 días (we_miss_you: 30).
 *   - Nada si en las últimas 48 h ya le llegó un correo de activación (0020) — para que
 *     nunca le lleguen dos correos automáticos el mismo día.
 *
 * "Actividad" = el más reciente entre user_presence.last_seen_at (heartbeat cada 60 s
 * mientras la app está abierta), last_sign_in_at de Auth, y la última fila de
 * activity_log de esa persona.
 *
 * Se llama desde app/api/cron/activation-emails/route.ts (Vercel Hobby tiene tope de 2
 * crons y ya están usados). Si la migración 0032 no se corrió, no hace nada.
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { getEmailLabels, normalizeEmailLang, fillLabel, type EmailLang } from "@/lib/i18n/email-labels"
import {
  REENGAGEMENT_COPY,
  REENGAGEMENT_SHARED,
  type ReengagementType,
} from "@/lib/i18n/reengagement-email-labels"
import { REENGAGEMENT_VARIANTS } from "@/lib/i18n/reengagement-email-variants"
import { buildUnsubscribeUrl } from "@/lib/email-unsubscribe"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const REENGAGEMENT_RULES = {
  draftMinAgeHours: 2,
  draftMaxAgeHours: 24,
  minInactiveDays: 3,
  maxInactiveDays: 90,
  globalCooldownDays: 4,
  typeCooldownDays: 21,
  weMissYouCooldownDays: 30,
  activationGapHours: 48,
  inventoryStaleDays: 7,
  reportsStaleDays: 7,
  salesLookbackDays: 60,
  priceStaleDays: 30,
  minStaleIngredients: 3,
  weMissYouDays: 14,
}

// Color de acento por tipo (franja superior, etiqueta y bloque de dato) — lo único que
// cambia visualmente entre las 5 variantes, el resto es la plantilla de marca de siempre.
const ACCENT: Record<ReengagementType, string> = {
  unfinished_recipe: "#F05324",
  inventory_count: "#2F7D5B",
  review_reports: "#2B6CB0",
  update_prices: "#B7791F",
  we_miss_you: "#9F3A8A",
}

const MODULE_TO_TYPE: Record<string, ReengagementType> = {
  inventario: "inventory_count",
  estadisticas: "review_reports",
  ingredientes: "update_prices",
  recetas: "update_prices",
  ficha_tecnica: "update_prices",
  merma: "inventory_count",
}

const BASE_PRIORITY: ReengagementType[] = ["inventory_count", "review_reports", "update_prices", "we_miss_you"]

// ─── Variantes de texto (docs/139) ───

/** Cuántas versiones de texto hay por tipo e idioma (la 0 es REENGAGEMENT_COPY). */
export function reengagementVariantCount(type: ReengagementType, language?: string | null): number {
  return 1 + REENGAGEMENT_VARIANTS[normalizeEmailLang(language)][type].length
}

function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

/**
 * Qué variante le toca a una cuenta: arranca en un punto fijo por cuenta+tipo (para que no
 * todos reciban el mismo texto el mismo día) y avanza una con cada envío anterior del mismo
 * tipo — así nadie recibe dos veces el mismo texto hasta haber visto las tres versiones.
 */
export function pickReengagementVariant(accountId: string, type: ReengagementType, previousSends: number, total = 3): number {
  return (hashString(`${accountId}:${type}`) + previousSends) % total
}

// ─── Render (puro — también lo usa la vista previa de /api/admin/reengagement-preview) ───

export interface ReengagementVars {
  name?: string | null
  recipe?: string
  days?: number
  count?: number
}

function statBlockHtml(accent: string, label: string, value: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr><td style="border-left:4px solid ${accent};background:#FBF9F7;border-radius:0 10px 10px 0;padding:14px 18px;font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"><div style="font-size:12px;line-height:1.4;color:#8A7D74;text-transform:uppercase;letter-spacing:0.06em;font-weight:700">${label}</div><div style="font-size:20px;line-height:1.3;color:#1A1512;font-weight:800;margin-top:4px">${value}</div></td></tr></table>`
}

export function renderReengagementEmail(input: {
  type: ReengagementType
  language: string | null | undefined
  vars: ReengagementVars
  actionUrl: string
  unsubscribeUrl: string
  /** 0 = texto base; 1 y 2 = REENGAGEMENT_VARIANTS. Fuera de rango vuelve al base. */
  variant?: number
}): { subject: string; html: string; lang: EmailLang } {
  const lang = normalizeEmailLang(input.language)
  const base = REENGAGEMENT_COPY[lang][input.type]
  const alt = input.variant ? REENGAGEMENT_VARIANTS[lang][input.type][input.variant - 1] : undefined
  const copy = alt ? { ...base, ...alt } : base
  const shared = REENGAGEMENT_SHARED[lang]
  const baseLabels = getEmailLabels(lang)

  // Todo lo que viene del usuario se escapa antes de entrar a una plantilla.
  const safeName = input.vars.name ? escapeHtml(input.vars.name) : ""
  const safeRecipe = escapeHtml(input.vars.recipe || "")
  const fill = {
    name: safeName,
    recipe: safeRecipe,
    days: String(input.vars.days ?? ""),
    count: String(input.vars.count ?? ""),
  }
  // El asunto va como texto plano (no HTML), así que usa el nombre de receta sin escapar.
  const subject = fillLabel(copy.subject, { ...fill, recipe: input.vars.recipe || "" })

  const accent = ACCENT[input.type]
  const statValue = fillLabel(copy.statValue, fill)
  const showStat = !(input.type === "we_miss_you" && !input.vars.count)
  const html = renderEmailTemplate("12-recordatorio.html", {
    htmlLang: lang,
    title: escapeHtml(subject),
    preheader: fillLabel(copy.preheader, fill),
    accent,
    eyebrow: copy.eyebrow,
    heading: fillLabel(copy.heading, fill),
    greeting: safeName ? fillLabel(shared.hello, fill) : shared.helloNoName,
    body: fillLabel(copy.body, fill),
    statBlock: showStat ? statBlockHtml(accent, copy.statLabel, statValue) : "",
    cta: copy.cta,
    actionUrl: input.actionUrl,
    footnote: shared.footnote,
    footerAddress: baseLabels.footer_address,
    footer2: shared.footer2,
    unsubscribeUrl: input.unsubscribeUrl,
    unsubscribeLabel: shared.unsubscribe,
  })
  return { subject, html, lang }
}

// ─── Selección (pura — cubierta por notify-reengagement.test.ts) ───

export interface AccountFacts {
  now: number
  lastActiveAt: number | null
  lastModule: string | null
  draft: { recipeName: string; updatedAt: number; businessKey: string } | null
  lastInventoryAt: number | null
  lastInventoryBusinessId: string | null
  hasRecentSales: boolean
  firstRecentSaleAt: number | null
  lastReportsVisitAt: number | null
  recipeCount: number
  staleIngredientCount: number
  sentHistory: { type: ReengagementType; sentAt: number }[]
  lastActivationEmailAt: number | null
}

export interface ReengagementDecision {
  type: ReengagementType
  vars: ReengagementVars
  actionPath: string
}

function daysBetween(from: number, to: number): number {
  return Math.floor((to - from) / DAY_MS)
}

function withBusiness(path: string, businessId: string | null | undefined): string {
  return businessId && businessId !== "main" ? `${path}?business=${encodeURIComponent(businessId)}` : path
}

export function chooseReengagement(f: AccountFacts, r = REENGAGEMENT_RULES): ReengagementDecision | null {
  const { now } = f
  const inactiveDays = f.lastActiveAt ? daysBetween(f.lastActiveAt, now) : Infinity

  if (inactiveDays > r.maxInactiveDays) return null

  const lastSentAny = f.sentHistory.reduce((max, s) => Math.max(max, s.sentAt), 0)
  if (lastSentAny && now - lastSentAny < r.globalCooldownDays * DAY_MS) return null
  if (f.lastActivationEmailAt && now - f.lastActivationEmailAt < r.activationGapHours * HOUR_MS) return null

  const typeOnCooldown = (type: ReengagementType) => {
    const cooldown = (type === "we_miss_you" ? r.weMissYouCooldownDays : r.typeCooldownDays) * DAY_MS
    return f.sentHistory.some((s) => s.type === type && now - s.sentAt < cooldown)
  }

  // 1. Receta sin terminar — el borrador vence a las 24 h, así que no espera días.
  if (f.draft && !typeOnCooldown("unfinished_recipe")) {
    const draftAge = now - f.draft.updatedAt
    const notBackSinceHours = f.lastActiveAt ? (now - f.lastActiveAt) / HOUR_MS : Infinity
    if (
      draftAge >= r.draftMinAgeHours * HOUR_MS &&
      draftAge < r.draftMaxAgeHours * HOUR_MS &&
      notBackSinceHours >= r.draftMinAgeHours &&
      f.draft.recipeName.trim() !== ""
    ) {
      return {
        type: "unfinished_recipe",
        vars: { recipe: f.draft.recipeName.trim() },
        actionPath: withBusiness("/ficha-tecnica", f.draft.businessKey),
      }
    }
  }

  if (inactiveDays < r.minInactiveDays) return null

  const candidates: Record<Exclude<ReengagementType, "unfinished_recipe">, () => ReengagementDecision | null> = {
    inventory_count: () => {
      if (!f.lastInventoryAt) return null
      const days = daysBetween(f.lastInventoryAt, now)
      if (days < r.inventoryStaleDays) return null
      return { type: "inventory_count", vars: { days }, actionPath: withBusiness("/inventario", f.lastInventoryBusinessId) }
    },
    review_reports: () => {
      if (!f.hasRecentSales) return null
      const since = f.lastReportsVisitAt ?? f.firstRecentSaleAt
      if (!since) return null
      const days = daysBetween(since, now)
      if (days < r.reportsStaleDays) return null
      return { type: "review_reports", vars: { days }, actionPath: "/estadisticas" }
    },
    update_prices: () => {
      if (f.recipeCount < 1 || f.staleIngredientCount < r.minStaleIngredients) return null
      return { type: "update_prices", vars: { count: f.staleIngredientCount }, actionPath: "/ingredientes" }
    },
    we_miss_you: () => {
      if (inactiveDays < r.weMissYouDays || !Number.isFinite(inactiveDays)) return null
      return { type: "we_miss_you", vars: { days: inactiveDays, count: f.recipeCount }, actionPath: "/dashboard" }
    },
  }

  const preferred = f.lastModule ? MODULE_TO_TYPE[f.lastModule] : undefined
  const order = preferred ? [preferred, ...BASE_PRIORITY.filter((t) => t !== preferred)] : BASE_PRIORITY
  for (const type of order) {
    if (type === "unfinished_recipe" || typeOnCooldown(type)) continue
    const decision = candidates[type]()
    if (decision) return decision
  }
  return null
}

/**
 * Motivo por el que una cuenta NO recibe recordatorio hoy (solo para el modo de prueba —
 * docs/137): hace verificable el cron sin mandar nada. Sigue el mismo orden que
 * chooseReengagement.
 */
export type ReengagementSkipReason =
  | "sin_actividad_registrada"
  | "inactiva_demasiado_tiempo"
  | "pausa_por_recordatorio_reciente"
  | "pausa_por_correo_de_activacion"
  | "activa_hace_poco"
  | "ninguna_regla_aplica"

export function explainSkip(f: AccountFacts, r = REENGAGEMENT_RULES): ReengagementSkipReason {
  if (!f.lastActiveAt) return "sin_actividad_registrada"
  const inactiveDays = daysBetween(f.lastActiveAt, f.now)
  if (inactiveDays > r.maxInactiveDays) return "inactiva_demasiado_tiempo"
  const lastSentAny = f.sentHistory.reduce((max, s) => Math.max(max, s.sentAt), 0)
  if (lastSentAny && f.now - lastSentAny < r.globalCooldownDays * DAY_MS) return "pausa_por_recordatorio_reciente"
  if (f.lastActivationEmailAt && f.now - f.lastActivationEmailAt < r.activationGapHours * HOUR_MS)
    return "pausa_por_correo_de_activacion"
  if (inactiveDays < r.minInactiveDays) return "activa_hace_poco"
  return "ninguna_regla_aplica"
}

// ─── Recolección de datos + envío (cron) ───

type AdminClient = ReturnType<typeof getSupabaseAdminClient>

// Tipado como `string` (no literal) a propósito: el parser de tipos de supabase-js no
// soporta rutas JSON con alias y entra en recursión infinita (TS2589) con el literal.
const INGREDIENT_PRICE_SELECT: string = "owner_id, price_updated:data->pricing->>lastUpdated, recipe_id:data->>recipeId"

const PAGE_SIZE = 1000
const ID_CHUNK = 100

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// Supabase corta cada select en 1000 filas por defecto — pagina hasta traer todo, en
// grupos de ids para no armar URLs gigantes con .in(...).
async function fetchAllByIds<T>(
  ids: string[],
  build: (idChunk: string[], from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (const idChunk of chunk(ids, ID_CHUNK)) {
    let from = 0
    while (true) {
      const { data, error } = await build(idChunk, from, from + PAGE_SIZE - 1)
      if (error) throw error
      const page = (data ?? []) as T[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }
  return rows
}

function maxTime(...values: (string | null | undefined | number)[]): number | null {
  let best: number | null = null
  for (const v of values) {
    if (v === null || v === undefined) continue
    const t = typeof v === "number" ? v : new Date(v).getTime()
    if (!Number.isNaN(t) && (best === null || t > best)) best = t
  }
  return best
}

function isMissingTableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === "42P01" || code === "PGRST205"
}

interface CandidateAccount {
  id: string
  email: string
  name: string
  language: string
  lastSignInAt: string | null
}

async function loadOptedInAccounts(admin: AdminClient): Promise<CandidateAccount[]> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, preferred_language, deletion_requested_at")
    .eq("product_updates_opt_in", true)
  if (error) throw error
  const eligible = new Map(
    (profiles ?? []).filter((p) => !p.deletion_requested_at).map((p) => [p.id, p] as const),
  )
  if (eligible.size === 0) return []

  const accounts: CandidateAccount[] = []
  let page = 1
  while (true) {
    const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (listError) throw listError
    for (const u of data.users) {
      const profile = eligible.get(u.id)
      if (!profile || !u.email) continue
      accounts.push({
        id: u.id,
        email: u.email,
        name: (profile.full_name || "").trim().split(/\s+/)[0] || "",
        language: profile.preferred_language || "es",
        lastSignInAt: u.last_sign_in_at ?? null,
      })
    }
    if (data.users.length < 200) break
    page += 1
  }
  return accounts
}

export interface ReengagementRunResult {
  skipped?: string
  candidates: number
  sent: number
  byType: Partial<Record<ReengagementType, number>>
  decisions?: { accountId: string; type: ReengagementType; actionPath: string; variant: number }[]
  // Solo en modo de prueba: cuántas cuentas se descartaron por cada motivo.
  skipReasons?: Partial<Record<ReengagementSkipReason, number>>
}

export async function runReengagementReminders(options: { dryRun?: boolean } = {}): Promise<ReengagementRunResult> {
  const result: ReengagementRunResult = { candidates: 0, sent: 0, byType: {} }
  if (!options.dryRun && !process.env.RESEND_API_KEY) return { ...result, skipped: "RESEND_API_KEY no configurada" }

  const admin = getSupabaseAdminClient()
  const now = Date.now()
  const R = REENGAGEMENT_RULES

  // Si 0032 no se corrió todavía, no hay dónde registrar los envíos — no se manda nada.
  const probe = await admin.from("reengagement_emails_sent").select("id").limit(1)
  if (probe.error) {
    if (isMissingTableError(probe.error)) return { ...result, skipped: "migración 0032 no corrida" }
    throw probe.error
  }

  // Limpieza: borradores con más de 48 h ya no sirven (el cliente los ignora a las 24 h).
  await admin.from("recipe_drafts").delete().lt("updated_at", new Date(now - 48 * HOUR_MS).toISOString())

  const accounts = await loadOptedInAccounts(admin)
  result.candidates = accounts.length
  if (accounts.length === 0) return result
  const ids = accounts.map((a) => a.id)

  const since = (days: number) => new Date(now - days * DAY_MS).toISOString()

  const [presence, activity, sentRows, activationRows, drafts, snapshots, sales, recipes, ingredients] = await Promise.all([
    fetchAllByIds<{ user_id: string; last_seen_at: string }>(ids, (c, a, b) =>
      admin.from("user_presence").select("user_id, last_seen_at").in("user_id", c).range(a, b),
    ),
    fetchAllByIds<{ user_id: string; module: string; action: string; created_at: string }>(ids, (c, a, b) =>
      admin
        .from("activity_log")
        .select("user_id, module, action, created_at")
        .in("user_id", c)
        .gte("created_at", since(R.maxInactiveDays + 30))
        .order("created_at", { ascending: false })
        .range(a, b),
    ),
    fetchAllByIds<{ account_id: string; email_type: ReengagementType; sent_at: string }>(ids, (c, a, b) =>
      admin
        .from("reengagement_emails_sent")
        .select("account_id, email_type, sent_at")
        .in("account_id", c)
        .range(a, b),
    ),
    fetchAllByIds<{ account_id: string; sent_at: string }>(ids, (c, a, b) =>
      admin
        .from("activation_emails_sent")
        .select("account_id, sent_at")
        .in("account_id", c)
        .gte("sent_at", new Date(now - R.activationGapHours * HOUR_MS).toISOString())
        .range(a, b),
    ),
    fetchAllByIds<{ user_id: string; business_key: string; recipe_name: string; updated_at: string }>(ids, (c, a, b) =>
      admin
        .from("recipe_drafts")
        .select("user_id, business_key, recipe_name, updated_at")
        .in("user_id", c)
        .gte("updated_at", new Date(now - R.draftMaxAgeHours * HOUR_MS).toISOString())
        .range(a, b),
    ),
    fetchAllByIds<{ owner_id: string; business_id: string | null; date: string }>(ids, (c, a, b) =>
      admin.from("inventory_snapshots").select("owner_id, business_id, date").in("owner_id", c).range(a, b),
    ),
    fetchAllByIds<{ owner_id: string; created_at: string }>(ids, (c, a, b) =>
      admin
        .from("sales_imports")
        .select("owner_id, created_at")
        .in("owner_id", c)
        .gte("created_at", since(R.salesLookbackDays))
        .range(a, b),
    ),
    fetchAllByIds<{ owner_id: string }>(ids, (c, a, b) =>
      admin.from("recipes").select("owner_id").in("owner_id", c).range(a, b),
    ),
    fetchAllByIds<{ owner_id: string; price_updated: string | null; recipe_id: string | null }>(ids, (c, a, b) =>
      admin
        .from("ingredients")
        .select(INGREDIENT_PRICE_SELECT)
        .in("owner_id", c)
        .range(a, b),
    ),
  ])

  const group = <T, K extends keyof T>(rows: T[], key: K) => {
    const map = new Map<string, T[]>()
    for (const row of rows) {
      const k = row[key] as unknown as string
      const list = map.get(k)
      if (list) list.push(row)
      else map.set(k, [row])
    }
    return map
  }

  const presenceBy = new Map(presence.map((p) => [p.user_id, p.last_seen_at]))
  const activityBy = group(activity, "user_id")
  const sentBy = group(sentRows, "account_id")
  const activationBy = group(activationRows, "account_id")
  const draftBy = group(drafts, "user_id")
  const snapshotsBy = group(snapshots, "owner_id")
  const salesBy = group(sales, "owner_id")
  const recipesBy = group(recipes, "owner_id")
  const ingredientsBy = group(ingredients, "owner_id")

  const resend = options.dryRun ? null : new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const decisions: NonNullable<ReengagementRunResult["decisions"]> = []

  for (const account of accounts) {
    const acts = activityBy.get(account.id) ?? [] // ya vienen ordenadas, más reciente primero
    const lastMeaningful = acts.find((a) => a.module !== "dashboard" && a.module !== "negocios") ?? acts[0]
    const draft = (draftBy.get(account.id) ?? []).sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    const snaps = (snapshotsBy.get(account.id) ?? []).sort((a, b) => b.date.localeCompare(a.date))
    const saleImports = salesBy.get(account.id) ?? []
    const saleActs = acts.filter((a) => a.module === "estadisticas" && a.action === "imported")
    const recentSaleTimes = [
      ...saleImports.map((s) => new Date(s.created_at).getTime()),
      ...saleActs.map((s) => new Date(s.created_at).getTime()).filter((t) => now - t < R.salesLookbackDays * DAY_MS),
    ]
    const reportsVisit = acts.find((a) => a.module === "estadisticas" && a.action === "entered")
    const staleIngredients = (ingredientsBy.get(account.id) ?? []).filter((i) => {
      if (i.recipe_id) return false // sub-receta: su precio se calcula solo
      const t = i.price_updated ? new Date(i.price_updated).getTime() : NaN
      return !Number.isNaN(t) && now - t > R.priceStaleDays * DAY_MS
    }).length

    const facts: AccountFacts = {
      now,
      lastActiveAt: maxTime(presenceBy.get(account.id), account.lastSignInAt, acts[0]?.created_at),
      lastModule: lastMeaningful?.module ?? null,
      draft: draft
        ? { recipeName: draft.recipe_name, updatedAt: new Date(draft.updated_at).getTime(), businessKey: draft.business_key }
        : null,
      lastInventoryAt: snaps[0] ? new Date(snaps[0].date).getTime() : null,
      lastInventoryBusinessId: snaps[0]?.business_id ?? null,
      hasRecentSales: recentSaleTimes.length > 0,
      firstRecentSaleAt: recentSaleTimes.length > 0 ? Math.min(...recentSaleTimes) : null,
      lastReportsVisitAt: reportsVisit ? new Date(reportsVisit.created_at).getTime() : null,
      recipeCount: (recipesBy.get(account.id) ?? []).length,
      staleIngredientCount: staleIngredients,
      sentHistory: (sentBy.get(account.id) ?? [])
        .map((s) => ({ type: s.email_type, sentAt: new Date(s.sent_at).getTime() }))
        .filter((s) => now - s.sentAt < R.weMissYouCooldownDays * DAY_MS),
      lastActivationEmailAt: maxTime(...(activationBy.get(account.id) ?? []).map((a) => a.sent_at)),
    }

    const decision = chooseReengagement(facts)
    if (!decision) {
      if (options.dryRun) {
        const reason = explainSkip(facts)
        result.skipReasons = { ...result.skipReasons, [reason]: (result.skipReasons?.[reason] ?? 0) + 1 }
      }
      continue
    }
    const previousSends = (sentBy.get(account.id) ?? []).filter((s) => s.email_type === decision.type).length
    const variant = pickReengagementVariant(
      account.id,
      decision.type,
      previousSends,
      reengagementVariantCount(decision.type, account.language),
    )
    decisions.push({ accountId: account.id, type: decision.type, actionPath: decision.actionPath, variant })
    if (options.dryRun || !resend) continue

    // Reserva primero (evita duplicados si el cron corre dos veces); si el envío falla,
    // se borra la reserva para que mañana se pueda reintentar.
    const { data: claimed, error: claimError } = await admin
      .from("reengagement_emails_sent")
      .insert({ account_id: account.id, email_type: decision.type })
      .select("id")
      .single()
    if (claimError || !claimed) {
      console.error("[notify-reengagement] Error reservando envío:", claimError)
      continue
    }

    const unsubscribeUrl = buildUnsubscribeUrl(account.id)
    const { subject, html } = renderReengagementEmail({
      type: decision.type,
      language: account.language,
      vars: { ...decision.vars, name: account.name },
      actionUrl: `${siteUrl}${decision.actionPath}`,
      unsubscribeUrl,
      variant,
    })
    const { error: sendError } = await resend.emails.send({
      from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
      to: [account.email],
      subject,
      html,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    })
    if (sendError) {
      console.error(`[notify-reengagement] Error mandando correo (${decision.type}):`, sendError)
      await admin.from("reengagement_emails_sent").delete().eq("id", claimed.id)
      continue
    }
    result.sent++
    result.byType[decision.type] = (result.byType[decision.type] ?? 0) + 1
  }

  if (options.dryRun) {
    result.decisions = decisions
    for (const d of decisions) result.byType[d.type] = (result.byType[d.type] ?? 0) + 1
  }
  return result
}
