/**
 * FEEDBACK STORAGE MODULE
 * Sugerencias, quejas y reportes de errores que los usuarios envían desde /contacto.
 * Es una lista GLOBAL (no por negocio) — se guarda sin businessId a propósito, para que
 * el panel administrativo (app/admin) pueda leer la misma lista sin importar en qué
 * negocio estaba el usuario cuando la envió.
 */

import type { Feedback, FeedbackType } from "@/types/feedback"
import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"

export function getFeedback(): Feedback[] {
  return getFromStorage<Feedback[]>(STORAGE_KEYS.FEEDBACK) || []
}

export function submitFeedback(input: {
  type: FeedbackType
  message: string
  userName?: string
  userEmail?: string
  page?: string
  imageDataUrl?: string
}): Feedback {
  const entry: Feedback = {
    id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    message: input.message.trim(),
    userName: input.userName?.trim() || undefined,
    userEmail: input.userEmail?.trim() || undefined,
    page: input.page,
    imageDataUrl: input.imageDataUrl,
    status: "nuevo",
    createdAt: new Date().toISOString(),
  }

  const all = getFeedback()
  saveToStorage(STORAGE_KEYS.FEEDBACK, [entry, ...all])

  return entry
}

export function updateFeedbackStatus(id: string, status: Feedback["status"]): void {
  const all = getFeedback()
  const updated = all.map((f) => (f.id === id ? { ...f, status } : f))
  saveToStorage(STORAGE_KEYS.FEEDBACK, updated)
}

export function deleteFeedback(id: string): void {
  const all = getFeedback()
  saveToStorage(
    STORAGE_KEYS.FEEDBACK,
    all.filter((f) => f.id !== id),
  )
}
