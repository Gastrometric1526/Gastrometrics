/**
 * Marca de los PDF (pedido del dueño, docs/229):
 * - En los planes Foodie a Sous Chef los PDF llevan «GastroMetrics» al pie (y como nombre
 *   cuando el espacio no tiene nombre de negocio).
 * - En Chef Ejecutivo no aparece GastroMetrics: el encabezado lleva el nombre del negocio
 *   (o el que la persona escriba para sus PDF) y el pie, su propia línea (dirección,
 *   teléfono, RTN…). Se configura en Configuración → Apariencia → «Tus PDF».
 *
 * Dónde se guarda: en un negocio real, en `Business.pdfBranding` (jsonb `data`, lo ve
 * también su equipo); en el espacio principal («main», sin fila de negocio), en los
 * metadatos de la cuenta (`user_metadata.pdf_branding`), que auth-context carga al iniciar
 * sesión. No hace falta migración.
 */

import { getBusinessById, updateBusiness } from "@/lib/storage/businesses"
import { getCurrentPlanSlug, hasActiveMembership } from "@/lib/plan-access"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export interface PdfBranding {
  /** Nombre en el encabezado de los PDF (vacío = el nombre del negocio). */
  name?: string
  /** Línea al pie de cada página (dirección, teléfono, RTN…). */
  footer?: string
  /** Datos del negocio en facturas y órdenes de compra, en todos los planes (docs/251). */
  fiscal?: PdfFiscal
  /** Tipografía de la carta del cliente; sin valor, la clásica. */
  menuFont?: "clasica" | "moderna"
}

export interface PdfFiscal {
  legalName?: string
  taxId?: string
  address?: string
  phone?: string
  email?: string
}

export const PDF_BRAND = "GastroMetrics"
export const WHITE_LABEL_PLAN = "chef-ejecutivo"
const MAX_LEN = { name: 60, footer: 120 }
const FISCAL_MAX: Record<keyof PdfFiscal, number> = { legalName: 80, taxId: 40, address: 120, phone: 40, email: 80 }

let mainBranding: PdfBranding = {}

/** Lo llama auth-context con `user_metadata.pdf_branding` de la sesión. */
export function setMainPdfBranding(value: unknown): void {
  mainBranding = normalizePdfBranding(value)
}

export function normalizePdfBranding(value: unknown): PdfBranding {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "")
  const name = clean(v.name, MAX_LEN.name)
  const footer = clean(v.footer, MAX_LEN.footer)
  const source = (v.fiscal && typeof v.fiscal === "object" ? v.fiscal : {}) as Record<string, unknown>
  const fiscal: PdfFiscal = {}
  for (const key of Object.keys(FISCAL_MAX) as (keyof PdfFiscal)[]) {
    const text = clean(source[key], FISCAL_MAX[key])
    if (text) fiscal[key] = text
  }
  return {
    ...(name ? { name } : {}),
    ...(footer ? { footer } : {}),
    ...(Object.keys(fiscal).length > 0 ? { fiscal } : {}),
    ...(v.menuFont === "clasica" || v.menuFont === "moderna" ? { menuFont: v.menuFont } : {}),
  }
}

const isMain = (businessId?: string | null) => !businessId || businessId === "main"

export function getPdfBranding(businessId?: string | null): PdfBranding {
  if (isMain(businessId)) return mainBranding
  return normalizePdfBranding(getBusinessById(businessId as string)?.pdfBranding)
}

/**
 * Sin la marca GastroMetrics: con el plan Chef Ejecutivo, o en un negocio ajeno (equipo)
 * cuyo dueño ya configuró la marca de sus PDF (solo puede hacerlo con Chef Ejecutivo).
 */
export function isWhiteLabelPdf(businessId?: string | null): boolean {
  if (getCurrentPlanSlug() === WHITE_LABEL_PLAN && !hasActiveMembership()) return true
  if (isMain(businessId)) return false
  const b = getPdfBranding(businessId)
  return Boolean(b.name || b.footer)
}

/** Fuente de jsPDF para la carta del cliente. */
export function pdfMenuFont(businessId?: string | null): "times" | "helvetica" {
  return getPdfBranding(businessId).menuFont === "moderna" ? "helvetica" : "times"
}

/** Nombre del encabezado. */
export function pdfHeaderName(businessId?: string | null, businessName?: string | null): string {
  if (isWhiteLabelPdf(businessId)) return getPdfBranding(businessId).name || (businessName || "").trim()
  return (businessName || "").trim() || PDF_BRAND
}

/** Lo que va antes de «Página X de Y» al pie (con su separador), o "" si no va nada. */
export function pdfFooterPrefix(businessId?: string | null): string {
  if (!isWhiteLabelPdf(businessId)) return `${PDF_BRAND} | `
  const footer = getPdfBranding(businessId).footer
  return footer ? `${footer} | ` : ""
}

/** Pie de la carta del cliente: el nombre del negocio (o la línea propia en Chef Ejecutivo). */
export function pdfClientFooter(businessId?: string | null, businessName?: string | null): string {
  if (!isWhiteLabelPdf(businessId)) return (businessName || "").trim() || PDF_BRAND
  return getPdfBranding(businessId).footer || pdfHeaderName(businessId, businessName)
}

export async function savePdfBranding(businessId: string | null | undefined, value: PdfBranding): Promise<boolean> {
  const branding = normalizePdfBranding(value)
  if (isMain(businessId)) {
    const { error } = await getSupabaseBrowserClient().auth.updateUser({ data: { pdf_branding: branding } })
    if (error) return false
    mainBranding = branding
    return true
  }
  return updateBusiness(businessId as string, { pdfBranding: branding })
}
