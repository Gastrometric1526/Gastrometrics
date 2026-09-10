/**
 * Tasa de activación y tiempo a primer valor — pedido derivado de
 * referencia-estrategia-crecimiento-y-psicologia-del-usuario.md (docs/): sin esto no
 * hay forma de saber, con datos, qué porcentaje de cuentas nuevas llega a crear su
 * primera receta ni cuánto tardan, así que cualquier cambio de onboarding (ver docs/96)
 * es una apuesta a ciegas.
 *
 * No hace falta instrumentación nueva: technical-sheet/index.tsx ya llama a
 * logActivity({ module: "recetas", action: "created" }) cada vez que se guarda una
 * receta nueva (ver lib/services/activity-log.ts). Esta ruta solo cruza esas filas
 * contra la fecha de alta de cada cuenta (auth.users.created_at) — mismo patrón de
 * "traer todo y agregar en memoria" que /api/admin/analytics y /api/admin/accounts,
 * aceptado a esta escala.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdminClient()

    // Mismo bucle de paginación que /api/admin/accounts — listUsers() no tiene un
    // "traer todas" directo.
    let allUsers: { id: string; email: string; createdAt: string }[] = []
    let listPage = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page: listPage, perPage: 200 })
      if (error) throw error
      allUsers = allUsers.concat(
        data.users.map((u) => ({ id: u.id, email: u.email || "", createdAt: u.created_at })),
      )
      if (data.users.length < 200) break
      listPage += 1
    }

    const { data: recipeCreatedRows, error: activityError } = await admin
      .from("activity_log")
      .select("user_id, created_at")
      .eq("module", "recetas")
      .eq("action", "created")
      .order("created_at", { ascending: true })
    if (activityError) throw activityError

    // Primera fila por cuenta — las filas ya vienen ordenadas ascendente, así que la
    // primera vez que se ve un user_id es su primera receta creada.
    const firstRecipeAtByUser = new Map<string, string>()
    for (const row of recipeCreatedRows ?? []) {
      if (!firstRecipeAtByUser.has(row.user_id)) {
        firstRecipeAtByUser.set(row.user_id, row.created_at)
      }
    }

    const hoursToActivation: number[] = []
    const accounts = allUsers
      .map((u) => {
        const firstRecipeAt = firstRecipeAtByUser.get(u.id) ?? null
        const hours = firstRecipeAt
          ? (new Date(firstRecipeAt).getTime() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60)
          : null
        if (hours !== null && hours >= 0) hoursToActivation.push(hours)
        return { email: u.email, createdAt: u.createdAt, firstRecipeAt, hoursToActivation: hours }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    const totalAccounts = allUsers.length
    const activatedAccounts = firstRecipeAtByUser.size

    return NextResponse.json({
      totalAccounts,
      activatedAccounts,
      activationRatePercent: totalAccounts > 0 ? Math.round((activatedAccounts / totalAccounts) * 1000) / 10 : 0,
      medianHoursToActivation: median(hoursToActivation),
      recentAccounts: accounts.slice(0, 25),
    })
  } catch (error) {
    console.error("[api/admin/activation] Error calculando activación:", error)
    return NextResponse.json({ error: "No se pudo calcular la activación." }, { status: 500 })
  }
}
