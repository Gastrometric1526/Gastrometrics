/**
 * Respuestas a las preguntas cortas (docs/173), para /admin → Reseñas. Solo con sesión de admin.
 * Vienen de activity_log (módulo «encuesta»): por pregunta, cuántas veces se eligió cada
 * opción, el promedio de las escalas y las respuestas de texto más recientes.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { summarizeSurveyAnswers, type SurveyAnswerRow } from "@/lib/feedback/survey-summary"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const { data, error } = await getSupabaseAdminClient()
    .from("activity_log")
    .select("user_id, user_name, metadata, created_at")
    .eq("module", "encuesta")
    .order("created_at", { ascending: false })
    .limit(2000)
  if (error) return NextResponse.json({ error: "No se pudo leer." }, { status: 500 })
  const rows: SurveyAnswerRow[] = (data ?? []).map((r) => {
    const m = (r.metadata || {}) as Record<string, unknown>
    return {
      userId: r.user_id,
      userName: r.user_name,
      question: String(m.question || ""),
      answer: (m.answer as string | null) ?? null,
      detail: (m.detail as string | null) ?? null,
      at: r.created_at,
    }
  })
  return NextResponse.json({ summary: summarizeSurveyAnswers(rows) })
}
