/**
 * Confirmación de cobros (docs/183): cada cobro real de Stripe, salga bien o mal, se le
 * confirma a la persona (correo en su idioma + aviso en la app + «Último cobro» en Mi
 * Plan) y al dueño. Aquí la parte pura: qué evento de Stripe cuenta como cobro.
 *
 * - Cobro hecho: `invoice.paid` con monto > 0 (las facturas de $0, como el inicio de un
 *   pago programado con prueba, no son cobros).
 * - Cobro fallido: el webhook no recibe `invoice.payment_failed` (no está suscrito y no se
 *   toca la configuración de Stripe desde el código), pero Stripe pasa la suscripción a
 *   `past_due`/`unpaid` cuando falla un cobro y eso sí llega en
 *   `customer.subscription.updated`.
 */

export interface PaymentRecord {
  status: "paid" | "failed"
  amountCents: number | null
  currency: string
  planSlug: string | null
  at: string
  invoiceUrl: string | null
  /** Siguiente cobro (cobro hecho) o próximo reintento (cobro fallido), si Stripe lo dice. */
  nextAt: string | null
  /** id de la factura o de la suscripción + estado: evita registrar dos veces lo mismo. */
  key: string
  seen?: boolean
}

export interface InvoiceLike {
  id: string
  amount_paid?: number | null
  currency?: string | null
  hosted_invoice_url?: string | null
  status_transitions?: { paid_at?: number | null } | null
  lines?: { data?: Array<{ period?: { end?: number | null } | null }> } | null
}

const iso = (unixSeconds: number | null | undefined) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null)

/** Cobro hecho a partir de una factura pagada, o null si no hubo cobro (monto 0). */
export function paidRecordFromInvoice(invoice: InvoiceLike, planSlug: string | null, now: number): PaymentRecord | null {
  const amount = invoice.amount_paid ?? 0
  if (!(amount > 0)) return null
  return {
    status: "paid",
    amountCents: amount,
    currency: (invoice.currency || "usd").toLowerCase(),
    planSlug,
    at: iso(invoice.status_transitions?.paid_at) ?? new Date(now).toISOString(),
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    nextAt: iso(invoice.lines?.data?.[0]?.period?.end),
    key: `inv:${invoice.id}`,
  }
}

const FAILED = ["past_due", "unpaid"]

/** ¿La suscripción acaba de pasar a un estado de cobro fallido? */
export function isNewPaymentFailure(status: string, previousStatus: string | null | undefined): boolean {
  return FAILED.includes(status) && previousStatus !== undefined && previousStatus !== null && !FAILED.includes(previousStatus)
}

/** Agrega un cobro al historial (máximo 12, el más reciente primero) sin duplicar la misma clave. */
export function pushPayment(history: PaymentRecord[] | undefined, record: PaymentRecord): { history: PaymentRecord[]; added: boolean } {
  const list = history || []
  if (list.some((p) => p.key === record.key)) return { history: list, added: false }
  return { history: [record, ...list].slice(0, 12), added: true }
}
