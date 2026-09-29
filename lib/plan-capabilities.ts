// Qué incluye cada plan, como lista concreta de capacidades (docs/139). Se usa para decirle
// a la persona, cuando su plan cambia (Stripe, /admin o vencimiento), QUÉ GANA, QUÉ PIERDE y
// QUÉ TIENE AHORA — en el correo de cambio de plan y en el aviso del Dashboard.
//
// BUG CORREGIDO: antes se comparaban los textos de marketing de Plan.features, que son
// acumulativos ("Todo lo del plan Home Cook"…): al subir de Foodie a Chef de Partie no se
// mencionaban merma, facturas ni órdenes manuales, y al bajar aparecían frases como
// "Todo lo del plan Chef de Partie" en vez de las funciones concretas. Esto parte de los
// permisos reales (Plan.unlockedFeatures) y de los límites (negocios y usuarios).

import { getPlanBySlug, type FeatureKey, type Plan } from "@/lib/plans"

export type CapabilityLang = "es" | "en" | "da" | "fr" | "pt" | "zh"

// Orden = orden en que se muestran. "base" = incluido en todos los planes.
const CAPABILITY_ORDER = [
  "base_recipes",
  "base_kitchen_pdf",
  "merma",
  "pdf_admin",
  "invoices",
  "purchase_orders_manual",
  "inventory",
  "purchase_orders_auto",
  "menus",
  "stats_panorama",
  "manual_sales",
  "stats_finance",
  "team",
] as const

type CapabilityKey = (typeof CAPABILITY_ORDER)[number]

const LABELS: Record<CapabilityLang, Record<CapabilityKey, string> & { businesses: string; businessesOne: string; users: string; usersOne: string }> = {
  es: {
    base_recipes: "Fichas técnicas ilimitadas, base de ingredientes e importación desde Excel",
    base_kitchen_pdf: "PDF de cocina (sin costos)",
    merma: "Sistema de merma",
    pdf_admin: "PDF administrativo (con costos y rentabilidad)",
    invoices: "Facturación a clientes",
    purchase_orders_manual: "Órdenes de compra manuales",
    inventory: "Inventario: stock, alertas, stock teórico y conteos",
    purchase_orders_auto: "Órdenes de compra automáticas (desde menús y stock bajo)",
    menus: "Menús con escalado por PAX",
    stats_panorama: "Reportes · Panorama del negocio",
    manual_sales: "Registro manual de ventas",
    stats_finance: "Finanzas: P&L, importación del POS, Menu Engineering y cocina vs. barra",
    team: "Equipo: invitar personas con permisos por función",
    businesses: "Hasta {n} negocios",
    businessesOne: "1 negocio",
    users: "{n} usuarios (tú y {m} más)",
    usersOne: "1 usuario (solo tú)",
  },
  en: {
    base_recipes: "Unlimited recipe sheets, ingredient database and Excel import",
    base_kitchen_pdf: "Kitchen PDF (no costs)",
    merma: "Shrinkage system",
    pdf_admin: "Administrative PDF (with costs and profitability)",
    invoices: "Customer invoicing",
    purchase_orders_manual: "Manual purchase orders",
    inventory: "Inventory: stock, alerts, theoretical stock and counts",
    purchase_orders_auto: "Automatic purchase orders (from menus and low stock)",
    menus: "Menus with PAX scaling",
    stats_panorama: "Reports · Business overview",
    manual_sales: "Manual sales logging",
    stats_finance: "Finance: P&L, POS import, Menu Engineering and kitchen vs. bar",
    team: "Team: invite people with per-role permissions",
    businesses: "Up to {n} businesses",
    businessesOne: "1 business",
    users: "{n} users (you and {m} more)",
    usersOne: "1 user (just you)",
  },
  da: {
    base_recipes: "Ubegrænsede opskriftsark, ingrediensdatabase og import fra Excel",
    base_kitchen_pdf: "Køkken-PDF (uden priser)",
    merma: "Svindsystem",
    pdf_admin: "Administrativ PDF (med omkostninger og rentabilitet)",
    invoices: "Fakturering til kunder",
    purchase_orders_manual: "Manuelle indkøbsordrer",
    inventory: "Lager: beholdning, advarsler, teoretisk lager og optællinger",
    purchase_orders_auto: "Automatiske indkøbsordrer (fra menuer og lav beholdning)",
    menus: "Menuer med PAX-skalering",
    stats_panorama: "Rapporter · Overblik over virksomheden",
    manual_sales: "Manuel registrering af salg",
    stats_finance: "Økonomi: resultatopgørelse, POS-import, Menu Engineering og køkken vs. bar",
    team: "Team: inviter personer med rollebaserede tilladelser",
    businesses: "Op til {n} virksomheder",
    businessesOne: "1 virksomhed",
    users: "{n} brugere (dig og {m} mere)",
    usersOne: "1 bruger (kun dig)",
  },
  fr: {
    base_recipes: "Fiches techniques illimitées, base d'ingrédients et import depuis Excel",
    base_kitchen_pdf: "PDF cuisine (sans coûts)",
    merma: "Système de pertes",
    pdf_admin: "PDF administratif (avec coûts et rentabilité)",
    invoices: "Facturation clients",
    purchase_orders_manual: "Commandes d'achat manuelles",
    inventory: "Inventaire : stock, alertes, stock théorique et comptages",
    purchase_orders_auto: "Commandes d'achat automatiques (depuis les menus et le stock bas)",
    menus: "Menus avec mise à l'échelle par PAX",
    stats_panorama: "Rapports · Vue d'ensemble de l'entreprise",
    manual_sales: "Saisie manuelle des ventes",
    stats_finance: "Finances : compte de résultat, import POS, Menu Engineering et cuisine vs bar",
    team: "Équipe : inviter des personnes avec des autorisations par fonction",
    businesses: "Jusqu'à {n} entreprises",
    businessesOne: "1 entreprise",
    users: "{n} utilisateurs (vous et {m} de plus)",
    usersOne: "1 utilisateur (vous seul)",
  },
  pt: {
    base_recipes: "Fichas técnicas ilimitadas, base de ingredientes e importação do Excel",
    base_kitchen_pdf: "PDF de cozinha (sem custos)",
    merma: "Sistema de perdas",
    pdf_admin: "PDF administrativo (com custos e rentabilidade)",
    invoices: "Faturamento para clientes",
    purchase_orders_manual: "Pedidos de compra manuais",
    inventory: "Estoque: saldo, alertas, estoque teórico e contagens",
    purchase_orders_auto: "Pedidos de compra automáticos (a partir de cardápios e estoque baixo)",
    menus: "Cardápios com escalonamento por PAX",
    stats_panorama: "Relatórios · Panorama do negócio",
    manual_sales: "Registro manual de vendas",
    stats_finance: "Finanças: DRE, importação do POS, Menu Engineering e cozinha vs. bar",
    team: "Equipe: convidar pessoas com permissões por função",
    businesses: "Até {n} negócios",
    businessesOne: "1 negócio",
    users: "{n} usuários (você e mais {m})",
    usersOne: "1 usuário (só você)",
  },
  zh: {
    base_recipes: "无限技术配方表、原料数据库和 Excel 导入",
    base_kitchen_pdf: "厨房版 PDF（不含成本）",
    merma: "损耗系统",
    pdf_admin: "管理版 PDF（含成本与盈利）",
    invoices: "客户开票",
    purchase_orders_manual: "手动采购订单",
    inventory: "库存：库存量、提醒、理论库存和盘点",
    purchase_orders_auto: "自动采购订单（根据菜单和低库存）",
    menus: "菜单及按人数缩放",
    stats_panorama: "报表 · 经营概览",
    manual_sales: "手动录入销售",
    stats_finance: "财务：损益表、POS 导入、菜单工程及厨房与酒吧对比",
    team: "团队：邀请成员并按职能分配权限",
    businesses: "最多 {n} 个商户",
    businessesOne: "1 个商户",
    users: "{n} 个用户（你和另外 {m} 人）",
    usersOne: "1 个用户（仅你自己）",
  },
}

