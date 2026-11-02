/**
 * Respaldos automáticos por cuenta y restauración desde /admin (docs/229).
 *
 * Pedido del dueño: «si a un usuario se le borra todo, poder restaurar al último respaldo
 * de su cuenta, sin que yo vea su información». Antes solo existía el respaldo que la
 * persona descarga como ZIP (lib/backup/export-account-backup.ts); del lado del servidor
 * no había nada que restaurar.
 *
 * Dónde: Supabase Storage, bucket privado `account-backups` (se crea solo; no hace falta
 * migración). Un archivo JSON comprimido por respaldo: `<cuenta>/<fecha>_<motivo>_<hash>_<conteos>.json.gz`.
 * El nombre lleva los conteos, así /admin lista fecha, motivo y cuántos ingredientes,
 * recetas, negocios, menús e inventario hay, sin abrir el contenido.
 *
 * Cuándo:
 * - cada día, en el cron diario, para las cuentas que entraron en las últimas 26 horas
 *   (solo si algo cambió desde el último respaldo: mismo hash = no se repite);
 * - antes de «Borrar todo el contenido» y de «Eliminar cuenta»;
 * - antes de restaurar (así la restauración también se puede deshacer);
 * - a mano desde /admin («Crear respaldo ahora»).
 *
 * Retención: los 5 más recientes, más cualquier respaldo de antes de un borrado o una
 * restauración de los últimos 30 días.
 *
 * Restaurar: deja el contenido que la cuenta POSEE igual al del respaldo. Por tabla,
 * borra las filas propias que no estaban en el respaldo y vuelve a escribir las del
 * respaldo (mismo id). No borra los negocios que sí estaban (así no se arrastran sus
 * miembros de equipo ni invitaciones por el cascade).
 */

import { createHash } from "node:crypto"
import { gzipSync, gunzipSync } from "node:zlib"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

export const SNAPSHOT_BUCKET = "account-backups"

// Orden de escritura: negocios primero (las demás tablas apuntan a ellos).
export const SNAPSHOT_TABLES = [
  "businesses",
  "ingredients",
  "recipes",
  "recipes_trash",
  "inventory_items",
  "inventory_snapshots",
  "menus",
  "purchase_orders",
  "invoices",
  "sales_imports",
  "pos_column_mappings",
  "dish_name_mappings",
] as const
type SnapshotTable = (typeof SNAPSHOT_TABLES)[number]

export type SnapshotReason = "daily" | "manual" | "before_wipe" | "before_delete" | "before_restore"
const REASONS: SnapshotReason[] = ["daily", "manual", "before_wipe", "before_delete", "before_restore"]

export interface SnapshotInfo {
  path: string
  createdAt: string
  reason: SnapshotReason
  hash: string
  counts: { ingredients: number; recipes: number; businesses: number; menus: number; inventory: number }
}

interface SnapshotFile {
  version: 1
  accountId: string
  createdAt: string
  reason: SnapshotReason
  tables: Record<SnapshotTable, Record<string, unknown>[]>
}

const KEEP_LATEST = 5
const KEEP_PROTECTED_DAYS = 30
const PAGE = 1000
const WRITE_CHUNK = 500

type Admin = ReturnType<typeof getSupabaseAdminClient>
const table = (admin: Admin, name: string) => (admin as unknown as { from: (t: string) => any }).from(name)

// ─── nombres de archivo ──────────────────────────────────────────────────────

/** 2026-11-02T10:00:00.000Z → 20261102T100000Z */
const compactDate = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "")
const expandDate = (c: string) =>
  `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}T${c.slice(9, 11)}:${c.slice(11, 13)}:${c.slice(13, 15)}Z`

export function snapshotFileName(info: Omit<SnapshotInfo, "path">): string {
  const c = info.counts
  return `${compactDate(info.createdAt)}_${info.reason}_${info.hash}_${c.ingredients}.${c.recipes}.${c.businesses}.${c.menus}.${c.inventory}.json.gz`
}

