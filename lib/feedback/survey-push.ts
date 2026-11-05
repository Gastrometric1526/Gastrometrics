/** Texto del aviso a /admin cuando alguien responde una pregunta corta (docs/240). Puro. */

import translations from "@/lib/i18n/translations"
import { QUESTIONS, type QuestionKey } from "@/lib/feedback/ask-rules"

export function surveyPushText(input: { question: QuestionKey; answer: string; detail: string; userName: string }): { title: string; body: string } {
  const es = translations.es as Record<string, string>
  const def = QUESTIONS.find((q) => q.key === input.question)
  const option = def?.kind === "choice" && input.answer ? es[`q_${input.question}_opt_${input.answer}`] || input.answer : ""
  const value = def?.kind === "scale" ? `${input.answer} de 5` : option
  const answer = [value, input.detail].filter(Boolean).join(" · ")
  return { title: es[`q_${input.question}_title`] || "Encuesta", body: `${input.userName || "Una cuenta"}: ${answer}` }
}
