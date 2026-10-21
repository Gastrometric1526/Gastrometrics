/**
 * Reseñas internas (docs/173). Puro, cubierto por pruebas.
 *
 * Una opinión se guarda en `feedback` (type "experiencia") con este formato de mensaje:
 *   «[9/10] comentario»                  calificación de la encuesta
 *   «[9/10][publicable] comentario»      la persona dio permiso para mostrarla
 *   «[testimonio][publicable] frase»     respuesta a «¿qué es lo que más te sirve?»
 * Solo se muestra en el sitio si tiene permiso Y el dueño la publicó en /admin.
 */

export const MIN_PUBLISHED_REVIEWS = 3

/** Opinión que se muestra en el sitio (lo que devuelve /api/reviews). */
export interface PublicReview {
  id: string
  name: string
  country: string | null
  businessType: string | null
  score: number | null
  comment: string
  at: string
}

export interface ParsedReview {
  score: number | null
  publishable: boolean
  testimonial: boolean
  comment: string
}

export function parseReviewMessage(message: string): ParsedReview {
  let rest = message.trim()
  let score: number | null = null
  let publishable = false
  let testimonial = false
  for (;;) {
    const m = /^\[([^\]]+)\]\s*/.exec(rest)
    if (!m) break
    const tag = m[1].trim().toLowerCase()
    const s = /^(\d{1,2})\/10$/.exec(tag)
    if (s) score = Math.min(10, Number(s[1]))
    else if (tag === "publicable") publishable = true
    else if (tag === "testimonio") testimonial = true
    else break
    rest = rest.slice(m[0].length)
  }
  const comment = rest === "—" ? "" : rest
  return { score, publishable, testimonial, comment }
}

export function buildReviewMessage(input: { score?: number | null; publishable: boolean; testimonial?: boolean; comment: string }): string {
  const tags = [
    input.testimonial ? "[testimonio]" : "",
    typeof input.score === "number" ? `[${input.score}/10]` : "",
    input.publishable ? "[publicable]" : "",
  ].join("")
  return `${tags} ${input.comment.trim() || "—"}`.trim()
}

/** «Daniel Romero» → «Daniel R.» (para no exponer el apellido completo). */
export function reviewerDisplayName(fullName: string | null | undefined): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

/** Nota 0–10 → estrellas 0–5 (media estrella), para mostrar el promedio. */
export function scoreToStars(score: number): number {
  return Math.round(score) / 2
}
