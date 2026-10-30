/**
 * Informe completo de /admin en PDF (pedido del dueño, docs/206): «una forma de crear un PDF
 * masivo con toda la información que se recopila».
 *
 * Esta es la parte pura (probada en full-report.test.ts): qué secciones se leen y cómo
 * cualquier respuesta JSON de las rutas de /admin se convierte en bloques imprimibles
 * (pares dato–valor y tablas). Es genérica a propósito: si una ruta suma un campo nuevo,
 * aparece solo en el informe sin tocar este archivo. El PDF lo arma
 * components/admin/full-report-button.tsx con jsPDF + autoTable.
 */

import { formatDateTime } from "@/lib/date-format"

export interface ReportSection {
  id: string
  /** Clave de traducción del título (admin_report_sec_*). */
  titleKey: string
  url: string
}

/** Todas las lecturas de /admin (solo GET; nada se modifica al armar el informe). */
export const REPORT_SECTIONS: ReportSection[] = [
  { id: "stats", titleKey: "admin_report_sec_stats", url: "/api/admin/stats" },
  { id: "revenue", titleKey: "admin_report_sec_revenue", url: "/api/admin/revenue" },
  { id: "retention", titleKey: "admin_report_sec_retention", url: "/api/admin/retention" },
  { id: "accounts", titleKey: "admin_report_sec_accounts", url: "/api/admin/accounts?all=1" },
  { id: "history", titleKey: "admin_report_sec_history", url: "/api/admin/account-history" },
  { id: "top-users", titleKey: "admin_report_sec_top_users", url: "/api/admin/top-users?days=30" },
  { id: "activation", titleKey: "admin_report_sec_activation", url: "/api/admin/activation" },
  { id: "analytics", titleKey: "admin_report_sec_analytics", url: "/api/admin/analytics" },
  { id: "business-health", titleKey: "admin_report_sec_business_health", url: "/api/admin/business-health" },
  { id: "ocr", titleKey: "admin_report_sec_ocr", url: "/api/admin/ocr-usage" },
  { id: "usage-events", titleKey: "admin_report_sec_usage_events", url: "/api/admin/usage-events" },
  { id: "email-clicks", titleKey: "admin_report_sec_email_clicks", url: "/api/admin/email-clicks" },
  { id: "referrals", titleKey: "admin_report_sec_referrals", url: "/api/admin/referrals" },
  { id: "support", titleKey: "admin_report_sec_support", url: "/api/admin/support" },
  { id: "feedback", titleKey: "admin_report_sec_feedback", url: "/api/admin/feedback" },
  { id: "reviews", titleKey: "admin_report_sec_reviews", url: "/api/admin/reviews" },
  { id: "survey", titleKey: "admin_report_sec_survey", url: "/api/admin/survey-answers" },
  { id: "product-updates", titleKey: "admin_report_sec_product_updates", url: "/api/admin/product-update-email" },
  { id: "legal", titleKey: "admin_report_sec_legal", url: "/api/admin/legal-update-email" },
  { id: "health", titleKey: "admin_report_sec_health", url: "/api/admin/health" },
]

export type ReportBlock =
  | { kind: "kv"; title: string | null; rows: [string, string][] }
  | { kind: "table"; title: string | null; columns: string[]; rows: string[][]; total: number }

/** Filas como máximo por tabla (el resto se resume con «y N más»). */
export const MAX_TABLE_ROWS = 1000
const MAX_COLUMNS = 10
const MAX_DEPTH = 4
const MAX_CELL = 140

