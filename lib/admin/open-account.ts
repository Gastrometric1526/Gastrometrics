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

/**
 * Enlace de los avisos al dueño (docs/294): «cada vez que haga clic en una notificación que me
 * mande mi teléfono sobre un usuario, me mande directamente a la radiografía de ese usuario».
 * La notificación lleva `?account=<id>` (o `accountEmail` si solo se conoce el correo) además
 * de la parte de siempre (`tab`/`sub`), que queda como respaldo si la cuenta ya no existe.
 */
export function adminAccountUrl(target: AccountTarget, fallback: { tab: string; sub?: string } = { tab: "cuentas", sub: "lista" }): string {
  const params = new URLSearchParams({ tab: fallback.tab })
  if (fallback.sub) params.set("sub", fallback.sub)
  if (target.userId) params.set("account", target.userId)
  else if (target.email?.trim()) params.set("accountEmail", target.email.trim().toLowerCase())
  return `/admin?${params.toString()}`
}

/** La cuenta pedida en la dirección de /admin (de una notificación), o null. Pura. */
export function accountFromSearch(search: string): AccountTarget | null {
  const params = new URLSearchParams(search)
  const userId = params.get("account")?.trim() || null
  const email = params.get("accountEmail")?.trim() || null
  return userId || email ? { userId, email } : null
}

/** Para volver a la parte de respaldo si la cuenta del enlace no se encuentra. */
export const ADMIN_GO_EVENT = "gm-admin-go"

let fallbackPart: { tab: string; sub?: string } | null = null

/** Abre la cuenta del enlace; si no se encuentra, se vuelve a `fallback`. */
export function openAdminAccountFromLink(target: AccountTarget, fallback: { tab: string; sub?: string } | null): void {
  fallbackPart = fallback
  openAdminAccount(target)
}

/** La parte de respaldo del último enlace, una sola vez. */
export function takeAccountFallback(): { tab: string; sub?: string } | null {
  const f = fallbackPart
  fallbackPart = null
  return f
}

/** Quita la cuenta del enlace de la dirección (al cerrar la ficha o cambiar de parte). */
export function withoutAccountParams(search: string): string {
  const params = new URLSearchParams(search)
  params.delete("account")
  params.delete("accountEmail")
  return params.toString()
}
