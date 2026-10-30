/**
 * Abrir la ficha de una cuenta desde cualquier panel de /admin (pedido del dueño, docs/214):
 * «en todas las instancias donde se mencionen cuentas debería de poder hacer click ahí para
 * entrar a ver detalles de dicha cuenta».
 *
 * Cualquier panel llama a openAdminAccount (vía <AccountLink>). La página de /admin escucha el
 * evento y cambia a Cuentas → Lista; AccountsPanel, al montarse o al recibir el evento, toma
 * la cuenta pendiente y abre su detalle. Se guarda como pendiente porque AccountsPanel puede
 * no estar montado todavía cuando se hace clic (las pestañas se montan al abrirlas).
 */

export const OPEN_ACCOUNT_EVENT = "gm-admin-open-account"

export interface AccountTarget {
  userId?: string | null
  email?: string | null
}

let pending: AccountTarget | null = null

export function openAdminAccount(target: AccountTarget): void {
  if (!target.userId && !target.email) return
  pending = { userId: target.userId || null, email: target.email?.trim() || null }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OPEN_ACCOUNT_EVENT))
}

/** La cuenta pedida, una sola vez (después queda vacía). */
export function takePendingAccount(): AccountTarget | null {
  const p = pending
  pending = null
  return p
}

/** Parámetros de /api/admin/accounts para encontrar exactamente esa cuenta. */
export function accountLookupQuery(target: AccountTarget): string {
  const params = new URLSearchParams({ confirmed: "all" })
  if (target.userId) params.set("userId", target.userId)
  else if (target.email) params.set("email", target.email)
  return params.toString()
}
