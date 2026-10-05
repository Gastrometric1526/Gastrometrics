/**
 * Recibe un mensaje nuevo de /contacto (sugerencia, queja, o reporte de bug),
 * accesible con o sin sesión iniciada. Reemplaza el guardado directo en
 * localStorage (lib/storage/feedback.ts, ahora sin uso) — se persiste en Supabase
 * con la service role key (ver 0006_feedback.sql para el porqué de no usar RLS por
 * fila aquí: no hay owner_id confiable de quien manda el mensaje) y de paso manda
 * la notificación por correo al dueño del proyecto (ver lib/services/notify-feedback.ts).
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { isFeedbackNotifyConfigured, sendFeedbackNotification } from "@/lib/services/notify-feedback"
import { normalizeEmailLang } from "@/lib/i18n/email-labels"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

const MAX_MESSAGE = 5000
const MAX_IMAGE_DATA_URL = 3_000_000 // ~2.2 MB de imagen (el formulario ya la comprime antes)
const SAFE_IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/

export async function POST(request: Request) {
  // Límite por IP contra spam del formulario público de /contacto (ver docs/61) —
  // manda correo real al dueño del proyecto por cada mensaje, así que también
  // protege eso de un bombardeo.
  const rateLimit = checkRateLimit(`feedback:${getClientIp(request)}`, {
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Demasiados mensajes seguidos. Espera unos minutos e intenta de nuevo." }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const type = body?.type as string | undefined
  const message = (body?.message as string | undefined)?.trim()

  if (!type || !["sugerencia", "queja", "bug", "experiencia"].includes(type) || !message) {
    return NextResponse.json({ error: "Falta type o message válidos." }, { status: 400 })
  }

  // docs/154: topes de tamaño (formulario público: protege la base gratis de 500 MB) y la
  // imagen solo como data URL de imagen — antes se guardaba cualquier texto y /admin lo
  // mostraba como enlace, así que un "javascript:…" se habría ejecutado con la sesión admin.
  const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null)
  const image = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : ""
  if (image && (!SAFE_IMAGE_DATA_URL.test(image) || image.length > MAX_IMAGE_DATA_URL)) {
    return NextResponse.json({ error: "La imagen no es válida o es demasiado grande." }, { status: 400 })
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ error: "El mensaje es demasiado largo." }, { status: 400 })
  }

  const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const admin = getSupabaseAdminClient()
  const baseRow = {
    id,
    type,
    message,
    user_name: text(body?.userName, 200),
    user_email: text(body?.userEmail, 320),
    page: text(body?.page, 300),
    image_data_url: image || null,
  }
  // El idioma activo de quien escribe — se usa después para que la respuesta desde
  // /admin (sendFeedbackReplyEmail) salga en el mismo idioma, ver docs/58. /contacto es
  // público, no siempre hay cuenta/profiles.preferred_language de donde leerlo.
  const { error } = await admin
    .from("feedback")
    .insert({ ...baseRow, preferred_language: normalizeEmailLang(body?.language) })

  if (error) {
    // Tolera que supabase/migrations/0007_preferred_language.sql todavía no se haya
    // corrido contra el proyecto real (columna nueva, ver docs/58) — sin esto, mandar
    // feedback se rompería por completo hasta que alguien corra esa migración a mano.
    if (error.message?.toLowerCase().includes("preferred_language")) {
      const { error: fallbackError } = await admin.from("feedback").insert(baseRow)
      if (fallbackError) {
        console.error("[api/feedback/submit] Error guardando el mensaje (fallback):", fallbackError)
        return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 })
      }
    } else {
      console.error("[api/feedback/submit] Error guardando el mensaje:", error)
      return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 })
    }
  }

  if (isFeedbackNotifyConfigured()) {
    try {
      await sendFeedbackNotification({
        type,
        message,
        userName: body?.userName,
        userEmail: body?.userEmail,
        page: body?.page,
      })
    } catch (notifyError) {
      // No es crítico: el mensaje ya quedó guardado sin importar esto.
      console.error("[api/feedback/submit] Error enviando la notificación:", notifyError)
    }
  }

  return NextResponse.json({ id })
}
