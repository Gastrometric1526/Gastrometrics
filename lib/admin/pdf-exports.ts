/**
 * «PDF descargados» de /admin (pedido del dueño, docs/291): qué PDF descargó cada cuenta y
 * cuándo. Sale de `activity_log` (módulo «pdf», lo escribe `recordPdfExport`). Desde
 * docs/291 cada fila trae también el documento (`metadata.name`) y su versión
 * (`metadata.variant`); las anteriores solo tienen el tipo.
 */

export const PDF_KINDS = ["recipe", "menu", "mep", "cash_up", "inventory", "invoice", "purchase_order", "sales_history"] as const

export type PdfExportRow = {
  at: string
  kind: string
  name: string | null
  variant: string | null
  businessId: string | null
  businessName: string | null
  userId: string
  email: string | null
}

type RawActivity = { user_id: string; business_id: string | null; entity_label: string | null; metadata: unknown; created_at: string }

export function toPdfExportRow(a: RawActivity, businessNames: Map<string, string>, emails: Map<string, string>): PdfExportRow {
  const m = (a.metadata && typeof a.metadata === "object" ? a.metadata : {}) as Record<string, unknown>
  return {
    at: a.created_at,
    kind: a.entity_label || "other",
    name: typeof m.name === "string" && m.name ? m.name : null,
    variant: typeof m.variant === "string" && m.variant ? m.variant : null,
    businessId: a.business_id,
    businessName: a.business_id ? businessNames.get(a.business_id) ?? null : null,
    userId: a.user_id,
    email: emails.get(a.user_id) ?? null,
  }
}

/** Totales: cuántos, de cuántas cuentas, por tipo (de más a menos) y la cuenta que más descargó. */
export function summarizePdfExports(rows: PdfExportRow[]) {
  const byKind = new Map<string, number>()
  const byAccount = new Map<string, number>()
  for (const r of rows) {
    byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1)
    byAccount.set(r.userId, (byAccount.get(r.userId) ?? 0) + 1)
  }
  const top = [...byAccount].sort((a, b) => b[1] - a[1])[0]
  return {
    total: rows.length,
    accounts: byAccount.size,
    byKind: [...byKind].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count),
    topAccount: top ? { userId: top[0], email: rows.find((r) => r.userId === top[0])?.email ?? null, count: top[1] } : null,
  }
}
