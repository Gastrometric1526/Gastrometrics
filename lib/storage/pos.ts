/**
 * Guardado del POS propio (docs/268) en la tabla `pos_data` (migración 0039). A diferencia
 * del resto de lib/storage no hay caché reactiva: el salón y la cocina se comparten entre
 * aparatos, así que la pantalla vuelve a leer cada pocos segundos (`fetchPosData`).
 * Pedidos: el último en guardar gana (cada cambio guarda el pedido completo).
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { FloorPlan, PosConfig, PosOrder } from "@/types/pos"

const dbId = (businessId?: string | null) => businessId || "main"
const toDbBusinessId = (businessId?: string | null) => (!businessId || businessId === "main" ? null : businessId)

export interface PosData {
  floor: FloorPlan | null
  config: PosConfig | null
  orders: PosOrder[]
  /** La migración 0039 todavía no se corrió en esta base. */
  missingTable: boolean
}

/** Error de «la tabla no existe» (Postgres 42P01 o PostgREST PGRST205). */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === "42P01" || error.code === "PGRST205" || /pos_data/.test(error.message || "") && /exist|find/i.test(error.message || "")
}

export async function fetchPosData(businessId?: string | null): Promise<PosData> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("pos_data").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    if (isMissingTable(error)) return { floor: null, config: null, orders: [], missingTable: true }
    throw error
  }
  const rows = data ?? []
  const floorRow = rows.find((r) => r.kind === "floor")
  const configRow = rows.find((r) => r.kind === "config")
  return {
    floor: floorRow ? (floorRow.data as unknown as FloorPlan) : null,
    config: configRow ? (configRow.data as unknown as PosConfig) : null,
    orders: rows
      .filter((r) => r.kind === "order")
      .map((r) => ({ ...(r.data as unknown as PosOrder), id: r.id }))
      .sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    missingTable: false,
  }
}

async function upsertRow(id: string, kind: "floor" | "config" | "order", data: object, businessId?: string | null): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("no-session")
  const { error } = await supabase.from("pos_data").upsert({
    id,
    kind,
    business_id: toDbBusinessId(businessId),
    owner_id: user.id,
    updated_at: new Date().toISOString(),
    data: data as Record<string, unknown>,
  })
  if (error) throw error
}

export function saveFloorPlan(plan: FloorPlan, businessId?: string | null): Promise<void> {
  return upsertRow(`${dbId(businessId)}::floor`, "floor", plan, businessId)
}

export function savePosConfig(config: PosConfig, businessId?: string | null): Promise<void> {
  return upsertRow(`${dbId(businessId)}::config`, "config", config, businessId)
}

export function savePosOrder(order: PosOrder, businessId?: string | null): Promise<void> {
  const { id, ...rest } = order
  return upsertRow(id, "order", rest, businessId)
}

export async function deletePosOrder(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  const { error } = await supabase.from("pos_data").delete().eq("id", id)
  if (error) throw error
}
