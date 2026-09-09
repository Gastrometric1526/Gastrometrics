/**
 * Salud/actividad real de negocios — pedido explícito del dueño del proyecto: "si ves
 * otras cosas que crees que debería poder ver desde /admin, agrégalas". Hoy no hay
 * ninguna vista que agrupe negocios "dormidos" (sin ninguna acción reciente de nadie),
 * solo se nota abriendo una cuenta puntual desde Cuentas.
 *
 * Señal de actividad: activity_log.business_id (supabase/migrations/0017_activity_log.sql,
 * ver docs/87) ya registra "entró a tal módulo" y toda acción real (crear/editar/
 * eliminar/importar/etc.) de cualquier persona con acceso al negocio — es la misma
 * fuente que alimenta la tarjeta "Actividad reciente" de /business/[id], así que "sin
 * fila reciente ahí" es una señal real de que nadie ha tocado ese negocio, no una
 * aproximación.
 *
 * Relacionado con el hallazgo sin resolver de docs/93 (sección 4): un negocio de
 * prueba desapareció de /negocios tras reiniciar el servidor de desarrollo, con sus
 * recetas/ingredientes todavía intactos. No se investigó esa causa aquí (es tangencial
 * y no se pudo reproducir solo leyendo código, ver lib/storage/businesses.ts) — esta
 * vista ayuda a *detectar* si vuelve a pasar (un negocio que deja de aparecer en
 * Actividad de un día para otro), no a explicar por qué pasó la primera vez.
 *
 * Solo se devuelven negocios "dormidos" (sin actividad en los últimos DORMANT_DAYS
 * días, o nunca) y activos (isActive !== false) — uno que el propio dueño ya
 * desactivó a mano no es una alerta, es una decisión ya tomada.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

const DORMANT_DAYS = 30
const DORMANT_MS = DORMANT_DAYS * 24 * 60 * 60 * 1000

export async function GET() {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  }

  try {
    const admin = getSupabaseAdminClient()

    const [{ data: businessRows, error: businessError }, { data: activityRows, error: activityError }] =
      await Promise.all([
        admin.from("businesses").select("id, name, owner_id, created_at, data"),
        admin.from("activity_log").select("business_id, created_at").not("business_id", "is", null),
      ])
    if (businessError) throw businessError
    if (activityError) throw activityError

    const lastActivityByBusiness = new Map<string, string>()
    for (const row of activityRows ?? []) {
      if (!row.business_id) continue
      const prev = lastActivityByBusiness.get(row.business_id)
      if (!prev || row.created_at > prev) lastActivityByBusiness.set(row.business_id, row.created_at)
    }

    // Correo del dueño de cada negocio — mismo patrón de paginación en memoria que ya
    // usa el resto de /admin (no hay endpoint de Supabase Auth para buscar varios IDs
    // a la vez).
    const emailByUserId = new Map<string, string>()
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      for (const u of data.users) {
        if (u.email) emailByUserId.set(u.id, u.email)
      }
      if (data.users.length < 200) break
      page += 1
    }

    const now = Date.now()
    const dormant = (businessRows ?? [])
      .filter((row) => (row.data as { isActive?: boolean })?.isActive !== false)
      .map((row) => {
        const lastActivityAt = lastActivityByBusiness.get(row.id) || null
        const referenceMs = new Date(lastActivityAt || row.created_at).getTime()
        const daysSinceActivity = Math.floor((now - referenceMs) / (24 * 60 * 60 * 1000))
        return {
          id: row.id,
          name: row.name,
          ownerEmail: emailByUserId.get(row.owner_id) || row.owner_id,
          createdAt: row.created_at,
          lastActivityAt,
          daysSinceActivity,
        }
      })
      .filter((b) => now - new Date(b.lastActivityAt || b.createdAt).getTime() >= DORMANT_MS)
      .sort((a, b) => new Date(a.lastActivityAt || a.createdAt).getTime() - new Date(b.lastActivityAt || b.createdAt).getTime())

    return NextResponse.json({
      businesses: dormant,
      totalBusinesses: (businessRows ?? []).length,
      dormantCount: dormant.length,
      dormantThresholdDays: DORMANT_DAYS,
    })
  } catch (error) {
    console.error("[api/admin/business-health] Error calculando salud de negocios:", error)
    return NextResponse.json({ error: "No se pudo calcular la salud de los negocios." }, { status: 500 })
  }
}
