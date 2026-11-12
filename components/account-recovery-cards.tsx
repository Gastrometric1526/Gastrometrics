"use client"

/**
 * Recuperar la cuenta desde dentro de la app (docs/285):
 * - `AccountDeletionNotice`: si la cuenta pidió eliminarse y sigue en los 30 días, lo dice
 *   («Tu cuenta se eliminará el …») con «Reactivar mi cuenta». Antes solo se reactivaba
 *   escribiendo al soporte.
 * - `RestoreContentRequest`: en Mi Plan → Tu cuenta, para quien borró su contenido por error:
 *   pide que se restaure un respaldo (le llega al dueño en /admin → Recuperar cuentas).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, History, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/date-format"

export function AccountDeletionNotice() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [state, setState] = useState<{ purgeAt: string; daysLeft: number } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch("/api/account/reactivate")
      .then((r) => r.json())
      .then((d) => d?.pending && setState({ purgeAt: d.purgeAt, daysLeft: d.daysLeft }))
      .catch(() => {})
  }, [])
  if (!state) return null
  const reactivate = async () => {
    setBusy(true)
    const res = await fetch("/api/account/reactivate", { method: "POST" }).catch(() => null)
    setBusy(false)
    if (res?.ok) {
      setState(null)
      toast({ title: t("reactivate_done_title"), description: t("reactivate_done_desc") })
    } else toast({ title: t("reactivate_error"), variant: "destructive" })
  }
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 sm:flex-row sm:items-center" role="alert" data-account-deletion-notice>
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {t("reactivate_title").replace("{date}", formatDate(state.purgeAt)).replace("{days}", String(state.daysLeft))}
        </p>
        <p className="text-sm text-muted-foreground">{t("reactivate_desc")}</p>
      </div>
      <Button onClick={reactivate} disabled={busy} className="shrink-0 gap-1.5">
        <RotateCcw className="h-4 w-4" />
        {busy ? t("reactivate_busy") : t("reactivate_button")}
      </Button>
    </div>
  )
}

export function RestoreContentRequest() {
  const { t } = useLanguage()
  const [details, setDetails] = useState("")
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    if (!details.trim()) return setError(t("restore_request_error_details"))
    setBusy(true)
    setError(null)
    const res = await fetch("/api/account/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "restore_content", details }) }).catch(() => null)
    setBusy(false)
    if (res?.ok) setSent(true)
    else setError(res?.status === 429 ? t("recover_error_rate") : t("recover_error_generic"))
  }
  return (
    <div className="space-y-3 rounded-xl border border-border p-4" data-restore-request>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-primary" />
        {t("restore_request_title")}
      </p>
      {sent ? (
        <p className="text-sm text-success">{t("restore_request_sent")}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("restore_request_desc")}{" "}
            <Link href="/mis-recetas" className="text-primary hover:underline">
              {t("restore_request_trash_link")}
            </Link>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="restore-details">{t("restore_request_label")}</Label>
            <Textarea id="restore-details" rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("restore_request_placeholder")} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button variant="outline" size="sm" onClick={send} disabled={busy}>
            {busy ? t("recover_sending") : t("restore_request_button")}
          </Button>
        </>
      )}
    </div>
  )
}
