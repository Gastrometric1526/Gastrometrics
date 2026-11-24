/**
 * Chat de soporte (docs/204) — la parte pura, cubierta por lib/support/core.test.ts.
 *
 * - Categorías: el bot pregunta de qué se trata para ordenar la bandeja del dueño y para buscar
 *   en el capítulo correcto del manual (manual/content/*.mjs → public/help/manual-<idioma>.json,
 *   generado por manual/scripts/build-help-index.mjs).
 * - Fila por orden de llegada: cuántas conversaciones esperan respuesta desde antes que la tuya.
 * - Búsqueda en el manual: sin IA ni datos privados; compara las palabras de la pregunta con
 *   las secciones del manual (sin acentos ni mayúsculas) y da más peso al capítulo de la
 *   categoría elegida.
 * - Adjuntos: los mismos formatos que la app ya acepta al importar (fotos, PDF, Excel, CSV, texto).
 */

export const SUPPORT_CATEGORIES = [
  { id: "ficha", chapters: ["ficha", "subrecetas", "formulas"] },
  { id: "ingredientes", chapters: ["ingredientes"] },
  { id: "inventario", chapters: ["inventario"] },
  { id: "menus", chapters: ["menus"] },
  { id: "compras", chapters: ["compras"] },
  { id: "ventas", chapters: ["ventas", "reportes"] },
  { id: "planes", chapters: ["planes", "invita"] },
  { id: "cuenta", chapters: ["cuenta", "config", "equipo"] },
  { id: "error", chapters: ["problemas"] },
  { id: "sugerencia", chapters: [] },
  { id: "otro", chapters: [] },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"]

export function isSupportCategory(value: unknown): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((c) => c.id === value)
}

export type SupportStatus = "waiting" | "answered" | "closed"

/** Personas que esperan respuesta desde antes que esta conversación (0 = eres la siguiente). */
export function queuePosition(conversations: { id: string; status: string; waiting_since: string | null }[], conversationId: string): number | null {
  const mine = conversations.find((c) => c.id === conversationId)
  if (!mine || mine.status !== "waiting" || !mine.waiting_since) return null
  const t = new Date(mine.waiting_since).getTime()
  return conversations.filter((c) => c.id !== conversationId && c.status === "waiting" && c.waiting_since && (new Date(c.waiting_since).getTime() < t || (new Date(c.waiting_since).getTime() === t && c.id < conversationId))).length
}

// ─── Búsqueda en el manual ───

export interface HelpEntry {
  chapterId: string
  chapter: string
  section: string
  text: string
}

const STOP = new Set(
  "a al algo como con cual cuando de del el en es esta este hay la las lo los me mi no o para por que se si sin su sus te tu un una y yo the and for how what with can do does is in on of to my i it de les des du et la le pour que un une est dans comment og at det en er for hvordan jeg med som til e o os um uma como da do em para que com 的 了 吗 我 怎么 如何".split(" "),
)

export function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/<[^>]+>/g, " ")
}

function tokens(s: string): string[] {
  const n = normalizeText(s)
  // Chino: sin espacios entre palabras, se compara por pares de caracteres.
  if (/[一-鿿]/.test(n)) {
    const han = n.replace(/[^一-鿿]/g, "")
    const pairs: string[] = []
    for (let i = 0; i < han.length - 1; i++) pairs.push(han.slice(i, i + 2))
    const latin = n.replace(/[一-鿿]/g, " ").split(/[^a-z0-9%]+/).filter((w) => w.length > 2)
    return [...pairs, ...latin].filter((w) => !STOP.has(w))
  }
  return n.split(/[^a-z0-9%]+/).filter((w) => w.length > 2 && !STOP.has(w))
}

/** Las secciones del manual que mejor responden la pregunta (como mucho `limit`). */
export function searchHelp(index: HelpEntry[], query: string, category?: SupportCategory | null, limit = 3): HelpEntry[] {
  const q = Array.from(new Set(tokens(query)))
  const chapters = new Set<string>(SUPPORT_CATEGORIES.find((c) => c.id === category)?.chapters ?? [])
  const scored = index.map((entry) => {
    const titleTokens = new Set(tokens(`${entry.section} ${entry.chapter}`))
    const bodyTokens = new Set(tokens(entry.text))
    let score = 0
    for (const w of q) {
      if (titleTokens.has(w)) score += 3
      else if (bodyTokens.has(w)) score += 1
      else if (w.length >= 5 && [...bodyTokens].some((b) => b.startsWith(w.slice(0, 5)))) score += 0.5
    }
    if (chapters.has(entry.chapterId)) score = score > 0 ? score + 2 : 0.5
    return { entry, score }
  })
  return scored
    .filter((s) => s.score >= (q.length ? 1.5 : 0.5))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry)
}

