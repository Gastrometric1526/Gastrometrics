/**
 * Log real de actividad y notificaciones (supabase/migrations/0017_activity_log.sql)
 * — reemplaza lib/activity-tracker.ts (localStorage, aislado por navegador) en las
 * tarjetas "Actividad reciente"/"Notificaciones" del Dashboard y de /business/[id].
 * Ver docs/87.
 *
 * Las filas se guardan SIN texto resuelto (module/action + entity_label/metadata en
 * bruto) — el texto se arma en el componente con t("activity_tpl_...") para que cada
 * integrante del equipo lo lea en su propio idioma, no en el idioma de quien lo
 * escribió.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { Database } from "@/types/database"

export type ActivityModule =
  | "dashboard"
  | "ficha_tecnica"
  | "recetas"
  | "ingredientes"
  | "inventario"
  | "equipo"
  | "menus"
  | "ordenes_compra"
  | "estadisticas"
  | "negocios"
  | "merma"

export type ActivityAction =
  | "entered"
  | "created"
  | "updated"
  | "deleted"
  | "activated"
  | "deactivated"
  | "imported"
  | "invited"
  | "removed"
  | "access_updated"

export interface ActivityLogEntry {
  id: number
  businessId: string | null
  userId: string
  userName: string
  module: ActivityModule
  action: ActivityAction
  entityLabel: string | null
  metadata: Record<string, unknown> | null
  isNotification: boolean
  createdAt: string
}

type ActivityLogRow = Database["public"]["Tables"]["activity_log"]["Row"]

function rowToEntry(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    userName: row.user_name,
    module: row.module as ActivityModule,
    action: row.action as ActivityAction,
    entityLabel: row.entity_label,
    metadata: (row.metadata as Record<string, unknown>) || null,
    isNotification: row.is_notification,
    createdAt: row.created_at,
  }
}

// Acciones que además cuentan como "pop-up de confirmación" (Notificaciones) — todo
// menos "entered", que es puramente Actividad (entrar a un módulo no dispara ningún
// toast).
const NOTIFICATION_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  "created",
  "updated",
  "deleted",
  "activated",
  "deactivated",
  "imported",
  "invited",
  "removed",
  "access_updated",
])

/**
 * Registra un evento real. Fire-and-forget deliberado (no se espera desde los
 * call sites junto al toast()) — un fallo acá nunca debe bloquear ni revertir la
 * acción real que el usuario ya completó.
 */
export function logActivity(params: {
  user: { id: string; name?: string; email: string }
  businessId: string | null
  module: ActivityModule
  action: ActivityAction
  entityLabel?: string
  metadata?: Record<string, unknown>
}): void {
  const supabase = getSupabaseBrowserClient()
  supabase
    .from("activity_log")
    .insert({
      business_id: params.businessId,
      user_id: params.user.id,
      user_name: params.user.name || params.user.email,
      module: params.module,
      action: params.action,
      entity_label: params.entityLabel || null,
      metadata: params.metadata || null,
      is_notification: NOTIFICATION_ACTIONS.has(params.action),
    })
    .then(({ error }) => {
      if (error) console.error("[activity-log] Error guardando evento:", error)
    })
}

/**
 * Trae el log real para un conjunto de negocios. `includeGlobalForUserId` agrega
 * también los eventos de cuenta (equipo, negocios) del usuario dado — úsalo en vistas
 * que agregan varios negocios (Dashboard); omítelo en la vista de UN solo negocio
 * (/business/[id]), donde solo debe verse lo que pasó en ese negocio. notificationsOnly
 * filtra a is_notification=true — así "Notificaciones" es un filtro sobre esta misma
 * tabla, no un sistema aparte.
 */
export async function getActivityLog(params: {
  businessIds: string[]
  includeGlobalForUserId?: string
  notificationsOnly?: boolean
  limit?: number
}): Promise<ActivityLogEntry[]> {
  const supabase = getSupabaseBrowserClient()
  const limit = params.limit ?? 30

  let query = supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (params.notificationsOnly) {
    query = query.eq("is_notification", true)
  }

  const businessFilter =
    params.businessIds.length > 0
      ? `business_id.in.(${params.businessIds.map((id) => `"${id}"`).join(",")})`
      : null

  if (params.includeGlobalForUserId) {
    const globalFilter = `and(business_id.is.null,user_id.eq.${params.includeGlobalForUserId})`
    query = query.or(businessFilter ? `${businessFilter},${globalFilter}` : globalFilter)
  } else if (businessFilter) {
    query = query.or(businessFilter)
  } else {
    return []
  }

  const { data, error } = await query
  if (error) {
    console.error("[activity-log] Error cargando el log:", error)
    return []
  }
  return (data ?? []).map(rowToEntry)
}

// Reutiliza las claves nav_* que ya existen (components/sidebar.tsx) para el nombre
// de cada módulo, en vez de duplicar traducciones — ver docs/87.
const MODULE_NAV_KEY: Record<ActivityModule, string> = {
  dashboard: "nav_dashboard",
  ficha_tecnica: "nav_ficha_tecnica",
  recetas: "nav_mis_recetas",
  ingredientes: "nav_ingredientes",
  inventario: "nav_inventario",
  equipo: "nav_equipo",
  menus: "nav_menus",
  ordenes_compra: "nav_ordenes_compra",
  estadisticas: "nav_estadisticas",
  negocios: "nav_negocios",
  merma: "nav_ingredientes",
}

/**
 * Arma el texto legible de una fila, en el idioma de quien la está viendo — nunca en
 * el idioma de quien la escribió (las filas se guardan sin texto resuelto, ver arriba).
 */
export function formatActivityEntry(entry: ActivityLogEntry, t: (key: any) => string): string {
  const module = t(MODULE_NAV_KEY[entry.module] || "nav_dashboard")
  const entity = entry.entityLabel || ""
  const count = entry.metadata?.count != null ? String(entry.metadata.count) : ""

  switch (entry.action) {
    case "entered":
      return t("activity_tpl_entered").replace("{user}", entry.userName).replace("{module}", module)
    case "created":
      return t("activity_tpl_created").replace("{user}", entry.userName).replace("{entity}", entity).replace("{module}", module)
    case "updated":
      return t("activity_tpl_updated").replace("{user}", entry.userName).replace("{entity}", entity).replace("{module}", module)
    case "deleted":
      return t("activity_tpl_deleted").replace("{user}", entry.userName).replace("{entity}", entity).replace("{module}", module)
    case "imported":
      return t("activity_tpl_imported").replace("{user}", entry.userName).replace("{count}", count).replace("{module}", module)
    case "activated":
      return t("activity_tpl_merma_activated").replace("{user}", entry.userName)
    case "deactivated":
      return t("activity_tpl_merma_deactivated").replace("{user}", entry.userName)
    case "invited":
      return t("activity_tpl_invited").replace("{user}", entry.userName).replace("{entity}", entity)
    case "removed":
      return t("activity_tpl_removed").replace("{user}", entry.userName).replace("{entity}", entity)
    case "access_updated":
      return t("activity_tpl_access_updated").replace("{user}", entry.userName).replace("{entity}", entity)
    default:
      return entry.userName
  }
}
