"use client"

/**
 * /admin → «Exportar todo (ZIP)» (docs/250). Pide cada fuente por páginas, sin recortes, y arma
 * el ZIP en el navegador. Si una fuente falla sigue con las demás, y LEEME.txt dice cuál quedó
 * incompleta: nunca se presenta como completo un archivo al que le falta algo.
 *
 * Desde docs/266 es el único botón de descarga de /admin («Descargar todo»): el ZIP lleva
 * también el informe PDF completo (informe-admin.pdf), que antes era otro botón.
 */

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useConfirmDialog } from "@/components/confirm-dialog"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { fileDate, formatDateTime } from "@/lib/date-format"
import { buildAdminReport, REPORT_SECTION_COUNT } from "@/components/admin/full-report-button"
import type { TranslationKey } from "@/lib/i18n/translations"
import { EXPORT_SOURCES, exportReadme, isIncomplete, rowsToCsv, type ExportResult, type ExportRow } from "@/lib/admin/data-export"

interface ExportPage {
  rows: ExportRow[]
  next: string | null
  total?: number | null
}

async function fetchPage(source: string, cursor: string | null): Promise<ExportPage> {
  const url = `/api/admin/export?source=${source}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`
  let failure = "error"
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { cache: "no-store" })
      if (res.ok) return (await res.json()) as ExportPage
      failure = `HTTP ${res.status}`
      if (res.status < 500) break
    } catch (error) {
      failure = error instanceof Error ? error.message : "error"
    }
  }
  throw new Error(failure)
}

async function fetchSource(source: string): Promise<{ rows: ExportRow[]; result: ExportResult }> {
  const rows: ExportRow[] = []
  let cursor: string | null = null
  let total: number | null = null
  try {
    do {
      const page: ExportPage = await fetchPage(source, cursor)
      rows.push(...page.rows)
      if (typeof page.total === "number") total = page.total
      cursor = page.next
    } while (cursor)
    return { rows, result: { source, rows: rows.length, total, error: null } }
  } catch (error) {
    const message = error instanceof Error ? error.message : "error"
    return { rows, result: { source, rows: rows.length, total, error: message } }
  }
}

export function FullExportButton() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [confirm, confirmDialog] = useConfirmDialog()
  const [progress, setProgress] = useState<string | null>(null)

  const run = async () => {
    if (!(await confirm(t("admin_export_all_confirm")))) return
    // Un solo contador: primero las tablas, después las secciones del informe.
    const total = EXPORT_SOURCES.length + REPORT_SECTION_COUNT
    const step = (n: number) =>
      setProgress(t("admin_export_all_progress").replace("{n}", String(n)).replace("{total}", String(total)))
    step(0)
    try {
      await fetch("/api/admin/export", { method: "POST" })
      const { default: JSZip } = await import("jszip")
      const zip = new JSZip()
      const results: ExportResult[] = []
      for (const source of EXPORT_SOURCES) {
        const { rows, result } = await fetchSource(source)
        zip.file(`datos/${source}.json`, JSON.stringify(rows, null, 1))
        zip.file(`datos/${source}.csv`, rowsToCsv(rows))
        results.push(result)
        step(results.length)
      }
      const now = new Date()
      zip.file("LEEME.txt", exportReadme(results, formatDateTime(now)))

      // El informe PDF va dentro del mismo ZIP. Si falla, el ZIP sale igual y se avisa.
      let reportFailed = false
      try {
        const report = await buildAdminReport((k: TranslationKey) => t(k), (n) => step(EXPORT_SOURCES.length + n), now)
        zip.file("informe-admin.pdf", report.blob)
        reportFailed = report.failed > 0
      } catch (error) {
        console.error("[admin] informe dentro del ZIP:", error)
        reportFailed = true
      }

      setProgress(t("admin_export_all_building"))
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `gastrometrics-admin-${fileDate(now)}.zip`
      link.click()
      URL.revokeObjectURL(url)

      const incomplete = results.filter(isIncomplete).length
      if (reportFailed) {
        toast({ title: t("admin_export_all_report_failed"), variant: "destructive" })
      } else if (incomplete > 0) {
        toast({ title: t("admin_export_all_partial").replace("{n}", String(incomplete)), variant: "destructive" })
      } else {
        toast({ title: t("admin_export_all_done") })
      }
    } catch (error) {
      console.error("[admin] exportación completa:", error)
      toast({ title: t("admin_export_all_error"), variant: "destructive" })
    } finally {
      setProgress(null)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={run} disabled={!!progress} title={t("admin_export_all_hint")}>
        {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {progress ?? t("admin_export_all_button")}
      </Button>
      {confirmDialog}
    </>
  )
}
