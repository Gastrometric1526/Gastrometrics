/**
 * Centro de notificaciones de /admin (pedido del dueño, docs/267): lo que hizo la gente y pide
 * que el dueño lo mire —mensajes del chat, mensajes del buzón, calificaciones, respuestas a
 * las preguntas cortas, cuentas nuevas y cambios de plan— en una sola lista, con lo más
 * reciente arriba.
 *
 * No hay tabla propia: la ruta `/api/admin/notifications` lo arma con las tablas que ya
 * existen (support_messages, feedback, activity_log, Auth). Lo «leído» se guarda en el
 * aparato (`NOTICES_SEEN_KEY`). Aquí solo van las reglas puras, para probarlas.
 */

export type NoticeKind = "chat" | "message" | "rating" | "survey" | "signup" | "plan"

export interface AdminNotice {
  /** Único y estable entre lecturas (tipo + id de la fila). */
  id: string
  kind: NoticeKind
  /** Quién (nombre o correo); null si es anónimo. */
  who: string | null
  /** Texto corto: el mensaje, la respuesta, el plan… */
  text: string
  /** Detalle: tipo de mensaje del buzón, o la clave de la pregunta corta. */
  detail?: string | null
  /** Pregunta corta: la opción elegida o el número (se traduce en pantalla). */
  answer?: string | null
  at: string
  /** A dónde lleva al tocarla. */
  tab: string
  sub?: string
}

/** Cuántos días hacia atrás se miran. */
export const NOTICES_WINDOW_DAYS = 14
/** Cuántas se muestran como mucho. */
export const NOTICES_LIMIT = 60
export const NOTICES_SEEN_KEY = "gm_admin_notices_seen_at"

/** Dónde se atiende cada tipo en /admin. */
export const NOTICE_TARGET: Record<NoticeKind, { tab: string; sub?: string }> = {
  chat: { tab: "buzon", sub: "chat" },
  message: { tab: "buzon", sub: "mensajes" },
  rating: { tab: "buzon", sub: "mensajes" },
  survey: { tab: "buzon", sub: "encuestas" },
  signup: { tab: "cuentas", sub: "lista" },
  plan: { tab: "cuentas", sub: "historial" },
}

/** Junta las listas, quita repetidas, ordena de la más reciente a la más vieja y corta. */
export function mergeNotices(lists: AdminNotice[][], limit = NOTICES_LIMIT): AdminNotice[] {
  const byId = new Map<string, AdminNotice>()
  for (const list of lists) for (const n of list) if (!byId.has(n.id)) byId.set(n.id, n)
  return [...byId.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id)).slice(0, limit)
}

/** Las que llegaron después de la última vez que se marcaron como leídas. */
export function unreadNotices(notices: AdminNotice[], seenAt: number | null): AdminNotice[] {
  if (seenAt === null) return notices
  return notices.filter((n) => Date.parse(n.at) > seenAt)
}

/** Las que no estaban en la lectura anterior (para el aviso emergente). Sin lectura previa, ninguna. */
export function newSince(previousIds: Set<string> | null, notices: AdminNotice[]): AdminNotice[] {
  if (previousIds === null) return []
  return notices.filter((n) => !previousIds.has(n.id))
}

/** Recorta un texto largo a una línea legible. */
export function shortText(value: string | null | undefined, max = 140): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
