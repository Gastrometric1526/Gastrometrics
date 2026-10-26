"use client"

/**
 * /admin → «Informe completo (PDF)» (docs/206). Lee todas las rutas de /admin
 * (lib/admin/full-report.ts REPORT_SECTIONS, solo GET), convierte cada respuesta en tablas y
 * arma un PDF horizontal con portada, índice con páginas y una sección por fuente. Todo en el
 * navegador: los datos no salen del panel. Lleva datos personales (correos, mensajes).
 */

import { useState } from "react"
import { FileDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { fileDate } from "@/lib/date-format"
import { flattenForReport, REPORT_SECTIONS, type ReportBlock } from "@/lib/admin/full-report"
import type { TranslationKey } from "@/lib/i18n/translations"


export function FullReportButton() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [progress, setProgress] = useState<string | null>(null)

  const run = async () => {
    setProgress(t("admin_full_report_progress").replace("{n}", "0").replace("{total}", String(REPORT_SECTIONS.length)))
    try {
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
              done++
              setProgress(t("admin_full_report_progress").replace("{n}", String(done)).replace("{total}", String(REPORT_SECTIONS.length)))
              if (!res.ok || !data) return { title, blocks: [], error: (data && typeof data.error === "string" && data.error) || `HTTP ${res.status}` }
              return { title, blocks: flattenForReport(data), error: null }
            } catch (e) {
              done++
              return { title, blocks: [], error: e instanceof Error ? e.message : "error" }
            }
          }),
        )
        results.push(...got)
      }

      // 2. Armar el PDF.
      setProgress(t("admin_full_report_building"))
      const { buildFullReportPdf } = await import("@/lib/admin/full-report-pdf")
      const now = new Date()
      const doc = buildFullReportPdf(results, (k) => t(k as TranslationKey), now)
      const total = doc.getNumberOfPages()

      doc.save(`gastrometrics-informe-admin-${fileDate(now)}.pdf`)
      toast({ title: t("admin_full_report_done").replace("{pages}", String(total)) })
    } catch (e) {
      console.error("[admin] informe completo:", e)
      toast({ title: t("admin_full_report_error"), variant: "destructive" })
    } finally {
      setProgress(null)
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={run} disabled={!!progress} title={t("admin_full_report_hint")}>
      {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {progress ?? t("admin_full_report_button")}
    </Button>
  )
}