/** Nombres legibles de los campos más comunes; el resto se arma a partir de la clave. */
const LABELS: Record<string, string> = {
  // Resumen de «quién volvió por los correos» (docs/210).
  recipients: "Recibieron correos",
  returned: "Volvieron por un correo",
  returnedpercent: "% que volvió",
  wereinactive: "Estaban inactivas (7 días antes)",
  keptusing: "Siguieron usando la app (7 días después)",
  last7days: "Volvieron en los últimos 7 días",
  last30days: "Volvieron en los últimos 30 días",
  email: "Correo",
  name: "Nombre",
  full_name: "Nombre",
  fullname: "Nombre",
  plan: "Plan",
  planslug: "Plan",
  plan_slug: "Plan",
  created_at: "Creado",
  createdat: "Creado",
  updated_at: "Actualizado",
  updatedat: "Actualizado",
  lastseenat: "Última vez en línea",
  last_seen_at: "Última vez en línea",
  last_sign_in_at: "Último inicio de sesión",
  lastsigninat: "Último inicio de sesión",
  expiresat: "Vence",
  plan_expires_at: "Vence",
  planexpiresat: "Vence",
  status: "Estado",
  type: "Tipo",
  message: "Mensaje",
  count: "Cantidad",
  total: "Total",
  amount: "Monto",
  currency: "Moneda",
  country: "País",
  language: "Idioma",
  preferred_language: "Idioma",
  businesses: "Negocios",
  recipes: "Recetas",
  ingredients: "Ingredientes",
  category: "Tema",
  date: "Fecha",
  day: "Día",
  month: "Mes",
  page: "Página",
  path: "Página",
  views: "Vistas",
  visitors: "Visitantes",
  clicks: "Clics",
  rating: "Nota",
  score: "Nota",
  id: "Id",
}

export function labelFor(key: string): string {
  const known = LABELS[key.toLowerCase()]
  if (known) return known
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
  return words ? words[0].toUpperCase() + words.slice(1) : key
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
const isScalar = (v: unknown) => v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v)

/** Texto de una celda: fechas en día/mes/año, decimales con punto, archivos resumidos. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Sí" : "No"
  if (typeof value === "number") return Number.isFinite(value) ? (Number.isInteger(value) ? String(value) : value.toFixed(2)) : "—"
  if (typeof value === "string") {
    if (value.startsWith("data:")) return "[archivo adjunto]"
    if (ISO_DATE.test(value)) {
      const d = new Date(value)
      if (!Number.isNaN(d.getTime())) return formatDateTime(d)
    }
    const flat = value.replace(/\s+/g, " ").trim()
    return flat.length > MAX_CELL ? flat.slice(0, MAX_CELL - 1) + "…" : flat
  }
  if (Array.isArray(value)) {
    if (value.every(isScalar)) return formatCell(value.map((v) => formatCell(v)).join(", "))
    return `${value.length} elementos`
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => isScalar(v))
    return formatCell(entries.map(([k, v]) => `${labelFor(k)}: ${formatCell(v)}`).join(" · "))
  }
  return String(value)
}

/** Convierte cualquier respuesta JSON en bloques: datos sueltos en pares y listas en tablas. */
export function flattenForReport(value: unknown, title: string | null = null, depth = 0): ReportBlock[] {
  if (value === null || value === undefined) return []
  if (Array.isArray(value)) {
    if (value.length === 0) return [{ kind: "kv", title, rows: [["", "Sin datos"]] }]
    if (value.every(isScalar)) return [{ kind: "kv", title, rows: [["", formatCell(value)]] }]
    const objects = value.filter((v) => v && typeof v === "object" && !Array.isArray(v)) as Record<string, unknown>[]
    const keys: string[] = []
    for (const o of objects) for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k)
    // Primero los campos simples (los que se leen en una celda), después los anidados.
    const simple = keys.filter((k) => objects.some((o) => isScalar(o[k]) && o[k] !== null && o[k] !== ""))
    const nested = keys.filter((k) => !simple.includes(k) && objects.some((o) => o[k] && typeof o[k] === "object"))
    const columns = [...simple, ...nested].slice(0, MAX_COLUMNS)
    return [
      {
        kind: "table",
        title,
        columns: columns.map(labelFor),
        rows: objects.slice(0, MAX_TABLE_ROWS).map((o) => columns.map((k) => formatCell(o[k]))),
        total: objects.length,
      },
    ]
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const blocks: ReportBlock[] = []
    const scalars = Object.entries(obj).filter(([k, v]) => isScalar(v) && k !== "error")
    if (scalars.length) blocks.push({ kind: "kv", title, rows: scalars.map(([k, v]) => [labelFor(k), formatCell(v)]) })
    for (const [k, v] of Object.entries(obj)) {
      if (isScalar(v)) continue
      const childTitle = title ? `${title} › ${labelFor(k)}` : labelFor(k)
      if (depth >= MAX_DEPTH) blocks.push({ kind: "kv", title: childTitle, rows: [["", formatCell(v)]] })
      else blocks.push(...flattenForReport(v, childTitle, depth + 1))
    }
    return blocks
  }
  return [{ kind: "kv", title, rows: [["", formatCell(value)]] }]
}
