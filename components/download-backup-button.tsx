"use client"

/** Descarga el respaldo completo de la cuenta, desde cualquier pantalla de bloqueo (docs/243). */

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { toIsoDate } from "@/lib/date-format"

export function DownloadBackupButton() {
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const { exportAccountBackup, downloadBlob } = await import("@/lib/backup/export-account-backup")
      const blob = await exportAccountBackup(() => {}, language)
      downloadBlob(blob, `gastrometrics-respaldo-${toIsoDate(new Date())}.zip`)
    } catch (error) {
      console.error("Error generando el respaldo:", error)
      toast({ title: t("settings_export_backup_error"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" className="gap-2" onClick={download} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? t("settings_export_backup_generating") : t("plan_lock_download")}
    </Button>
  )
}
