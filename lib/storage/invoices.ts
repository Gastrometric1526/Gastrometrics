/**
 * INVOICES STORAGE MODULE — mismo patrón que lib/storage/purchase-orders.ts (ver el
 * comentario de cabecera de lib/storage/businesses.ts para el patrón general de esta
 * migración a Supabase real). `number` es columna propia en Supabase (ver
 * supabase/migrations/0031_invoices.sql), no vive dentro de `data`.
 */

import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { createBusinessScopedCache } from "./supabase-cache"
import type { Database } from "@/types/database"
import type { Invoice } from "@/types/invoice"

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"]

const cache = createBusinessScopedCache<Invoice>()

function toDbBusinessId(businessId?: string | null): string | null {
  return !businessId || businessId === "main" ? null : businessId
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return { ...(row.data as unknown as Invoice), id: row.id, number: row.number }
}

async function fetchInvoices(businessId: string): Promise<Invoice[]> {
  const supabase = getSupabaseBrowserClient()
  const dbBusinessId = toDbBusinessId(businessId)
  let query = supabase.from("invoices").select("*")
  query = dbBusinessId === null ? query.is("business_id", null) : query.eq("business_id", dbBusinessId)
  const { data, error } = await query
  if (error) {
    console.error("[Invoices] Error cargando facturas:", error)
    return []
  }
  return (data ?? []).map(rowToInvoice)
}

/** Hook reactivo — usar en vez de getInvoices(businessId) dentro de useMemo. */
export function useInvoices(businessId: string): Invoice[] {
  return cache.useCached(businessId, () => fetchInvoices(businessId))
}

export function ensureInvoicesLoaded(businessId: string): Promise<void> {
  return cache.ensureLoaded(businessId, () => fetchInvoices(businessId))
}

/** Get all invoices for a business (síncrono — lee la caché en memoria). */
export function getInvoices(businessId: string): Invoice[] {
  return cache.getSnapshot(businessId)
}

export async function saveInvoices(businessId: string, invoices: Invoice[]): Promise<void> {
  const previous = cache.getSnapshot(businessId)
  const nextIds = new Set(invoices.map((i) => i.id))
  const removedIds = previous.filter((i) => !nextIds.has(i.id)).map((i) => i.id)

  cache.setSnapshot(businessId, invoices)

  const supabase = getSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    console.error("[Invoices] No hay sesión — no se pudo guardar en Supabase.")
    return
  }

  const dbBusinessId = toDbBusinessId(businessId)
  const rows = invoices.map((invoice) => {
    const { id, number, ...rest } = invoice
    return { id, number, business_id: dbBusinessId, owner_id: user.id, data: rest }
  })

  if (rows.length > 0) {
    const { error } = await supabase.from("invoices").upsert(rows)
    if (error) console.error("[Invoices] Error guardando facturas:", error)
  }
  if (removedIds.length > 0) {
    const { error } = await supabase.from("invoices").delete().in("id", removedIds)
    if (error) console.error("[Invoices] Error eliminando facturas:", error)
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("invoicesUpdated", { detail: { businessId, count: invoices.length } }))
  }
}

export function getInvoice(businessId: string, invoiceId: string): Invoice | null {
  const invoices = getInvoices(businessId)
  return invoices.find((invoice) => invoice.id === invoiceId) || null
}

export async function addInvoice(businessId: string, invoice: Invoice): Promise<void> {
  const invoices = getInvoices(businessId)
  await saveInvoices(businessId, [...invoices, invoice])
}

export async function updateInvoice(businessId: string, invoiceId: string, updated: Invoice): Promise<void> {
  const invoices = getInvoices(businessId)
  const index = invoices.findIndex((invoice) => invoice.id === invoiceId)
  if (index === -1) return
  const next = [...invoices]
  next[index] = updated
  await saveInvoices(businessId, next)
}

export async function deleteInvoice(businessId: string, invoiceId: string): Promise<void> {
  const invoices = getInvoices(businessId)
  await saveInvoices(
    businessId,
    invoices.filter((invoice) => invoice.id !== invoiceId),
  )
}

/** Próximo número de factura para este negocio — secuencial, con padding a 4 dígitos. */
export function getNextInvoiceNumber(businessId: string): string {
  const invoices = getInvoices(businessId)
  const highest = invoices.reduce((max, invoice) => {
    const n = Number.parseInt(invoice.number, 10)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return String(highest + 1).padStart(4, "0")
}