// ─── Adjuntos ───

export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
export const MAX_ATTACHMENTS = 3
/** Entre todos los adjuntos de un mensaje: en base64 ocupan ~4/3, y Vercel corta los pedidos de más de 4.5 MB. */
export const MAX_TOTAL_ATTACHMENT_BYTES = 3 * 1024 * 1024
// docs/345: también Word, OpenDocument y RTF (documentos que no se ejecutan en el navegador;
// nunca HTML ni SVG).
const ACCEPTED_MIME = /^(image\/(png|jpe?g|webp|gif|heic|heif)|application\/pdf|text\/(csv|plain|markdown|rtf)|application\/rtf|application\/msword|application\/vnd\.ms-excel(\.sheet\.macroEnabled\.12)?|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document)|application\/vnd\.oasis\.opendocument\.(text|spreadsheet))$/
const ACCEPTED_EXT = /\.(png|jpe?g|webp|gif|heic|heif|pdf|csv|txt|md|xlsx|xlsm|xls|ods|numbers|docx|doc|odt|rtf)$/i
export const ATTACHMENT_ACCEPT = "image/*,.pdf,.csv,.txt,.md,.xlsx,.xlsm,.xls,.ods,.numbers,.docx,.doc,.odt,.rtf"

export interface SupportAttachment {
  name: string
  type: string
  size: number
  data: string // data URL
}

export function isAcceptedAttachment(file: { name: string; type: string; size: number }): boolean {
  return file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES && (ACCEPTED_MIME.test(file.type) || ACCEPTED_EXT.test(file.name))
}

/** Valida y limpia los adjuntos que llegan a una ruta (nombre corto, tipo permitido, tamaño real). */
export function sanitizeAttachments(raw: unknown): SupportAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: SupportAttachment[] = []
  for (const a of raw.slice(0, MAX_ATTACHMENTS)) {
    if (!a || typeof a !== "object") continue
    const { name, type, data } = a as Record<string, unknown>
    if (typeof name !== "string" || typeof type !== "string" || typeof data !== "string" || !data.startsWith("data:")) continue
    // El contenido real también debe ser de un tipo permitido (nunca data:text/html ni scripts),
    // en base64. Excel puede llegar sin tipo (application/octet-stream) — vale por la extensión.
    const head = /^data:([a-z0-9.+\/-]*);base64,[A-Za-z0-9+/=]+$/i.exec(data)
    if (!head) continue
    const dataMime = head[1].toLowerCase()
    if (!(ACCEPTED_MIME.test(dataMime) || ((dataMime === "" || dataMime === "application/octet-stream") && ACCEPTED_EXT.test(name)))) continue
    const comma = data.indexOf(",")
    const bytes = comma > 0 ? Math.floor(((data.length - comma - 1) * 3) / 4) : 0
    const clean = { name: name.slice(0, 120), type: type.slice(0, 120), size: bytes, data }
    if (isAcceptedAttachment(clean) && out.reduce((n, x) => n + x.size, 0) + clean.size <= MAX_TOTAL_ATTACHMENT_BYTES) out.push(clean)
  }
  return out
}

// ─── Palomitas de /admin (docs/334) ───

/** Marcas sin migración en product_events (business_id = id de la conversación). */
export const SUPPORT_DELIVERED_EVENT = "support_delivered"
export const SUPPORT_SEEN_EVENT = "support_seen"

export type ReceiptState = "sent" | "delivered" | "seen"
export interface MessageReceipt {
  state: ReceiptState
  /** Primera vez que la app de la persona la recibió / la vio después de mandarla (si se sabe). */
  deliveredAt?: string
  seenAt?: string
}

