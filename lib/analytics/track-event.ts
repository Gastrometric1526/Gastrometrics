// Helper de cliente para app/api/track-event/route.ts — mismo criterio que
// components/analytics-tracker.tsx (fetch en segundo plano, keepalive, nunca bloquea
// ni rompe el flujo real si falla). Se importa donde ocurre cada paso del embudo, no
// se agrega ningún estado global ni contexto nuevo.
export type ProductEventName =
  | "signup_completed"
  | "first_ingredient_created"
  | "first_recipe_created"
  | "first_pdf_exported"
  | "checkout_started"
  | "upgrade_clicked"

export function trackEvent(event: ProductEventName, businessId?: string | null) {
  if (typeof window === "undefined") return
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
