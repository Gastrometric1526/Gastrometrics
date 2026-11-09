/**
 * Exportación completa de /admin (pedido del dueño, docs/250): todo lo que la app guarda, sin
 * recortes, en un ZIP con un archivo por tabla. Esta es la parte pura. El informe en PDF
 * (full-report.ts) sigue siendo el resumen para leer.
 *
 * Una tabla nueva debe sumarse a EXPORT_TABLES: data-export.test.ts lee las migraciones y falla
 * si falta alguna. Secretos fuera: contraseñas, tokens de invitación y claves de aparatos.
 */

export interface ExportTable {
  name: string
  /** Columnas con orden estable, para que las páginas no repitan ni salten filas. */
  order: string[]
}

const byId = (name: string): ExportTable => ({ name, order: ["id"] })

export const EXPORT_TABLES: ExportTable[] = [
  byId("profiles"),
  { name: "account_plans", order: ["account_id"] },
  byId("businesses"),
  { name: "business_members", order: ["business_id", "user_id"] },
  { name: "business_invites", order: ["token"] },
  byId("team_members"),
  byId("ingredients"),
  byId("recipes"),
  byId("recipes_trash"),
  { name: "recipe_drafts", order: ["user_id", "business_key"] },
  byId("inventory_items"),
  byId("inventory_snapshots"),
  byId("menus"),
  byId("purchase_orders"),
  byId("invoices"),
  byId("sales_imports"),
  byId("pos_column_mappings"),
  byId("dish_name_mappings"),
  byId("pos_data"),
  byId("activity_log"),
  byId("product_events"),
  byId("page_views"),
  { name: "user_presence", order: ["user_id"] },
  byId("feedback"),
  byId("support_conversations"),
  byId("support_messages"),
  byId("activation_emails_sent"),
  byId("engagement_emails_sent"),
  byId("reengagement_emails_sent"),
]

/** Fuentes que no son tablas: cuentas de acceso, Stripe y archivos guardados. */
export const EXTRA_SOURCES = [
  "auth_users",
  "stripe_customers",
  "stripe_subscriptions",
  "stripe_invoices",
  "stripe_charges",
  "backups_index",
  "push_devices",
] as const

export const EXPORT_SOURCES: string[] = [...EXPORT_TABLES.map((t) => t.name), ...EXTRA_SOURCES]

/** Columnas que nunca salen: el token de invitación da acceso a un negocio. */
const HIDDEN_COLUMNS: Record<string, string[]> = { business_invites: ["token"] }

export type ExportRow = Record<string, unknown>

export function withoutHiddenColumns(table: string, rows: ExportRow[]): ExportRow[] {
  const hidden = HIDDEN_COLUMNS[table]
  if (!hidden) return rows
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !hidden.includes(key))))
}

/** Copia solo los campos pedidos: lo demás de Stripe o Auth no sale. */
export function pick(source: object, fields: string[]): ExportRow {
  const from = source as ExportRow
  return Object.fromEntries(fields.filter((field) => field in from).map((field) => [field, from[field]]))
}

export const AUTH_USER_FIELDS = [
  "id",
  "email",
  "phone",
  "created_at",
  "updated_at",
  "last_sign_in_at",
  "email_confirmed_at",
  "confirmed_at",
  "banned_until",
  "deleted_at",
  "user_metadata",
  "app_metadata",
]

/**
 * Cuántas filas caben en una respuesta. Vercel corta las respuestas de 4.5 MB y los mensajes
 * pueden traer adjuntos, así que la página se recorta por peso. Siempre devuelve al menos una.
 */
export function rowsThatFit(rows: ExportRow[], maxBytes: number): number {
  let bytes = 0
  for (let i = 0; i < rows.length; i++) {
    bytes += new TextEncoder().encode(JSON.stringify(rows[i])).length + 1
    if (bytes > maxBytes) return Math.max(i, 1)
  }
  return rows.length
}

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  const text = typeof value === "object" ? JSON.stringify(value) : String(value)
  // Un texto que empieza con = + - @ sería una fórmula al abrirlo en Excel.
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** CSV con BOM para que Excel lea los acentos. Las columnas son todas las que aparezcan. */
export function rowsToCsv(rows: ExportRow[]): string {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  const lines = [columns.map(csvCell).join(",")]
  for (const row of rows) lines.push(columns.map((column) => csvCell(row[column])).join(","))
  return "﻿" + lines.join("\r\n")
}

export interface ExportResult {
  source: string
  rows: number
  /** Filas que la base dice tener; null si la fuente no da un total. */
  total: number | null
  error: string | null
}

/** Una fuente quedó incompleta si falló o si trajo menos filas que las que había. */
export function isIncomplete(result: ExportResult): boolean {
  return Boolean(result.error) || (result.total !== null && result.rows < result.total)
}

export function exportReadme(results: ExportResult[], dateLabel: string): string {
  const incomplete = results.filter(isIncomplete)
  const lines = [
    "GastroMetrics: exportación completa",
    `Fecha: ${dateLabel}`,
    "",
    incomplete.length === 0
      ? "Estado: completa. Todas las fuentes se descargaron sin errores."
      : `Estado: INCOMPLETA. Revisa ${incomplete.length} fuente(s) marcadas abajo.`,
    "",
    "Este archivo tiene datos personales de todas las cuentas. Guárdalo en un lugar seguro y bórralo cuando ya no lo necesites.",
    "",
    "Cada fuente viene en dos archivos dentro de la carpeta datos:",
    "- .json: copia exacta, con los adjuntos en el campo donde se guardaron.",
    "- .csv: para abrir en Excel. Excel corta las celdas de más de 32 767 caracteres; para esas, usa el .json.",
    "",
    "No incluye: contraseñas, tokens de invitación, claves de aparatos ni datos de tarjetas.",
    "backups_index lista los respaldos por cuenta; sus archivos se abren en /admin → Cuentas → Respaldos.",
    "",
    "Fuente | Filas | Estado",
    ...results.map((r) => {
      const state = r.error ? `ERROR: ${r.error}` : isIncomplete(r) ? `INCOMPLETA: había ${r.total}` : "completa"
      return `${r.source} | ${r.rows} | ${state}`
    }),
    "",
  ]
  return lines.join("\r\n")
}
