/**
 * Registra un evento de producto (embudo de activación) — mismo patrón que
 * app/api/track/route.ts (vistas de página), tabla separada (product_events, ver
 * supabase/migrations/0029_product_events.sql). Llamado desde
 * lib/analytics/track-event.ts en los puntos clave del embudo (registro, primer
 * ingrediente, primera receta, primer PDF, inicio de checkout, etc.).
 *
 * Público, sin sesión (algunos eventos ocurren antes de tener cuenta, ej. "empezó el
 * registro") — protegido contra abuso con el mismo lib/rate-limit.ts que ya usa
 * /api/track. No guarda nada identificable: sin cuenta, sin IP, sin identificador
 * persistente entre sesiones — ver el comentario de la migración para el porqué.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// Lista blanca de eventos válidos — evita que esta ruta pública se use para insertar
// texto arbitrario en la base de datos (mismo criterio que activation_emails_sent/
// feedback.type, que también usan check constraints o listas fijas en vez de aceptar
// cualquier string).
const VALID_EVENTS = [
  "signup_completed",
  "first_ingredient_created",
  "first_recipe_created",
  "first_pdf_exported",
  "checkout_started",
  "upgrade_clicked",
] as const

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`track-event:${getClientIp(request)}`, {
    maxAttempts: 100,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    // Silencioso a propósito, mismo criterio que /api/track: esto lo llama el propio
    // sitio en segundo plano, no una persona llenando un formulario.
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const eventName = typeof body?.event === "string" ? body.event.trim() : ""
  if (!VALID_EVENTS.includes(eventName as (typeof VALID_EVENTS)[number])) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const businessId = typeof body?.businessId === "string" ? body.businessId.trim().slice(0, 100) : null

  try {
    const admin = getSupabaseAdminClient()
    await admin.from("product_events").insert({ event_name: eventName, business_id: businessId })
  } catch (error) {
    // No rompe nada visible si la migración 0029 todavía no se corrió en el SQL Editor
    // (tabla inexistente) — mismo criterio de resiliencia que /api/track.
    console.error("[api/track-event] Error guardando evento:", error)
  }

  return NextResponse.json({ ok: true })
}
