/**
 * Cron diario (Vercel Cron, ver vercel.json) que dispara los 3 correos de activación
 * por comportamiento pedidos en la crítica externa (docs/98, Parte 4.1 punto 7):
 *
 * 1. Recordatorio de primera receta — cuenta creada hace 3 días, todavía sin ninguna
 *    receta creada (activity_log: module="recetas", action="created").
 * 2. Chequeo de margen a los 7 días — cuenta creada hace 7 días, con al menos una
 *    receta creada (si a los 7 días no tiene ninguna receta, ya recibió el
 *    recordatorio del punto 1 — no tiene sentido "tu margen" sin ninguna receta).
 * 3. Refuerzo tras la primera venta — la primera fila de activity_log con
 *    module="estadisticas", action="imported" (ver components/manual-sales-entry-dialog.tsx)
 *    de esa cuenta ocurrió en las últimas 48 horas.
 *
 * Cada envío es idempotente por cuenta vía activation_emails_sent (unique
 * account_id+email_type, ver supabase/migrations/0020) — correr este cron más de una
 * vez el mismo día, o que Vercel reintente una ejecución, nunca duplica un correo.
 *
 * Mismo patrón de autenticación que app/api/cron/keep-alive/route.ts (CRON_SECRET,
 * validado solo si está configurada) y mismo patrón de paginación de listUsers() que
 * app/api/admin/accounts/route.ts.
 */

import { NextResponse } from "next/server"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { sendFirstRecipeReminder, sendDay7MarginCheckin, sendFirstSaleReinforcement } from "@/lib/services/notify-activation"

const DAY_MS = 24 * 60 * 60 * 1000

function isWithinWindow(dateIso: string, minDaysAgo: number, maxDaysAgo: number): boolean {
  const ageMs = Date.now() - new Date(dateIso).getTime()
  return ageMs >= minDaysAgo * DAY_MS && ageMs < maxDaysAgo * DAY_MS
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
    }
  }

  try {
    const admin = getSupabaseAdminClient()

    let allUsers: { id: string; createdAt: string }[] = []
    let listPage = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page: listPage, perPage: 200 })
      if (error) throw error
      allUsers = allUsers.concat(data.users.map((u) => ({ id: u.id, createdAt: u.created_at })))
      if (data.users.length < 200) break
      listPage += 1
    }

    const reminderCandidates = allUsers.filter((u) => isWithinWindow(u.createdAt, 3, 4))
    const day7Candidates = allUsers.filter((u) => isWithinWindow(u.createdAt, 7, 8))

    const { data: recipeCreatedRows, error: recipeError } = await admin
      .from("activity_log")
      .select("user_id")
      .eq("module", "recetas")
      .eq("action", "created")
    if (recipeError) throw recipeError
    const accountsWithRecipe = new Set((recipeCreatedRows ?? []).map((r) => r.user_id))

    const { data: saleRows, error: saleError } = await admin
      .from("activity_log")
      .select("user_id, created_at")
      .eq("module", "estadisticas")
      .eq("action", "imported")
      .order("created_at", { ascending: true })
    if (saleError) throw saleError
    const firstSaleAtByUser = new Map<string, string>()
    for (const row of saleRows ?? []) {
      if (!firstSaleAtByUser.has(row.user_id)) firstSaleAtByUser.set(row.user_id, row.created_at)
    }

    let reminderSent = 0
    for (const u of reminderCandidates) {
      if (!accountsWithRecipe.has(u.id)) {
        await sendFirstRecipeReminder(u.id)
        reminderSent++
      }
    }

    let day7Sent = 0
    for (const u of day7Candidates) {
      if (accountsWithRecipe.has(u.id)) {
        await sendDay7MarginCheckin(u.id)
        day7Sent++
      }
    }

    let firstSaleSent = 0
    for (const [userId, firstSaleAt] of firstSaleAtByUser.entries()) {
      if (isWithinWindow(firstSaleAt, 0, 2)) {
        await sendFirstSaleReinforcement(userId)
        firstSaleSent++
      }
    }

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      reminderCandidates: reminderCandidates.length,
      reminderSent,
      day7Candidates: day7Candidates.length,
      day7Sent,
      firstSaleSent,
    })
  } catch (error) {
    console.error("[api/cron/activation-emails] Error:", error)
    return NextResponse.json({ ok: false, error: "Error corriendo el cron de activación." }, { status: 500 })
  }
}
