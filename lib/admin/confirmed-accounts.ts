/**
 * Una cuenta cuenta como usuario solo cuando confirmó su correo (pedido del dueño, docs/201):
 * sin confirmar no puede entrar a la plataforma, así que no es un usuario. Se usa en todas las
 * métricas de /admin, los avisos al dueño, el resumen diario, el historial de cuentas y el
 * programa de 100 cocinas fundadoras. La lista de Cuentas sí las muestra (filtro «Sin
 * confirmar»), para dar soporte.
 */

export interface AuthUserLike {
  email_confirmed_at?: string | null
  confirmed_at?: string | null
}

/** Fecha en que confirmó el correo, o null si nunca confirmó. */
export function confirmedAt(user: AuthUserLike): string | null {
  return user.email_confirmed_at || user.confirmed_at || null
}

export function isConfirmedAccount(user: AuthUserLike): boolean {
  return Boolean(confirmedAt(user))
}
