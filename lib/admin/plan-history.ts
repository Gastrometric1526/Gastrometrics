/**
 * Historial de plan de una cuenta para /admin (pedido del dueño, docs/301: «debo poder ver
 * todos los cambios de planes de cada usuario»). Sale de `activity_log` (módulo «plan»,
 * acción «plan_changed»), que escriben `recordPlanChangeNotice` (cambios que se avisan a la
 * persona) y `logPlanHistory` (cancelaciones, Foodie por cuenta propia, testers,
 * extensiones). Puro: convierte cada fila en una entrada.
 */

export type PlanHistoryKind = "changed" | "cancel_scheduled" | "cancel_undone" | "extended"

/** De dónde vino. «admin_legacy»: filas de antes de docs/301, donde «admin» juntaba /admin, fundadoras y referidos. */
export type PlanHistoryOrigin =
  | "admin"
  | "admin_legacy"
  | "founder"
  | "referral"
  | "scheduled"
  | "stripe"
  | "stripe_cancel"
  | "expired"
  | "self"
  | "tester"

export const PLAN_HISTORY_ORIGINS: PlanHistoryOrigin[] = ["admin", "admin_legacy", "founder", "referral", "scheduled", "stripe", "stripe_cancel", "expired", "self", "tester"]

export interface PlanChange {
  at: string
  from: string | null
  to: string | null
  /** Lo que se guardó como `source` (popup y correo). */
  source: string | null
  origin: PlanHistoryOrigin | null
  kind: PlanHistoryKind
  /** Fin del período pagado (cancelación) o nuevo vencimiento. */
  until: string | null
  /** Quién lo hizo desde /admin. */
  by: string | null
  /** Vencimiento que se puso con el cambio, si tenía. */
  expiresAt: string | null
}

const KINDS: PlanHistoryKind[] = ["changed", "cancel_scheduled", "cancel_undone", "extended"]

export function planChangeFromRow(row: { created_at: string; entity_label?: string | null; metadata?: Record<string, unknown> | null }): PlanChange {
  const m = row.metadata ?? {}
  const str = (v: unknown) => (typeof v === "string" && v ? v : null)
  const source = str(m.source)
  const rawOrigin = str(m.origin)
  const origin = (
    rawOrigin && (PLAN_HISTORY_ORIGINS as string[]).includes(rawOrigin)
      ? rawOrigin
      : source === "admin"
        ? "admin_legacy"
        : source && (PLAN_HISTORY_ORIGINS as string[]).includes(source)
          ? source
          : null
  ) as PlanHistoryOrigin | null
  const kind = (KINDS as string[]).includes(str(m.kind) ?? "") ? (m.kind as PlanHistoryKind) : "changed"
  return {
    at: row.created_at,
    from: str(m.from),
    to: str(m.to) ?? str(row.entity_label),
    source,
    origin,
    kind,
    until: str(m.until),
    by: str(m.by),
    expiresAt: str(m.expires_at),
  }
}
