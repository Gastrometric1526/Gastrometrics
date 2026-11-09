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

// ─── Guardado con versión y cola sin conexión (docs/275) ─────────────────────────

/** Otro aparato guardó este pedido entre que lo leí y quise guardarlo. */
export class PosConflictError extends Error {
  constructor() {
    super("pos-conflict")
  }
}

/** ¿Falló por la conexión (vale la pena reintentar más tarde)? */
export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true
  const message = String((error as { message?: string })?.message ?? error ?? "")
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout/i.test(message)
}

/** Lee un pedido del servidor (null si ya no existe: se cobró o se liberó). */
export async function fetchPosOrder(id: string): Promise<PosOrder | null> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from("pos_data").select("id, data").eq("id", id).eq("kind", "order").maybeSingle()
  if (error) throw error
  return data ? { ...(data.data as unknown as PosOrder), id: data.id } : null
}

/**
 * Guarda un pedido solo si nadie lo cambió desde la versión `baseRev` (la que leí). Devuelve
 * el pedido con su versión nueva. Si otro aparato ya guardó, lanza `PosConflictError` y quien
 * llama junta los cambios (`mergeOrderEdit`) y vuelve a intentar.
 */
export async function savePosOrderVersioned(order: PosOrder, businessId: string | null | undefined, baseRev: number | null): Promise<PosOrder> {
  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("no-session")
  const next: PosOrder = { ...order, rev: (baseRev ?? 0) + 1 }
  const { id, ...rest } = next
  const row = { kind: "order" as const, updated_at: new Date().toISOString(), data: rest as unknown as Record<string, unknown> }
  let update = supabase.from("pos_data").update(row).eq("id", id)
  update = baseRev === null ? update.is("data->>rev", null) : update.eq("data->>rev", String(baseRev))
  const { data: updated, error } = await update.select("id")
  if (error) throw error
  if (updated && updated.length > 0) return next
  // Nada se actualizó: o el pedido es nuevo, o alguien lo cambió antes.
  const current = await fetchPosOrder(id)
  if (current) throw new PosConflictError()
  if (baseRev !== null) throw new PosConflictError() // ya no existe: se cobró o se liberó en otro aparato
  const { error: insertError } = await supabase
    .from("pos_data")
    .insert({ id, ...row, business_id: toDbBusinessId(businessId), owner_id: user.id })
  if (insertError) {
    if (insertError.code === "23505") throw new PosConflictError()
    throw insertError
  }
  return next
}
