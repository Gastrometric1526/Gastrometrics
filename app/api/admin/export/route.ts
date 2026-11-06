/**
 * /admin → «Exportar todo» (pedido del dueño, docs/250). GET entrega una página de una fuente;
 * el navegador las junta en un ZIP, porque Vercel corta las respuestas de 4.5 MB. POST deja
 * constancia de la descarga y avisa a los aparatos de /admin. Solo con sesión de admin.
 */

import { NextResponse } from "next/server"
import { hasAdminSession } from "@/lib/admin-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client"
import { BUCKET as PUSH_BUCKET, readConfig, sendAdminPush } from "@/lib/services/admin-push"
import { SNAPSHOT_BUCKET } from "@/lib/services/account-snapshots"
import {
  AUTH_USER_FIELDS,
  EXPORT_SOURCES,
  EXPORT_TABLES,
  pick,
  rowsThatFit,
  withoutHiddenColumns,
  type ExportRow,
} from "@/lib/admin/data-export"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const PAGE = 200
const MAX_BYTES = 3_000_000

interface Page {
  rows: ExportRow[]
  /** Con qué seguir; null si no hay más. */
  next: string | null
  total?: number | null
}

// El nombre de la tabla es variable y los tipos de Supabase solo aceptan nombres fijos.
type LooseQuery = {
  select: (columns: string, options?: { count: "exact"; head: true }) => LooseQuery
  order: (column: string, options: { ascending: boolean }) => LooseQuery
  range: (from: number, to: number) => Promise<{ data: ExportRow[] | null; error: { message: string } | null }>
  then: Promise<{ count: number | null; error: { message: string } | null }>["then"]
}

async function tablePage(name: string, order: string[], cursor: string | null): Promise<Page> {
  const admin = getSupabaseAdminClient() as unknown as { from: (table: string) => LooseQuery }
  const offset = Number(cursor) || 0
  let query = admin.from(name).select("*")
  for (const column of order) query = query.order(column, { ascending: true })
  const { data, error } = await query.range(offset, offset + PAGE - 1)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const fit = rowsThatFit(rows, MAX_BYTES)
  let total: number | null | undefined
  if (offset === 0) {
    const counted = await admin.from(name).select("*", { count: "exact", head: true })
    if (counted.error) throw new Error(counted.error.message)
    total = counted.count
  }
  const more = fit < rows.length || rows.length === PAGE
  return { rows: withoutHiddenColumns(name, rows.slice(0, fit)), next: more ? String(offset + fit) : null, total }
}

async function authPage(cursor: string | null): Promise<Page> {
  const page = Number(cursor) || 1
  const { data, error } = await getSupabaseAdminClient().auth.admin.listUsers({ page, perPage: PAGE })
  if (error) throw error
  return {
    rows: data.users.map((user) => pick(user, AUTH_USER_FIELDS)),
    next: data.users.length === PAGE ? String(page + 1) : null,
  }
}

const STRIPE_FIELDS = {
  customers: ["id", "email", "name", "created", "currency", "balance", "delinquent", "metadata", "livemode"],
  subscriptions: ["id", "customer", "status", "created", "start_date", "cancel_at", "canceled_at", "cancel_at_period_end", "ended_at", "trial_end", "currency", "metadata", "livemode"],
  invoices: ["id", "number", "customer", "customer_email", "status", "created", "currency", "subtotal", "total", "amount_due", "amount_paid", "amount_remaining", "billing_reason", "period_start", "period_end", "metadata", "livemode"],
  charges: ["id", "customer", "receipt_email", "amount", "amount_refunded", "currency", "status", "paid", "refunded", "created", "description", "failure_code", "failure_message", "livemode"],
}

async function stripePage(kind: keyof typeof STRIPE_FIELDS, cursor: string | null): Promise<Page> {
  if (!isStripeConfigured()) return { rows: [], next: null }
  const stripe = getStripeClient()
  const params = { limit: 100, ...(cursor ? { starting_after: cursor } : {}) }
  const list =
    kind === "customers"
      ? await stripe.customers.list(params)
      : kind === "subscriptions"
        ? await stripe.subscriptions.list({ ...params, status: "all" })
        : kind === "invoices"
          ? await stripe.invoices.list(params)
          : await stripe.charges.list(params)
  const last = list.data[list.data.length - 1]
  return {
    rows: list.data.map((item) => pick(item, STRIPE_FIELDS[kind])),
    next: list.has_more && last ? last.id ?? null : null,
  }
}

/** Lista de respaldos por cuenta. Los archivos son copias de estas mismas tablas. */
async function backupsPage(cursor: string | null): Promise<Page> {
  const storage = getSupabaseAdminClient().storage.from(SNAPSHOT_BUCKET)
  const offset = Number(cursor) || 0
  const limit = 25
  const { data: folders, error } = await storage.list("", { limit, offset, sortBy: { column: "name", order: "asc" } })
  if (error) return { rows: [], next: null }
  const rows: ExportRow[] = []
  for (const folder of folders ?? []) {
    const { data: files } = await storage.list(folder.name, { limit: 1000 })
    for (const file of files ?? []) {
      rows.push({ account_id: folder.name, file: file.name, created_at: file.created_at, bytes: file.metadata?.size ?? null })
    }
  }
  return { rows, next: (folders ?? []).length === limit ? String(offset + limit) : null }
}

/** Solo nombre y fecha de cada aparato: su dirección y claves permiten mandarle avisos. */
async function pushDevices(): Promise<Page> {
  const config = await readConfig()
  const rows: ExportRow[] = (config?.subscriptions ?? []).map((device) => ({ scope: "admin", label: device.label, added_at: device.addedAt }))
  const { data } = await getSupabaseAdminClient().storage.from(PUSH_BUCKET).list("users", { limit: 1000 })
  for (const file of data ?? []) rows.push({ scope: "cuenta", account_id: file.name.replace(/\.json$/, ""), updated_at: file.updated_at })
  return { rows, next: null }
}

export async function GET(request: Request) {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const params = new URL(request.url).searchParams
  const source = params.get("source") ?? ""
  const cursor = params.get("cursor")
  if (!EXPORT_SOURCES.includes(source)) return NextResponse.json({ error: "Fuente desconocida." }, { status: 400 })

  try {
    const table = EXPORT_TABLES.find((t) => t.name === source)
    if (table) return NextResponse.json(await tablePage(table.name, table.order, cursor))
    if (source === "auth_users") return NextResponse.json(await authPage(cursor))
    if (source === "backups_index") return NextResponse.json(await backupsPage(cursor))
    if (source === "push_devices") return NextResponse.json(await pushDevices())
    return NextResponse.json(await stripePage(source.replace("stripe_", "") as keyof typeof STRIPE_FIELDS, cursor))
  } catch (error) {
    console.error(`[api/admin/export] Error leyendo ${source}:`, error)
    return NextResponse.json({ error: "No se pudo leer esta fuente." }, { status: 500 })
  }
}

export async function POST() {
  if (!(await hasAdminSession())) return NextResponse.json({ error: "No autorizado." }, { status: 401 })
  const { error } = await getSupabaseAdminClient().from("product_events").insert({ event_name: "admin_full_export" } as never)
  if (error) console.error("[api/admin/export] No se pudo registrar la descarga:", error)
  await sendAdminPush({ title: "Exportación completa", body: "Alguien descargó todos los datos desde /admin." })
  return NextResponse.json({ ok: true })
}
