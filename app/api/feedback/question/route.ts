/**
 * Respuesta a una pregunta corta (docs/173). Exige sesión: la respuesta queda a nombre de
 * quien la da, en activity_log (módulo «encuesta», acción «answered», sin migración nueva).
 * - «testimonial» también se guarda en el buzón como opinión («[testimonio]»), para que el
 *   dueño pueda publicarla en el sitio si la persona dio permiso.
 * - «improve» (plan por vencer) también llega al buzón como sugerencia.
 * Ambas avisan al dueño por correo, como cualquier mensaje del buzón.
 */

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { QUESTIONS, type QuestionKey } from "@/lib/feedback/ask-rules"
import { buildReviewMessage } from "@/lib/reviews"
import { sendFeedbackNotification } from "@/lib/services/notify-feedback"

export async function POST(request: Request) {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser()
  if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 })

  const limit = checkRateLimit(`question:${user.id}`, { maxAttempts: 10, windowMs: 10 * 60 * 1000, lockoutMs: 15 * 60 * 1000 })
  if (!limit.allowed) return NextResponse.json({ error: "Demasiadas respuestas seguidas." }, { status: 429 })

  const body = await request.json().catch(() => null)
  const question = body?.question as QuestionKey
  const def = QUESTIONS.find((q) => q.key === question)
  if (!def) return NextResponse.json({ error: "Pregunta desconocida." }, { status: 400 })
  const answer = typeof body?.answer === "string" ? body.answer.slice(0, 40) : typeof body?.answer === "number" ? String(body.answer) : ""
  const detail = typeof body?.detail === "string" ? body.detail.trim().slice(0, 1000) : ""
  const consent = body?.consent === true
  if (!answer && !detail) return NextResponse.json({ error: "Respuesta vacía." }, { status: 400 })
  if (def.kind === "choice" && answer && !def.options?.includes(answer)) return NextResponse.json({ error: "Opción inválida." }, { status: 400 })

  const admin = getSupabaseAdminClient()
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
  const userName = profile?.full_name || user.email || ""

  const { error } = await admin.from("activity_log").insert({
    business_id: null,
    user_id: user.id,
    user_name: userName,
    module: "encuesta",
    action: "answered",
    entity_label: question,
    metadata: { question, answer: answer || null, detail: detail || null, consent: def.askConsent ? consent : undefined },
    is_notification: false,
  })
  if (error) {
    console.error("[api/feedback/question] Error guardando la respuesta:", error)
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 })
  }

  if ((question === "testimonial" || question === "improve") && detail) {
    const type = question === "testimonial" ? "experiencia" : "sugerencia"
    const message =
      question === "testimonial"
        ? buildReviewMessage({ testimonial: true, publishable: consent, comment: detail })
        : `[encuesta: plan por vencer] ${detail}`
    const id = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { error: fbError } = await admin.from("feedback").insert({
      id,
      type,
      message,
      user_name: userName || null,
      user_email: user.email || null,
      page: `pregunta corta: ${question}`,
      image_data_url: null,
      preferred_language: "es",
    })
    if (fbError) console.error("[api/feedback/question] Error guardando en el buzón:", fbError)
    else {
      try {
        await sendFeedbackNotification({
          type,
          message,
          userName: userName || undefined,
          userEmail: user.email || undefined,
          page: `pregunta corta: ${question}`,
        })
      } catch (notifyError) {
        console.error("[api/feedback/question] Error avisando al dueño:", notifyError)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
