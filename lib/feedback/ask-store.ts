"use client"

/**
 * Estado de «cuándo preguntar» por persona (docs/173), en este navegador. Las reglas
 * puras viven en lib/feedback/ask-rules.ts.
 *
 * Las pantallas avisan un momento de valor con `emitValueMoment("first_pdf")` (un evento
 * de ventana); components/feedback/feedback-orchestrator.tsx lo guarda y decide cuándo
 * preguntar, sin interrumpir lo que la persona está haciendo.
 */

import { emptyAskState, type AskState, type ValueMoment } from "@/lib/feedback/ask-rules"

export const VALUE_MOMENT_EVENT = "gm:value-moment"

export function emitValueMoment(moment: ValueMoment): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(VALUE_MOMENT_EVENT, { detail: { moment } }))
}

const key = (userId: string) => `gm_feedback_ask:${userId}`

export function loadAskState(userId: string): AskState {
  try {
    const raw = window.localStorage.getItem(key(userId))
    if (!raw) return emptyAskState()
    const parsed = JSON.parse(raw) as AskState
    return { moments: parsed.moments || {}, questions: parsed.questions || {}, rating: parsed.rating, lastAskAt: parsed.lastAskAt }
  } catch {
    return emptyAskState()
  }
}

export function saveAskState(userId: string, state: AskState): void {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(state))
  } catch {
    // almacenamiento bloqueado: no se pregunta
  }
}

/** Días distintos con uso (los mismos que ya contaba la encuesta rápida, docs/145). */
export function touchActiveDay(userId: string): number {
  const daysKey = `gm_active_days:${userId}`
  try {
    const today = new Date().toISOString().slice(0, 10)
    const days = JSON.parse(window.localStorage.getItem(daysKey) || "[]") as string[]
    const next = days.includes(today) ? days : [...days, today].slice(-60)
    window.localStorage.setItem(daysKey, JSON.stringify(next))
    return next.length
  } catch {
    return 0
  }
}

/** Migra el estado viejo de la encuesta rápida (docs/145) para no volver a preguntar a quien ya respondió. */
export function migrateLegacyRating(userId: string, state: AskState): AskState {
  if (state.rating) return state
  try {
    const raw = window.localStorage.getItem(`gm_quick_rating:${userId}`)
    if (!raw) return state
    const old = JSON.parse(raw) as { status?: "answered" | "dismissed"; at?: number; dismissals?: number }
    if (!old.status) return state
    return { ...state, rating: { status: old.status, at: old.at ?? Date.now(), shows: old.status === "answered" ? 1 : old.dismissals ?? 1 } }
  } catch {
    return state
  }
}
