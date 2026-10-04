/**
 * Correos de valor (docs/144) — a diferencia de los recordatorios de docs/131 ("hace
 * días que no entras"), cada uno trae un dato real de la cuenta:
 *
 * | Tipo            | Cuándo                                                        | Pausa propia        |
 * |-----------------|---------------------------------------------------------------|---------------------|
 * | low_stock       | algún producto del inventario en su mínimo o por debajo       | 3 días              |
 * | weekly_summary  | lunes (hora de Honduras), si la cuenta tiene recetas          | 6 días              |
 * | margin_alert    | platos cuyo food cost real supera su meta por > 5 puntos, o   | 14 días             |
 * |                 | que cuestan más de lo que se venden                           |                     |
 * | milestone       | 10/25/50/100 recetas, primer menú, primer conteo (≤ 30 días)  | una vez cada logro  |
 * | invite_pending  | invitación a su equipo sin aceptar hace 3–30 días             | una vez por persona |
 * | empty_business  | negocio creado hace 5–60 días sin ninguna receta              | una vez por negocio |
 * | unused_feature  | plan pago, cuenta de > 14 días, función del plan nunca abierta| 45 días por función |
 *
 * Reglas comunes (mismas que los recordatorios): solo cuentas con «Novedades y
 * recordatorios» activo, enlace de baja en cada correo, 3 versiones de texto que rotan
 * y en el idioma de la cuenta. Como mucho UN correo por cuenta por corrida y nunca dos en
 * menos de 20 h. Stock bajo y resumen semanal (útiles y esperados) pueden salir aunque
 * haya habido otro correo hace menos de 4 días; el resto respeta esa pausa global, que
 * comparten con los recordatorios de docs/131. Prioridad: el primero de la tabla que
 * aplique.
 *
 * Necesita supabase/migrations/0033_engagement_emails.sql; si no está, no manda nada.
 */

import { Resend } from "resend"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendWithRetry } from "./send-email"
import { renderEmailTemplate, escapeHtml } from "./email-templates"
import { getEmailLabels, normalizeEmailLang, fillLabel, type EmailLang } from "@/lib/i18n/email-labels"
import { REENGAGEMENT_SHARED } from "@/lib/i18n/reengagement-email-labels"
import { ENGAGEMENT_COPY, ENGAGEMENT_SHARED, type EngagementType } from "@/lib/i18n/engagement-email-copy"
import { buildUnsubscribeUrl } from "@/lib/email-unsubscribe"
import { getPlanBySlug } from "@/lib/plans"
import { CURRENCY_OPTIONS } from "@/lib/currency"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { fetchAllByIds, isMissingTableError, loadOptedInAccounts, maxTime } from "./notify-reengagement"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const ENGAGEMENT_RULES = {
  dailyCapHours: 20,
  globalCooldownDays: 4,
  maxInactiveDays: 120,
  lowStockCooldownDays: 3,
  weeklyCooldownDays: 6,
  marginCooldownDays: 14,
  marginTolerancePoints: 5,
  milestoneRecentDays: 30,
  invitePendingMinDays: 3,
  invitePendingMaxDays: 30,
  emptyBusinessMinDays: 5,
  emptyBusinessMaxDays: 60,
  unusedFeatureMinAgeDays: 14,
  unusedFeatureCooldownDays: 45,
  maxListItems: 6,
}

const ACCENT: Record<EngagementType, string> = {
  weekly_summary: "#1F6B45",
  low_stock: "#B3341A",
  margin_alert: "#B7791F",
  unused_feature: "#2B6CB0",
  milestone: "#F05324",
  invite_pending: "#6B46C1",
  empty_business: "#2F7D5B",
}

// Funciones del plan que se pueden "no usar" y el módulo de activity_log que prueba que
// se abrieron. Finanzas no está: comparte módulo con el Panorama y daría falsos avisos.
const FEATURE_MODULES = [
  { key: "inventory", module: "inventario", path: "/inventario" },
  { key: "menus", module: "menus", path: "/menus" },
  { key: "purchase_orders_manual", module: "ordenes_compra", path: "/ordenes-compra" },
  { key: "team", module: "equipo", path: "/equipo" },
] as const

type FeatureKey = (typeof FEATURE_MODULES)[number]["key"]

