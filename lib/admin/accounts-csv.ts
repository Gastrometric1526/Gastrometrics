/**
 * Exportar cuentas a Excel desde /admin → Cuentas (docs/195). CSV con BOM UTF-8 (Excel lo abre
 * con acentos), separador coma, fechas día/mes/año (docs/170) y decimales con punto (docs/129).
 */
import { formatDate } from "@/lib/date-format"

export interface CsvAccount {
  email: string
  createdAt: string
  emailConfirmed: boolean
  planName: string
  planExpiresAt: string | null
  hasActiveSubscription: boolean
  country: string | null
  businessCount: number
  teamMemberCount: number
  recipeCount: number
  ingredientCount: number
  posImportCount: number
  manualSalesCount: number
  lastSalesAt: string | null
  totalActiveSeconds: number
  referralSent: number
  referralCreated: number
  referralActive: number
}

const cell = (v: string | number | boolean | null | undefined): string => {
  if (v === null || v === undefined) return ""
  const s = typeof v === "boolean" ? (v ? "1" : "0") : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function accountsToCsv(rows: CsvAccount[], headers: string[]): string {
  const lines = [headers.map(cell).join(",")]
  for (const r of rows) {
    lines.push(
      [
        r.email,
        formatDate(r.createdAt),
        r.emailConfirmed,
        r.planName,
        r.planExpiresAt ? formatDate(r.planExpiresAt) : "",
        r.hasActiveSubscription,
        r.country ?? "",
        r.businessCount,
        r.teamMemberCount,
        r.recipeCount,
        r.ingredientCount,
        r.posImportCount,
        r.manualSalesCount,
        r.lastSalesAt ? formatDate(r.lastSalesAt) : "",
        Math.round(r.totalActiveSeconds / 60),
        r.referralSent,
        r.referralCreated,
        r.referralActive,
      ]
        .map(cell)
        .join(","),
    )
  }
  return "﻿" + lines.join("\r\n")
}
