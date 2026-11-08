"use client"

/**
 * Informe completo de /admin en PDF (docs/206). Lee todas las rutas de /admin
 * (lib/admin/full-report.ts REPORT_SECTIONS, solo GET), convierte cada respuesta en tablas y
 * arma un PDF horizontal con portada, índice con páginas y una sección por fuente. Todo en el
 * navegador: los datos no salen del panel. Lleva datos personales (correos, mensajes).
 *
 * Desde docs/266 ya no tiene botón propio: «Descargar todo» (full-export-button.tsx) lo mete
 * dentro del ZIP como `informe-admin.pdf`.
 */

import { flattenForReport, REPORT_SECTIONS, type ReportBlock } from "@/lib/admin/full-report"
import type { TranslationKey } from "@/lib/i18n/translations"

export const REPORT_SECTION_COUNT = REPORT_SECTIONS.length

export async function buildAdminReport(
  t: (key: TranslationKey) => string,
  onProgress: (done: number) => void,
  now: Date,
): Promise<{ blob: Blob; pages: number; failed: number }> {
  // 1. Leer todas las secciones (de a 4 a la vez, para no saturar el servidor).
  const results: { title: string; blocks: ReportBlock[]; error: string | null }[] = []
  let done = 0
  for (let i = 0; i < REPORT_SECTIONS.length; i += 4) {
    const chunk = REPORT_SECTIONS.slice(i, i + 4)
    const got = await Promise.all(
      chunk.map(async (s) => {
        const title = t(s.titleKey as TranslationKey)
        try {
          const res = await fetch(s.url, { cache: "no-store" })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data) return { title, blocks: [], error: (data && typeof data.error === "string" && data.error) || `HTTP ${res.status}` }
          return { title, blocks: flattenForReport(data), error: null }
        } catch (e) {
          return { title, blocks: [], error: e instanceof Error ? e.message : "error" }
        } finally {
          done++
          onProgress(done)
        }
      }),
    )
    results.push(...got)
  }

  // 2. Armar el PDF.
  const { buildFullReportPdf } = await import("@/lib/admin/full-report-pdf")
  const doc = buildFullReportPdf(results, (k) => t(k as TranslationKey), now)
  return { blob: doc.output("blob"), pages: doc.getNumberOfPages(), failed: results.filter((r) => r.error).length }
}