const FEATURE_NAMES: Record<EmailLang, Record<FeatureKey, string>> = {
  es: { inventory: "Inventario", menus: "Menús", purchase_orders_manual: "Órdenes de compra", team: "Equipo" },
  en: { inventory: "Inventory", menus: "Menus", purchase_orders_manual: "Purchase orders", team: "Team" },
  da: { inventory: "Lager", menus: "Menuer", purchase_orders_manual: "Indkøbsordrer", team: "Team" },
  fr: { inventory: "Inventaire", menus: "Menus", purchase_orders_manual: "Bons de commande", team: "Équipe" },
  pt: { inventory: "Estoque", menus: "Cardápios", purchase_orders_manual: "Pedidos de compra", team: "Equipe" },
  zh: { inventory: "库存", menus: "菜单", purchase_orders_manual: "采购单", team: "团队" },
}

type MilestoneKey = keyof (typeof ENGAGEMENT_SHARED)["es"]["milestones"]
const RECIPE_MILESTONES: [number, MilestoneKey][] = [
  [100, "recipes_100"],
  [50, "recipes_50"],
  [25, "recipes_25"],
  [10, "recipes_10"],
]

// ─── Datos de una cuenta (lo que el cron carga) y decisión pura ───

export interface MarginIssue {
  name: string
  actualPct: number
  targetPct: number
  belowCost: boolean
}

export interface EngagementFacts {
  now: number
  accountCreatedAt: number
  lastActiveAt: number | null
  isMonday: boolean
  planSlug: string
  recipeCount: number
  recipeCreatedTimes: number[] // recetas propias (no sub-recetas), en orden
  avgFoodCostPct: number | null
  marginIssues: MarginIssue[]
  lowStock: { name: string; current: number; min: number; unit: string }[]
  inventoryValue: number
  currencySymbol: string
  firstMenuAt: number | null
  firstCountAt: number | null
  usedModules: Set<string>
  pendingInvites: { id: string; label: string; invitedAt: number }[]
  emptyBusinesses: { id: string; name: string; createdAt: number }[]
  history: { type: EngagementType; ref: string; sentAt: number }[]
  otherSentTimes: number[] // recordatorios y activación recientes
}

export interface EngagementDecision {
  type: EngagementType
  ref: string
  markRefs?: string[] // logros alcanzados antes, para no avisarlos después
  vars: Record<string, string>
  items?: string[] // líneas de lista (HTML ya escapado)
  weekly?: { recipes: string; foodCost: string; inventory: string; lowStock: string; margin: string }
  actionPath: string
}

const daysAgo = (now: number, t: number) => (now - t) / DAY_MS