export function parseSnapshotFileName(accountId: string, name: string): SnapshotInfo | null {
  const m = /^(\d{8}T\d{6}Z)_([a-z_]+?)_([0-9a-f]{12})_(\d+)\.(\d+)\.(\d+)\.(\d+)\.(\d+)\.json\.gz$/.exec(name)
  if (!m || !REASONS.includes(m[2] as SnapshotReason)) return null
  return {
    path: `${accountId}/${name}`,
    createdAt: expandDate(m[1]),
    reason: m[2] as SnapshotReason,
    hash: m[3],
    counts: { ingredients: +m[4], recipes: +m[5], businesses: +m[6], menus: +m[7], inventory: +m[8] },
  }
}

/** Qué respaldos borrar: quedan los 5 más nuevos y los de antes de un borrado/restauración de los últimos 30 días. */
export function snapshotsToPrune(list: SnapshotInfo[], now = Date.now()): SnapshotInfo[] {
  const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return sorted.filter((s, i) => {
    if (i < KEEP_LATEST) return false
    const isProtected = s.reason !== "daily" && s.reason !== "manual"
    return !(isProtected && now - Date.parse(s.createdAt) < KEEP_PROTECTED_DAYS * 86_400_000)
  })
}

// ─── lectura de la cuenta ────────────────────────────────────────────────────

async function ensureBucket(admin: Admin): Promise<void> {
  const { error } = await admin.storage.getBucket(SNAPSHOT_BUCKET)
  if (!error) return
  const { error: createError } = await admin.storage.createBucket(SNAPSHOT_BUCKET, { public: false })
  if (createError && !/already exists/i.test(createError.message)) throw createError
}

async function readOwnedRows(admin: Admin, name: string, accountId: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await table(admin, name).select("*").eq("owner_id", accountId).order("id").range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data as Record<string, unknown>[]) ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

