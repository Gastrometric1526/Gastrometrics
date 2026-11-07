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
 * Retención (pedido del dueño, docs/252): de 3 a 6 meses, sin que nadie haga nada.
 * - todos los de los últimos 14 días;
 * - de 14 a 90 días, el más nuevo de cada semana;
 * - de 90 a 180 días, el más nuevo de cada mes;
 * - los de antes de un borrado o una restauración, los 180 días completos;
 * - nada pasa de 180 días. El cron diario poda también las cuentas eliminadas.
 *
 * Cuenta eliminada: antes de eliminarla se guarda `<cuenta>/cuenta.json` con su correo, para
 * encontrar sus respaldos después. Se borra junto con el último respaldo.
 *
 * Cuándo se puede restaurar (pedido del dueño, docs/252): solo si la cuenta borró su
 * contenido, pidió eliminarse o ya fue eliminada. Una cuenta eliminada se restaura en la
 * cuenta nueva de la misma persona: las filas pasan a ser de esa cuenta.
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
const DAY = 86_400_000
export const MAX_KEEP_DAYS = 180
const KEEP_ALL_DAYS = 14
const WEEKLY_UNTIL_DAYS = 90
export const IDENTITY_FILE = "cuenta.json"
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

/**
 * Qué respaldos borrar (docs/252): todos los de 14 días, uno por semana hasta 90 días, uno por
 * mes hasta 180, los de antes de un borrado o una restauración hasta 180, y nada más viejo.
 * Los 5 más nuevos siempre quedan si tienen menos de 180 días.
 */
export function snapshotsToPrune(list: SnapshotInfo[], now = Date.now()): SnapshotInfo[] {
  const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const seen = new Set<string>()
  return sorted.filter((s, i) => {
    const age = (now - Date.parse(s.createdAt)) / DAY
    if (age > MAX_KEEP_DAYS) return true
    const bucket = age <= WEEKLY_UNTIL_DAYS ? `w${Math.floor(age / 7)}` : `m${Math.floor(age / 30)}`
    const keep = i < KEEP_LATEST || age <= KEEP_ALL_DAYS || (s.reason !== "daily" && s.reason !== "manual")
    if (keep || !seen.has(bucket)) {
      if (s.reason === "daily" || s.reason === "manual") seen.add(bucket)
      return false
    }
    return true
  })
}

/** Se puede restaurar si la cuenta borró su contenido, pidió eliminarse o ya no existe. Puro. */
export function restoreAllowed(input: { exists: boolean; deletionRequested: boolean; snapshots: SnapshotInfo[] }): boolean {
  if (!input.exists || input.deletionRequested) return true
  return input.snapshots.some((s) => s.reason === "before_wipe" || s.reason === "before_delete")
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
  const { data, error } = await admin.storage.from(SNAPSHOT_BUCKET).list(accountId, { limit: 500 })
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

/** Guarda el correo de una cuenta antes de eliminarla, para encontrar sus respaldos después. */
export async function rememberAccountIdentity(accountId: string, identity: { email: string | null; name?: string | null }): Promise<void> {
  try {
    const admin = getSupabaseAdminClient()
    await ensureBucket(admin)
    const body = JSON.stringify({ email: (identity.email || "").toLowerCase(), name: identity.name || null, savedAt: new Date().toISOString() })
    await admin.storage.from(SNAPSHOT_BUCKET).upload(`${accountId}/${IDENTITY_FILE}`, Buffer.from(body), { contentType: "application/json", upsert: true })
  } catch (error) {
    console.error("[account-snapshots] No se pudo guardar el correo de la cuenta:", error)
  }
}

/** Busca la cuenta eliminada (o por eliminar) con ese correo entre los respaldos. */
export async function findDeletedAccountByEmail(email: string): Promise<{ accountId: string; savedAt: string | null } | null> {
  const admin = getSupabaseAdminClient()
  await ensureBucket(admin)
  const wanted = email.trim().toLowerCase()
  const storage = admin.storage.from(SNAPSHOT_BUCKET)
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await storage.list("", { limit: 100, offset, sortBy: { column: "name", order: "asc" } })
    if (error) throw error
    for (const folder of data ?? []) {
      const { data: blob } = await storage.download(`${folder.name}/${IDENTITY_FILE}`)
      if (!blob) continue
      const identity = JSON.parse(await blob.text()) as { email?: string; savedAt?: string }
      if (identity.email === wanted) return { accountId: folder.name, savedAt: identity.savedAt ?? null }
    }
    if (!data || data.length < 100) return null
  }
}