export function chooseEngagement(f: EngagementFacts, language: EmailLang, r = ENGAGEMENT_RULES): EngagementDecision | null {
  const { now } = f
  const allSent = [...f.history.map((h) => h.sentAt), ...f.otherSentTimes]
  const lastAny = allSent.length ? Math.max(...allSent) : 0
  if (lastAny && now - lastAny < r.dailyCapHours * HOUR_MS) return null
  if (f.lastActiveAt && daysAgo(now, f.lastActiveAt) > r.maxInactiveDays) return null
  const globalOk = !lastAny || now - lastAny >= r.globalCooldownDays * DAY_MS
  const lastOf = (type: EngagementType, ref?: string) =>
    Math.max(0, ...f.history.filter((h) => h.type === type && (ref === undefined || h.ref === ref)).map((h) => h.sentAt))
  const cooled = (type: EngagementType, days: number, ref?: string) => {
    const last = lastOf(type, ref)
    return !last || now - last >= days * DAY_MS
  }
  const sentRef = (type: EngagementType, ref: string) => f.history.some((h) => h.type === type && h.ref === ref)
  const shared = ENGAGEMENT_SHARED[language]
  const more = (n: number) => (n > 0 ? [escapeHtml(fillLabel(shared.andMore, { n: String(n) }))] : [])
  const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, ""))

  // 1. Stock bajo
  if (f.lowStock.length > 0 && cooled("low_stock", r.lowStockCooldownDays)) {
    const shown = f.lowStock.slice(0, r.maxListItems)
    return {
      type: "low_stock",
      ref: "low",
      vars: { count: String(f.lowStock.length) },
      items: [
        ...shown.map((i) =>
          // La unidad se guarda como clave en español ("unidad", "gramos"): va traducida.
          fillLabel(shared.lowStockItem, { name: escapeHtml(i.name), current: num(i.current), min: num(i.min), unit: escapeHtml(getUnitLabel(i.unit, language)) }),
        ),
        ...more(f.lowStock.length - shown.length),
      ],
      actionPath: "/inventario",
    }
  }

  // 2. Resumen semanal (lunes)
  if (f.isMonday && f.recipeCount > 0 && cooled("weekly_summary", r.weeklyCooldownDays)) {
    return {
      type: "weekly_summary",
      ref: new Date(now).toISOString().slice(0, 10),
      vars: {},
      weekly: {
        recipes: String(f.recipeCount),
        foodCost: f.avgFoodCostPct === null ? "—" : `${f.avgFoodCostPct.toFixed(1)} %`,
        inventory: `${f.currencySymbol} ${f.inventoryValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        lowStock: String(f.lowStock.length),
        margin: String(f.marginIssues.length),
      },
      actionPath: "/estadisticas",
    }
  }

  if (!globalOk) return null

  // 3. Platos que pierden margen
  if (f.marginIssues.length > 0 && cooled("margin_alert", r.marginCooldownDays)) {
    const sorted = [...f.marginIssues].sort((a, b) => Number(b.belowCost) - Number(a.belowCost) || b.actualPct - b.targetPct - (a.actualPct - a.targetPct))
    const shown = sorted.slice(0, r.maxListItems)
    return {
      type: "margin_alert",
      ref: "margin",
      vars: { count: String(f.marginIssues.length) },
      items: [
        ...shown.map((m) =>
          m.belowCost
            ? fillLabel(shared.belowCostItem, { name: escapeHtml(m.name) })
            : fillLabel(shared.marginItem, { name: escapeHtml(m.name), actual: m.actualPct.toFixed(1), target: m.targetPct.toFixed(1) }),
        ),
        ...more(f.marginIssues.length - shown.length),
      ],
      actionPath: "/mis-recetas",
    }
  }

  // 4. Logros recientes
  const recent = (t: number | null | undefined) => t != null && daysAgo(now, t) <= r.milestoneRecentDays
  const reached: MilestoneKey[] = []
  for (const [n, key] of RECIPE_MILESTONES) {
    if (f.recipeCreatedTimes.length >= n) reached.push(key)
  }
  if (f.firstMenuAt) reached.push("first_menu")
  if (f.firstCountAt) reached.push("first_count")
  const fresh = reached.filter((key) => {
    if (sentRef("milestone", key)) return false
    const n = RECIPE_MILESTONES.find(([, k]) => k === key)?.[0]
    if (n) return recent(f.recipeCreatedTimes[n - 1])
    return recent(key === "first_menu" ? f.firstMenuAt : f.firstCountAt)
  })
  if (fresh.length > 0) {
    const key = fresh[0] // el mayor de recetas primero (RECIPE_MILESTONES va de mayor a menor)
    return {
      type: "milestone",
      ref: key,
      markRefs: reached.filter((k) => k !== key && !sentRef("milestone", k)),
      vars: { milestone: shared.milestones[key] },
      actionPath: "/dashboard",
    }
  }

  // 5. Invitación sin aceptar
  const invite = f.pendingInvites.find((i) => {
    const d = daysAgo(now, i.invitedAt)
    return d >= r.invitePendingMinDays && d <= r.invitePendingMaxDays && !sentRef("invite_pending", i.id)
  })
  if (invite) {
    return {
      type: "invite_pending",
      ref: invite.id,
      vars: { invitee: escapeHtml(invite.label), days: String(Math.floor(daysAgo(now, invite.invitedAt))) },
      actionPath: "/equipo",
    }
  }

  // 6. Negocio vacío
  const empty = f.emptyBusinesses.find((b) => {
    const d = daysAgo(now, b.createdAt)
    return d >= r.emptyBusinessMinDays && d <= r.emptyBusinessMaxDays && !sentRef("empty_business", b.id)
  })
  if (empty) {
    return {
      type: "empty_business",
      ref: empty.id,
      vars: { business: escapeHtml(empty.name), days: String(Math.floor(daysAgo(now, empty.createdAt))) },
      actionPath: `/business/${encodeURIComponent(empty.id)}`,
    }
  }

  // 7. Función del plan sin usar
  const plan = getPlanBySlug(f.planSlug)
  if (plan.slug !== "foodie" && daysAgo(now, f.accountCreatedAt) >= r.unusedFeatureMinAgeDays) {
    const feature = FEATURE_MODULES.find(
      (fm) =>
        (plan.unlockedFeatures as string[]).includes(fm.key) &&
        !f.usedModules.has(fm.module) &&
        cooled("unused_feature", r.unusedFeatureCooldownDays, fm.key),
    )
    if (feature) {
      return {
        type: "unused_feature",
        ref: feature.key,
        vars: { feature: FEATURE_NAMES[language][feature.key], plan: plan.name },
        actionPath: feature.path,
      }
    }
  }
  return null
}

// ─── Variante y render (puros — también los usa la vista previa de /admin) ───

function hashString(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return h
}

/** Rota con cada envío del mismo tipo y arranca en un punto distinto por cuenta. */
export function pickEngagementVariant(accountId: string, type: EngagementType, previousSends: number): number {
  return (hashString(`${accountId}:${type}`) + previousSends) % 3
}

function listHtml(accent: string, items: string[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14.5px;line-height:1.5;color:#3A332E;padding:8px 14px;border-bottom:1px solid #EFE8E1">${item}</td></tr>`,
    )
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-left:4px solid ${accent};background:#FBF9F7;border-radius:0 10px 10px 0">${rows}</table>`
}

function weeklyHtml(accent: string, lang: EmailLang, w: NonNullable<EngagementDecision["weekly"]>): string {
  const s = ENGAGEMENT_SHARED[lang]
  const rows: [string, string][] = [
    [s.weeklyRecipes, w.recipes],
    [s.weeklyFoodCost, w.foodCost],
    [s.weeklyInventory, w.inventory],
    [s.weeklyLowStock, w.lowStock],
    [s.weeklyMargin, w.margin],
  ]
  const font = "font-family:'DM Sans','Helvetica Neue',Helvetica,Arial,sans-serif"
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-left:4px solid ${accent};background:#FBF9F7;border-radius:0 10px 10px 0">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="${font};font-size:13px;color:#8A7D74;padding:9px 16px;border-bottom:1px solid #EFE8E1">${escapeHtml(label)}</td><td align="right" style="${font};font-size:17px;font-weight:800;color:#1A1512;padding:9px 16px;border-bottom:1px solid #EFE8E1">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>`
}

export function renderEngagementEmail(input: {
  decision: EngagementDecision
  language: string | null | undefined
  name?: string | null
  actionUrl: string
  unsubscribeUrl: string
  variant: number
}): { subject: string; html: string } {
  const lang = normalizeEmailLang(input.language)
  const { decision } = input
  const copy = ENGAGEMENT_COPY[lang][decision.type]
  const variant = copy.variants[Math.max(0, Math.min(2, input.variant))]
  const shared = REENGAGEMENT_SHARED[lang]
  const accent = ACCENT[decision.type]
  const safeName = input.name ? escapeHtml(input.name) : ""
  // vars ya vienen escapadas donde son datos del usuario; el asunto es texto plano.
  const plainVars = Object.fromEntries(
    Object.entries(decision.vars).map(([k, val]) => [k, val.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")]),
  )
  const subject = fillLabel(variant.subject, plainVars)
  const statBlock = decision.weekly
    ? weeklyHtml(accent, lang, decision.weekly)
    : decision.items?.length
      ? listHtml(accent, decision.items)
      : ""
  const html = renderEmailTemplate("12-recordatorio.html", {
    htmlLang: lang,
    title: escapeHtml(subject),
    preheader: escapeHtml(fillLabel(variant.preheader, plainVars)),
    accent,
    eyebrow: copy.eyebrow,
    heading: fillLabel(variant.heading, decision.vars),
    greeting: safeName ? fillLabel(shared.hello, { name: safeName }) : shared.helloNoName,
    body: fillLabel(variant.body, decision.vars),
    statBlock,
    cta: escapeHtml(fillLabel(variant.cta, plainVars)),
    actionUrl: input.actionUrl,
    footnote: shared.footnote,
    footerAddress: getEmailLabels(lang).footer_address,
    footer2: shared.footer2,
    unsubscribeUrl: input.unsubscribeUrl,
    unsubscribeLabel: shared.unsubscribe,
  })
  return { subject, html }
}

// ─── Cálculos de margen (puros) ───

interface RecipeRow {
  owner_id: string
  business_id: string | null
  name: string
  created_at: string
  is_sub_recipe: boolean
  unit_price: number | null
  cost: number | null
  method: string | null
  target: number | null
  ps: number | null
  mk: number | null
  op: number | null
  lb: number | null
  isv: number | null
  cm: number | null
}

/** Food cost objetivo de una receta según su método (mismos rubros por defecto que la Ficha Técnica). */
export function recipeTargetFoodCost(r: Pick<RecipeRow, "method" | "target" | "ps" | "mk" | "op" | "lb" | "isv" | "cm">): number {
  if (r.method === "food_cost") return Number(r.target) || 30
  const sum = (Number(r.ps ?? 10) || 0) + (Number(r.mk ?? 10) || 0) + (Number(r.op ?? 30) || 0) + (Number(r.lb ?? 25) || 0) + (Number(r.isv ?? 0) || 0) + (Number(r.cm ?? 30) || 0)
  return 100 / (1 + sum / 100)
}

export function marginIssueFor(r: RecipeRow, tolerance = ENGAGEMENT_RULES.marginTolerancePoints): MarginIssue | null {
  const price = Number(r.unit_price) || 0
  const cost = Number(r.cost) || 0
  if (r.is_sub_recipe || price <= 0 || cost <= 0) return null
  const actualPct = (cost / price) * 100
  const targetPct = recipeTargetFoodCost(r)
  const belowCost = cost >= price
  return belowCost || actualPct > targetPct + tolerance ? { name: r.name, actualPct, targetPct, belowCost } : null
}

// ─── Corrida del cron ───

export interface EngagementRunResult {
  skipped?: string
  candidates: number
  sent: number
  byType: Partial<Record<EngagementType, number>>
  decisions?: { accountId: string; type: EngagementType; ref: string; variant: number }[]
}

function isMondayInHonduras(now: number): boolean {
  return new Date(now).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Tegucigalpa" }) === "Mon"
}

export async function runEngagementEmails(options: { dryRun?: boolean; now?: number } = {}): Promise<EngagementRunResult> {
  const result: EngagementRunResult = { candidates: 0, sent: 0, byType: {} }
  if (!options.dryRun && !process.env.RESEND_API_KEY) return { ...result, skipped: "RESEND_API_KEY no configurada" }
  const admin = getSupabaseAdminClient()
  const now = options.now ?? Date.now()

  const probe = await admin.from("engagement_emails_sent").select("id").limit(1)
  if (probe.error) {
    if (isMissingTableError(probe.error)) return { ...result, skipped: "migración 0033 no corrida" }
    throw probe.error
  }

  const accounts = await loadOptedInAccounts(admin)
  result.candidates = accounts.length
  if (accounts.length === 0) return result
  const ids = accounts.map((a) => a.id)
  const since = (days: number) => new Date(now - days * DAY_MS).toISOString()

  const [recipes, items, menus, snaps, modules, invites, businesses, plans, profiles, presence, history, reeng, activation] = await Promise.all([
    fetchAllByIds<RecipeRow>(ids, (c, a, b) =>
      admin
        .from("recipes")
        .select(
          "owner_id, business_id, name, created_at, is_sub_recipe, unit_price:data->unitPrice, cost:data->costPerServing, method:data->>pricingMethod, target:data->targetFoodCostPercent, ps:data->publicServices, mk:data->marketing, op:data->operationalCosts, lb:data->laborCosts, isv:data->isv, cm:data->contributionMargin",
        )
        .in("owner_id", c)
        .order("created_at", { ascending: true })
        .range(a, b),
    ),
    fetchAllByIds<{ owner_id: string; name: string | null; cur: number | null; min: number | null; unit: string | null; price: number | null; net: number | null }>(ids, (c, a, b) =>
      admin
        .from("inventory_items")
        .select("owner_id, name:data->>name, cur:data->currentStock, min:data->minStock, unit:data->>unit, price:data->price, net:data->netContent")
        .in("owner_id", c)
        .range(a, b),
    ),
    fetchAllByIds<{ owner_id: string; created_at: string }>(ids, (c, a, b) =>
      admin.from("menus").select("owner_id, created_at").in("owner_id", c).order("created_at", { ascending: true }).range(a, b),
    ),
    fetchAllByIds<{ owner_id: string; date: string }>(ids, (c, a, b) =>
      admin.from("inventory_snapshots").select("owner_id, date").in("owner_id", c).order("date", { ascending: true }).range(a, b),
    ),
    fetchAllByIds<{ user_id: string; module: string }>(ids, (c, a, b) =>
      admin
        .from("activity_log")
        .select("user_id, module")
        .in("user_id", c)
        .in("module", FEATURE_MODULES.map((m) => m.module))
        .range(a, b),
    ),
    fetchAllByIds<{ id: string; owner_id: string; email: string; name: string | null; invited_at: string }>(ids, (c, a, b) =>
      admin.from("team_members").select("id, owner_id, email, name, invited_at").in("owner_id", c).eq("status", "invitado").range(a, b),
    ),
    fetchAllByIds<{ id: string; owner_id: string; name: string; created_at: string; active: boolean | null }>(ids, (c, a, b) =>
      admin.from("businesses").select("id, owner_id, name, created_at, active:data->isActive").in("owner_id", c).range(a, b),
    ),
    fetchAllByIds<{ account_id: string; plan_slug: string }>(ids, (c, a, b) =>
      admin.from("account_plans").select("account_id, plan_slug").in("account_id", c).range(a, b),
    ),
    fetchAllByIds<{ id: string; currency: string | null }>(ids, (c, a, b) =>
      admin.from("profiles").select("id, currency").in("id", c).range(a, b),
    ),
    fetchAllByIds<{ user_id: string; last_seen_at: string }>(ids, (c, a, b) =>
      admin.from("user_presence").select("user_id, last_seen_at").in("user_id", c).range(a, b),
    ),
    fetchAllByIds<{ account_id: string; email_type: EngagementType; ref: string; sent_at: string }>(ids, (c, a, b) =>
      admin.from("engagement_emails_sent").select("account_id, email_type, ref, sent_at").in("account_id", c).range(a, b),
    ),
    fetchAllByIds<{ account_id: string; sent_at: string }>(ids, (c, a, b) =>
      admin.from("reengagement_emails_sent").select("account_id, sent_at").in("account_id", c).gte("sent_at", since(5)).range(a, b),
    ),
    fetchAllByIds<{ account_id: string; sent_at: string }>(ids, (c, a, b) =>
      admin.from("activation_emails_sent").select("account_id, sent_at").in("account_id", c).gte("sent_at", since(5)).range(a, b),
    ),
  ])

  const group = <T,>(rows: T[], key: (row: T) => string) => {
    const map = new Map<string, T[]>()
    for (const row of rows) {
      const k = key(row)
      const list = map.get(k)
      if (list) list.push(row)
      else map.set(k, [row])
    }
    return map
  }
  const recipesBy = group(recipes, (r) => r.owner_id)
  const itemsBy = group(items, (r) => r.owner_id)
  const menusBy = group(menus, (r) => r.owner_id)
  const snapsBy = group(snaps, (r) => r.owner_id)
  const modulesBy = group(modules, (r) => r.user_id)
  const invitesBy = group(invites, (r) => r.owner_id)
  const businessesBy = group(businesses, (r) => r.owner_id)
  const historyBy = group(history, (r) => r.account_id)
  const otherBy = group([...reeng, ...activation], (r) => r.account_id)
  const planBy = new Map(plans.map((p) => [p.account_id, p.plan_slug]))
  const currencyBy = new Map(profiles.map((p) => [p.id, p.currency]))
  const presenceBy = new Map(presence.map((p) => [p.user_id, p.last_seen_at]))
  const recipeBusinessIds = new Set(recipes.map((r) => r.business_id).filter(Boolean) as string[])
  const monday = isMondayInHonduras(now)

  const resend = options.dryRun ? null : new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const decisions: NonNullable<EngagementRunResult["decisions"]> = []

  for (const account of accounts) {
    try {
      const lang = normalizeEmailLang(account.language)
      const own = (recipesBy.get(account.id) ?? []).filter((r) => !r.is_sub_recipe)
      const priced = own.filter((r) => (Number(r.unit_price) || 0) > 0 && (Number(r.cost) || 0) > 0)
      const accountItems = itemsBy.get(account.id) ?? []
      const code = currencyBy.get(account.id) || ""
      const facts: EngagementFacts = {
        now,
        accountCreatedAt: new Date(account.createdAt ?? now).getTime(),
        lastActiveAt: maxTime(presenceBy.get(account.id), account.lastSignInAt),
        isMonday: monday,
        planSlug: planBy.get(account.id) || "foodie",
        recipeCount: own.length,
        recipeCreatedTimes: own.map((r) => new Date(r.created_at).getTime()),
        avgFoodCostPct: priced.length
          ? priced.reduce((sum, r) => sum + ((Number(r.cost) || 0) / (Number(r.unit_price) || 1)) * 100, 0) / priced.length
          : null,
        marginIssues: own.map((r) => marginIssueFor(r)).filter((m): m is MarginIssue => m !== null),
        lowStock: accountItems
          .filter((i) => i.cur !== null && i.cur !== undefined && Number(i.min) > 0 && Number(i.cur) <= Number(i.min))
          .map((i) => ({ name: i.name || "—", current: Number(i.cur), min: Number(i.min), unit: i.unit || "" })),
        inventoryValue: accountItems.reduce((sum, i) => {
          const qty = Number(i.cur) || 0
          const price = Number(i.price) || 0
          const content = Number(i.net) || 1
          return sum + (qty * price) / content
        }, 0),
        currencySymbol: CURRENCY_OPTIONS.find((c) => c.code === code)?.symbol || code || "$",
        firstMenuAt: menusBy.get(account.id)?.[0] ? new Date(menusBy.get(account.id)![0].created_at).getTime() : null,
        firstCountAt: snapsBy.get(account.id)?.[0] ? new Date(snapsBy.get(account.id)![0].date).getTime() : null,
        usedModules: new Set((modulesBy.get(account.id) ?? []).map((m) => m.module)),
        pendingInvites: (invitesBy.get(account.id) ?? []).map((i) => ({
          id: i.id,
          label: i.name?.trim() || i.email,
          invitedAt: new Date(i.invited_at).getTime(),
        })),
        emptyBusinesses: (businessesBy.get(account.id) ?? [])
          .filter((b) => b.active !== false && !recipeBusinessIds.has(b.id))
          .map((b) => ({ id: b.id, name: b.name, createdAt: new Date(b.created_at).getTime() })),
        history: (historyBy.get(account.id) ?? []).map((h) => ({ type: h.email_type, ref: h.ref, sentAt: new Date(h.sent_at).getTime() })),
        otherSentTimes: (otherBy.get(account.id) ?? []).map((o) => new Date(o.sent_at).getTime()),
      }

      const decision = chooseEngagement(facts, lang)
      if (!decision) continue
      const previous = facts.history.filter((h) => h.type === decision.type).length
      const variant = pickEngagementVariant(account.id, decision.type, previous)
      decisions.push({ accountId: account.id, type: decision.type, ref: decision.ref, variant })
      if (options.dryRun || !resend) continue

      // Reserva primero (y marca los logros anteriores); si el envío falla se borra la reserva.
      const { data: claimed, error: claimError } = await admin
        .from("engagement_emails_sent")
        .insert({ account_id: account.id, email_type: decision.type, ref: decision.ref } as never)
        .select("id")
        .single()
      if (claimError || !claimed) {
        console.error("[notify-engagement] Error reservando envío:", claimError)
        continue
      }
      const unsubscribeUrl = buildUnsubscribeUrl(account.id)
      const { subject, html } = renderEngagementEmail({
        decision,
        language: account.language,
        name: account.name,
        actionUrl: `${siteUrl}${decision.actionPath}`,
        unsubscribeUrl,
        variant,
      })
      const { error: sendError } = await sendWithRetry(
        resend,
        {
          from: process.env.FEEDBACK_NOTIFY_FROM || "GastroMetrics <onboarding@resend.dev>",
          to: [account.email],
          subject,
          html,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        },
        `correo de valor (${decision.type})`,
      )
      if (sendError) {
        await admin.from("engagement_emails_sent").delete().eq("id", (claimed as { id: number }).id)
        continue
      }
      if (decision.markRefs?.length) {
        await admin
          .from("engagement_emails_sent")
          .insert(decision.markRefs.map((ref) => ({ account_id: account.id, email_type: decision.type, ref })) as never)
      }
      result.sent++
      result.byType[decision.type] = (result.byType[decision.type] ?? 0) + 1
    } catch (error) {
      console.error(`[notify-engagement] Error con la cuenta ${account.id}:`, error)
    }
  }

  if (options.dryRun) {
    result.decisions = decisions
    for (const d of decisions) result.byType[d.type] = (result.byType[d.type] ?? 0) + 1
  }
  return result
}
