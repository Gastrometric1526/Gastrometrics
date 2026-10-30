/** Resumen de respuestas a las preguntas cortas (docs/173). Puro, cubierto por pruebas. */

import { QUESTIONS, type QuestionKey } from "@/lib/feedback/ask-rules"

export interface SurveyAnswerRow {
  userId: string
  userName: string
  question: string
  answer: string | null
  detail: string | null
  at: string
}

export interface QuestionSummary {
  question: QuestionKey
  total: number
  /** Opción → cantidad (preguntas de opciones). */
  counts: Record<string, number>
  /** Promedio 1–5 (preguntas de escala). */
  average: number | null
  /** Respuestas de texto (incluye «Otro»), las más recientes primero. */
  texts: { userId: string; userName: string; text: string; at: string }[]
}

export function summarizeSurveyAnswers(rows: SurveyAnswerRow[]): QuestionSummary[] {
  return QUESTIONS.map((q) => {
    const mine = rows.filter((r) => r.question === q.key)
    const counts: Record<string, number> = {}
    let sum = 0
    let n = 0
    for (const r of mine) {
      if (q.kind === "choice" && r.answer) counts[r.answer] = (counts[r.answer] || 0) + 1
      if (q.kind === "scale" && r.answer && !Number.isNaN(Number(r.answer))) {
        sum += Number(r.answer)
        n++
      }
    }
    const texts = mine
      .filter((r) => r.detail && r.detail.trim())
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 20)
      .map((r) => ({ userId: r.userId, userName: r.userName, text: r.detail!.trim(), at: r.at }))
    return { question: q.key, total: mine.length, counts, average: n ? Math.round((sum / n) * 10) / 10 : null, texts }
  })
}