export function normalizeCapabilityLang(language: string | null | undefined): CapabilityLang {
  const l = (language || "es").slice(0, 2).toLowerCase()
  return (["es", "en", "da", "fr", "pt", "zh"] as const).includes(l as CapabilityLang) ? (l as CapabilityLang) : "es"
}

interface CapabilityItem {
  /** Clave estable para comparar entre planes (los límites llevan su valor). */
  id: string
  label: string
  /** Solo en los límites: el número, para saber si subió o bajó. */
  limit?: { kind: "businesses" | "users"; value: number }
}

function capabilityItems(plan: Plan, lang: CapabilityLang): CapabilityItem[] {
  const L = LABELS[lang]
  const unlocked = new Set<FeatureKey>(plan.unlockedFeatures)
  const items: CapabilityItem[] = []
  for (const key of CAPABILITY_ORDER) {
    if (key.startsWith("base_") || unlocked.has(key as FeatureKey)) items.push({ id: key, label: L[key] })
  }
  items.push({
    id: `businesses:${plan.maxBusinesses}`,
    limit: { kind: "businesses", value: plan.maxBusinesses },
    label: plan.maxBusinesses === 1 ? L.businessesOne : L.businesses.replace("{n}", String(plan.maxBusinesses)),
  })
  items.push({
    id: `users:${plan.maxUsers}`,
    limit: { kind: "users", value: plan.maxUsers },
    label:
      plan.maxUsers <= 1
        ? L.usersOne
        : L.users.replace("{n}", String(plan.maxUsers)).replace("{m}", String(plan.maxUsers - 1)),
  })
  return items
}

export interface PlanCapabilityDiff {
  gained: string[]
  lost: string[]
  /** Todo lo que incluye el plan nuevo. */
  now: string[]
}

/**
 * Compara dos planes. Las funciones se comparan por clave; los límites (negocios, usuarios)
 * por valor y solo en la dirección que importa: al subir, el límite nuevo aparece como
 * ganado ("Hasta 2 negocios"); al bajar, el anterior aparece como perdido — nunca "1 negocio"
 * como algo ganado en una bajada.
 */
export function diffPlanCapabilities(fromSlug: string, toSlug: string, language: string | null | undefined): PlanCapabilityDiff {
  const lang = normalizeCapabilityLang(language)
  const from = capabilityItems(getPlanBySlug(fromSlug), lang)
  const to = capabilityItems(getPlanBySlug(toSlug), lang)
  const fromIds = new Set(from.map((i) => i.id))
  const toIds = new Set(to.map((i) => i.id))
  const limitOf = (items: CapabilityItem[], kind: string) => items.find((i) => i.limit?.kind === kind)?.limit?.value ?? 0
  return {
    gained: to
      .filter((i) => !fromIds.has(i.id) && (!i.limit || i.limit.value > limitOf(from, i.limit.kind)))
      .map((i) => i.label),
    lost: from
      .filter((i) => !toIds.has(i.id) && (!i.limit || i.limit.value > limitOf(to, i.limit.kind)))
      .map((i) => i.label),
    now: to.map((i) => i.label),
  }
}