/**
 * Palomitas de cada respuesta del dueño, como las de WhatsApp (pedido del dueño, docs/334):
 * - una gris = enviada (guardada; el correo y el aviso al aparato ya salieron);
 * - dos grises = recibida: la app de la persona cargó el chat con esa respuesta;
 * - dos de color = vista: abrió el chat.
 * «Vista» sale de `user_unread` (las últimas N respuestas del dueño siguen sin leer; abrir o
 * cerrar el chat lo deja en 0), así que también vale para respuestas de antes de las marcas.
 * Las horas salen de las marcas de product_events; una respuesta vista cuenta como recibida.
 */
export function messageReceipts(
  messages: { id: string; sender: string; created_at: string }[],
  userUnread: number,
  marks: { event_name: string; created_at: string }[],
): Record<string, MessageReceipt> {
  const admin = messages.filter((m) => m.sender === "admin").sort((a, b) => a.created_at.localeCompare(b.created_at))
  const unseenFrom = admin.length - Math.max(0, Math.min(userUnread || 0, admin.length))
  const times = (name: string) =>
    marks
      .filter((m) => m.event_name === name)
      .map((m) => m.created_at)
      .sort()
  const delivered = times(SUPPORT_DELIVERED_EVENT)
  const seen = times(SUPPORT_SEEN_EVENT)
  const firstAfter = (list: string[], at: string) => list.find((x) => new Date(x).getTime() >= new Date(at).getTime())
  const out: Record<string, MessageReceipt> = {}
  admin.forEach((m, i) => {
    const seenAt = i < unseenFrom ? firstAfter(seen, m.created_at) : undefined
    const deliveredAt = firstAfter(delivered, m.created_at) ?? seenAt
    out[m.id] = {
      state: i < unseenFrom ? "seen" : deliveredAt ? "delivered" : "sent",
      ...(deliveredAt ? { deliveredAt } : {}),
      ...(seenAt ? { seenAt } : {}),
    }
  })
  return out
}

// ─── Cierre por inactividad e historial (docs/349) ───

/**
 * Pedido del dueño: «si un chat de asistencia no se sigue por 24 horas, se puede cerrar el
 * caso». Solo se cierra cuando le toca a la PERSONA (el dueño ya respondió, «answered») y pasan
 * 24 horas sin que escriba; una conversación que espera al dueño («waiting») nunca se cierra sola.
 */
export const SUPPORT_AUTO_CLOSE_MS = 24 * 60 * 60 * 1000

/**
 * docs/353: el correo del cierre automático solo sale si el caso es reciente. Los casos viejos
 * que ya estaban sin cerrar se cierran en silencio (sin mensaje ni correo).
 */
export const SUPPORT_AUTO_CLOSE_EMAIL_MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000

export function autoCloseNotifies(lastMessageAt: string, now: number): boolean {
  const t = new Date(lastMessageAt).getTime()
  return Number.isFinite(t) && now - t <= SUPPORT_AUTO_CLOSE_EMAIL_MAX_AGE_MS
}

export function shouldAutoClose(conversation: { status: string; last_message_at: string }, now: number): boolean {
  if (conversation.status !== "answered") return false
  const t = new Date(conversation.last_message_at).getTime()
  return Number.isFinite(t) && now - t >= SUPPORT_AUTO_CLOSE_MS
}

/** La conversación como HTML para el correo: quién, cuándo y qué dijo (todo escapado). */
export function transcriptHtml(
  messages: { sender: string; body: string; attachments?: { name: string }[] | null; created_at: string; translation?: { text?: string } | null }[],
  labels: { you: string; team: string; bot: string; attachments: string },
  formatWhen: (iso: string) => string,
): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  return messages
    .map((m) => {
      const who = m.sender === "user" ? labels.you : m.sender === "admin" ? labels.team : labels.bot
      // Lo del equipo, en el idioma de la persona si se tradujo (docs/252).
      const text = (m.sender === "admin" && m.translation?.text) || m.body || ""
      const files = (m.attachments ?? []).map((a) => a.name).filter(Boolean)
      const filesLine = files.length ? `<br /><span style="color:#8A7D74">📎 ${files.length} ${esc(labels.attachments)}: ${esc(files.join(", "))}</span>` : ""
      return `<p style="margin:0 0 14px"><strong>${esc(who)}</strong> <span style="color:#8A7D74;font-size:12px">· ${esc(formatWhen(m.created_at))}</span><br />${esc(text).replace(/\n/g, "<br />")}${filesLine}</p>`
    })
    .join("")
}
