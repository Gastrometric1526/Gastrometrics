"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Scale, Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

/**
 * Único punto donde se dispara el correo de aviso legal a usuarios EXISTENTES sobre
 * la nueva versión de Términos de Uso/Política de Privacidad/Aviso de Responsabilidad
 * (ver app/api/admin/legal-update-email/route.ts, docs/118) — pedido explícito del
 * dueño del proyecto. A diferencia del correo de novedades (arriba), este va a TODA
 * cuenta con correo real, no solo a las que marcaron la casilla de novedades — es un
 * aviso legal, no una novedad opcional. Idempotente por cuenta: correr esto más de
 * una vez nunca duplica un envío ya hecho (ver activation_emails_sent).
 */
export function LegalUpdatePanel() {
  const { t } = useLanguage()
  const [count, setCount] = useState<number | null>(null)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ sentCount: number; skippedCount: number; failedCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCount = () => {
    setLoadingCount(true)
    fetch("/api/admin/legal-update-email")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) {
          setCount(json.count)
          setPendingCount(json.pendingCount)
        }
      })
      .catch(() => {
        setCount(null)
        setPendingCount(null)
      })
      .finally(() => setLoadingCount(false))
  }

  useEffect(() => {
    loadCount()
  }, [])

  const handleSend = async () => {
    setConfirmOpen(false)
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/legal-update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || t("admin_legal_update_error_default"))
      } else {
        setResult({ sentCount: json.sentCount, skippedCount: json.skippedCount, failedCount: json.failedCount })
        loadCount()
      }
    } catch {
      setError(t("admin_product_updates_error_network"))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            {t("admin_legal_update_title")}
          </CardTitle>
          <CardDescription>{t("admin_legal_update_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("admin_legal_update_pending_label")}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {loadingCount ? "…" : pendingCount ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("admin_legal_update_pending_desc").replace("{count}", loadingCount ? "…" : String(count ?? "—"))}
              </p>
            </div>
            <Button onClick={() => setConfirmOpen(true)} disabled={sending || loadingCount || !pendingCount}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {t("admin_legal_update_send_button")}
            </Button>
          </div>

          {result && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {t("admin_legal_update_sent_result_prefix").replace("{count}", String(result.sentCount))}
                {result.skippedCount > 0
                  ? t("admin_legal_update_sent_result_skipped").replace("{count}", String(result.skippedCount))
                  : "."}
                {result.failedCount > 0
                  ? t("admin_legal_update_sent_result_failed").replace("{count}", String(result.failedCount))
                  : ""}
              </span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_legal_update_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_legal_update_confirm_desc").replace("{count}", String(pendingCount ?? 0))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>{t("admin_legal_update_confirm_action")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
