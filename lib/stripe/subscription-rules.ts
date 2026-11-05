/**
 * Reglas puras de cobros (docs/242), cubiertas por pruebas y comprobadas contra Stripe de
 * prueba con relojes de prueba.
 */

export const LIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"]

/**
 * ¿La factura de un pago programado quedó pagada? Se mira `total`, no `amount_paid`: si el
 * saldo a favor (meses ganados) cubre toda la factura, Stripe la marca pagada con
 * amount_paid 0 y total 2500. La factura de la prueba tiene total 0 y no cuenta.
 */
export function renewalInvoicePaid(invoice: { status?: string | null; total?: number | null }): boolean {
  return invoice.status === "paid" && (invoice.total ?? 0) > 0
}

/**
 * ¿Un evento de esta suscripción puede cambiar el plan de la cuenta? Stripe no garantiza el
 * orden: un evento viejo puede llegar después de una cancelación o de un pago nuevo. La de la
 * cuenta siempre manda; otra solo entra si sigue viva en Stripe (`status` es el estado leído
 * de Stripe en ese momento, no el que trae el evento).
 */
export function subscriptionEventApplies(input: {
  subscriptionId: string
  accountSubscriptionId: string | null | undefined
  status: string
}): boolean {
  return input.accountSubscriptionId === input.subscriptionId || LIVE_SUBSCRIPTION_STATUSES.includes(input.status)
}

/** Lo que una cuenta tiene de más para un plan. Solo informa: no se bloquea ni se borra nada. */
export function planExcess(input: { businesses: number; maxBusinesses: number; teamMembers: number; maxTeamMembers: number }) {
  return {
    businesses: input.businesses > input.maxBusinesses ? { count: input.businesses, max: input.maxBusinesses } : null,
    team: input.teamMembers > input.maxTeamMembers ? { count: input.teamMembers, max: input.maxTeamMembers } : null,
  }
}