export async function listAccountSnapshots(accountId: string): Promise<SnapshotInfo[]> {
  const admin = getSupabaseAdminClient()
  await ensureBucket(admin)
  const { data, error } = await admin.storage.from(SNAPSHOT_BUCKET).list(accountId, { limit: 100 })
  if (error) throw error
  return (data ?? [])
    .map((f) => parseSnapshotFileName(accountId, f.name))
    .filter((s): s is SnapshotInfo => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Guarda un respaldo de todo lo que la cuenta posee. Con `skipIfUnchanged`, no guarda nada
 * si el contenido es igual al del último respaldo. Devuelve el respaldo creado o null.
 */
export async function takeAccountSnapshot(
  accountId: string,
  reason: SnapshotReason,
  { skipIfUnchanged = false }: { skipIfUnchanged?: boolean } = {},
): Promise<SnapshotInfo | null> {
  const admin = getSupabaseAdminClient()
  await ensureBucket(admin)
  const tables = {} as SnapshotFile["tables"]
  for (const name of SNAPSHOT_TABLES) tables[name] = await readOwnedRows(admin, name, accountId)

  const hash = createHash("sha256").update(JSON.stringify(tables)).digest("hex").slice(0, 12)
  const existing = await listAccountSnapshots(accountId)
  if (skipIfUnchanged && existing[0]?.hash === hash) return null
  // Una cuenta sin nada que respaldar no genera archivos vacíos cada día.
  const total = SNAPSHOT_TABLES.reduce((n, t) => n + tables[t].length, 0)
  if (total === 0 && reason === "daily") return null

  const createdAt = new Date().toISOString()
  const info: Omit<SnapshotInfo, "path"> = {
    createdAt,
    reason,
    hash,
    counts: {
      ingredients: tables.ingredients.length,
      recipes: tables.recipes.length,
      businesses: tables.businesses.length,
      menus: tables.menus.length,
      inventory: tables.inventory_items.length,
    },
  }
  const file: SnapshotFile = { version: 1, accountId, createdAt, reason, tables }
  const path = `${accountId}/${snapshotFileName(info)}`
  const { error } = await admin.storage
    .from(SNAPSHOT_BUCKET)
    .upload(path, gzipSync(Buffer.from(JSON.stringify(file))), { contentType: "application/gzip", upsert: false })
  if (error) throw error

  const prune = snapshotsToPrune([{ ...info, path }, ...existing])
  if (prune.length > 0) await admin.storage.from(SNAPSHOT_BUCKET).remove(prune.map((s) => s.path))
  return { ...info, path }
}

/** Respaldo «antes de…» que nunca bloquea la acción si falla (se registra en el log). */
export async function snapshotBeforeSafely(accountId: string, reason: SnapshotReason): Promise<void> {
  try {
    await takeAccountSnapshot(accountId, reason)
  } catch (error) {
    console.error(`[account-snapshots] No se pudo respaldar antes de ${reason}:`, error)
  }
}

// ─── restaurar ───────────────────────────────────────────────────────────────

export async function restoreAccountSnapshot(accountId: string, path: string): Promise<{ restored: Record<string, number> }> {
  if (!path.startsWith(`${accountId}/`) || !parseSnapshotFileName(accountId, path.slice(accountId.length + 1))) {
    throw new Error("Respaldo no válido para esta cuenta")
  }
  const admin = getSupabaseAdminClient()
  const { data: blob, error } = await admin.storage.from(SNAPSHOT_BUCKET).download(path)
  if (error || !blob) throw error || new Error("No se pudo leer el respaldo")
  const file = JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString("utf8")) as SnapshotFile
  if (file.version !== 1 || file.accountId !== accountId) throw new Error("El respaldo no es de esta cuenta")

  // El estado actual queda respaldado: la restauración también se puede deshacer.
  await takeAccountSnapshot(accountId, "before_restore")

  // 1. Borrar lo que no estaba en el respaldo (hijos antes que negocios).
  for (const name of [...SNAPSHOT_TABLES].reverse()) {
    const keep = new Set((file.tables[name] ?? []).map((r) => String(r.id)))
    const current = await readOwnedRows(admin, name, accountId)
    const extra = current.map((r) => String(r.id)).filter((id) => !keep.has(id))
    for (let i = 0; i < extra.length; i += WRITE_CHUNK) {
      const { error: delError } = await table(admin, name).delete().eq("owner_id", accountId).in("id", extra.slice(i, i + WRITE_CHUNK))
      if (delError) throw delError
    }
  }
  // 2. Escribir las filas del respaldo (negocios primero).
  const restored: Record<string, number> = {}
  for (const name of SNAPSHOT_TABLES) {
    const rows = (file.tables[name] ?? []).filter((r) => r.owner_id === accountId)
    for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
      const { error: upError } = await table(admin, name).upsert(rows.slice(i, i + WRITE_CHUNK), { onConflict: "id" })
      if (upError) throw upError
    }
    restored[name] = rows.length
  }
  return { restored }
}

// ─── cron diario ─────────────────────────────────────────────────────────────

/** Respalda las cuentas que entraron en las últimas 26 horas, dentro de un tiempo máximo. */
export async function runDailySnapshots(budgetMs = 40_000): Promise<{ done: number; skipped: number; failed: number; pending: number }> {
  const started = Date.now()
  const admin = getSupabaseAdminClient()
  const since = new Date(Date.now() - 26 * 3_600_000).toISOString()
  const { data, error } = await table(admin, "user_presence").select("user_id").gte("last_seen_at", since).limit(500)
  if (error) throw error
  const ids = ((data as { user_id: string }[]) ?? []).map((r) => r.user_id)
  let done = 0
  let skipped = 0
  let failed = 0
  let i = 0
  for (; i < ids.length && Date.now() - started < budgetMs; i++) {
    try {
      const res = await takeAccountSnapshot(ids[i], "daily", { skipIfUnchanged: true })
      if (res) done++
      else skipped++
    } catch (e) {
      failed++
      console.error("[account-snapshots] Falló el respaldo diario de una cuenta:", e)
    }
  }
  return { done, skipped, failed, pending: ids.length - i }
}