/** Estado de la cuenta para decidir si se puede restaurar. */
export async function accountRestoreState(accountId: string): Promise<{ exists: boolean; deletionRequested: boolean }> {
  const admin = getSupabaseAdminClient()
  const { data } = await admin.auth.admin.getUserById(accountId)
  if (!data?.user) return { exists: false, deletionRequested: false }
  const { data: profile } = await admin.from("profiles").select("deletion_requested_at").eq("id", accountId).maybeSingle()
  return { exists: true, deletionRequested: Boolean(profile?.deletion_requested_at) }
}

/**
 * Deja el contenido de `targetId` igual al respaldo de `sourceId`. Con una cuenta eliminada,
 * el destino es la cuenta nueva de la misma persona y las filas pasan a ser de ella.
 */
export async function restoreAccountSnapshot(
  sourceId: string,
  path: string,
  targetId: string = sourceId,
): Promise<{ restored: Record<string, number> }> {
  if (!path.startsWith(`${sourceId}/`) || !parseSnapshotFileName(sourceId, path.slice(sourceId.length + 1))) {
    throw new Error("Respaldo no válido para esta cuenta")
  }
  const source = await accountRestoreState(sourceId)
  if (targetId !== sourceId && source.exists && !source.deletionRequested) {
    throw new Error("Solo se puede pasar a otra cuenta el respaldo de una cuenta eliminada")
  }
  if (!restoreAllowed({ ...source, snapshots: await listAccountSnapshots(sourceId) })) {
    throw new Error("Esta cuenta no borró su contenido ni se eliminó")
  }
  const admin = getSupabaseAdminClient()
  const { data: blob, error } = await admin.storage.from(SNAPSHOT_BUCKET).download(path)
  if (error || !blob) throw error || new Error("No se pudo leer el respaldo")
  const file = JSON.parse(gunzipSync(Buffer.from(await blob.arrayBuffer())).toString("utf8")) as SnapshotFile
  if (file.version !== 1 || file.accountId !== sourceId) throw new Error("El respaldo no es de esta cuenta")

  // El estado actual del destino queda respaldado: la restauración también se puede deshacer.
  await takeAccountSnapshot(targetId, "before_restore")

  // 1. Borrar del destino lo que no estaba en el respaldo (hijos antes que negocios).
  for (const name of [...SNAPSHOT_TABLES].reverse()) {
    const keep = new Set((file.tables[name] ?? []).map((r) => String(r.id)))
    const current = await readOwnedRows(admin, name, targetId)
    const extra = current.map((r) => String(r.id)).filter((id) => !keep.has(id))
    for (let i = 0; i < extra.length; i += WRITE_CHUNK) {
      const { error: delError } = await table(admin, name).delete().eq("owner_id", targetId).in("id", extra.slice(i, i + WRITE_CHUNK))
      if (delError) throw delError
    }
  }
  // 2. Escribir las filas del respaldo (negocios primero), como filas del destino.
  const restored: Record<string, number> = {}
  for (const name of SNAPSHOT_TABLES) {
    const rows = (file.tables[name] ?? []).filter((r) => r.owner_id === sourceId).map((r) => ({ ...r, owner_id: targetId }))
    for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
      const { error: upError } = await table(admin, name).upsert(rows.slice(i, i + WRITE_CHUNK), { onConflict: "id" })
      if (upError) throw upError
    }
    restored[name] = rows.length
  }
  return { restored }
}

/** Poda los respaldos de todas las cuentas, también las eliminadas (cron diario). */
export async function pruneAllSnapshots(budgetMs = 12_000): Promise<{ folders: number; removed: number }> {
  const started = Date.now()
  const admin = getSupabaseAdminClient()
  await ensureBucket(admin)
  const storage = admin.storage.from(SNAPSHOT_BUCKET)
  let folders = 0
  let removed = 0
  for (let offset = 0; Date.now() - started < budgetMs; offset += 100) {
    const { data, error } = await storage.list("", { limit: 100, offset, sortBy: { column: "name", order: "asc" } })
    if (error) throw error
    for (const folder of data ?? []) {
      if (Date.now() - started >= budgetMs) break
      folders++
      const snapshots = await listAccountSnapshots(folder.name)
      const prune = snapshotsToPrune(snapshots)
      const paths = prune.map((s) => s.path)
      if (snapshots.length === prune.length) paths.push(`${folder.name}/${IDENTITY_FILE}`)
      if (paths.length > 0) {
        await storage.remove(paths)
        removed += prune.length
      }
    }
    if (!data || data.length < 100) break
  }
  return { folders, removed }
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
