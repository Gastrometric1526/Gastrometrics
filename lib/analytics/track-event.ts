// Helper de cliente para app/api/track-event/route.ts — mismo criterio que
// components/analytics-tracker.tsx (fetch en segundo plano, keepalive, nunca bloquea
// ni rompe el flujo real si falla). Se importa donde ocurre cada paso del embudo, no
// se agrega ningún estado global ni contexto nuevo.
import { emitValueMoment } from "@/lib/feedback/ask-store"
import type { ValueMoment } from "@/lib/feedback/ask-rules"

export type ProductEventName =
  | "signup_completed"
  | "first_ingredient_created"
  | "first_recipe_created"
  | "first_pdf_exported"
  | "checkout_started"
  | "upgrade_clicked"

// Momentos de valor para pedir la opinión en el momento justo (docs/173).
const VALUE_MOMENT_BY_EVENT: Partial<Record<ProductEventName, ValueMoment>> = {
  first_ingredient_created: "first_ingredient",
  first_recipe_created: "first_priced_recipe",
  first_pdf_exported: "first_pdf",
}

export function trackEvent(event: ProductEventName, businessId?: string | null) {
  if (typeof window === "undefined") return
  const moment = VALUE_MOMENT_BY_EVENT[event]
  if (moment) emitValueMoment(moment)
  try {
    fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ event, businessId: businessId ?? null }),
    }).catch(() => {})
  } catch {
    // Nunca debe romper el flujo real del usuario por un error de analítica.
  }
}
