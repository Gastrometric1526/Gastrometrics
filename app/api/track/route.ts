/**
 * Registra una vista de página real — pedido explícito del dueño del proyecto: quería
 * ver analíticas de tráfico en /admin (ver docs/67), sin depender de Vercel Web
 * Analytics (sin API de lectura en el plan Hobby). Llamada desde
 * components/analytics-tracker.tsx en cada cambio de ruta.
 *
 * Público, sin sesión (cualquier visitante del sitio, logueado o no, dispara esto) —
 * protegido contra abuso con el mismo lib/rate-limit.ts que ya usan /api/checkout,
 * /api/auth/signup, etc. (ver docs/61). No guarda nada identificable: sin cuenta, sin
 * IP, sin identificador persistente entre sesiones.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(`track:${getClientIp(request)}`, {
    maxAttempts: 200,
    windowMs: 10 * 60 * 1000,
    lockoutMs: 15 * 60 * 1000,
  })
  if (!rateLimit.allowed) {
    // Silencioso a propósito: esto lo llama el propio sitio en segundo plano, no una
    // persona llenando un formulario — no hay nada que explicarle a nadie.
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const path = typeof body?.path === "string" ? body.path.trim().slice(0, 300) : ""
  if (!path) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const language = typeof body?.language === "string" ? body.language.slice(0, 10) : null
  const referrer = typeof body?.referrer === "string" ? body.referrer.slice(0, 500) : null

  try {
    const admin = getSupabaseAdminClient()
    await admin.from("page_views").insert({ path, language, referrer })
  } catch (error) {
    console.error("[api/track] Error guardando vista de página:", error)
  }

  return NextResponse.json({ ok: true })
}
