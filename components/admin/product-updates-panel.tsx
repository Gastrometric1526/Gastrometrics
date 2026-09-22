"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Mail, Send, Loader2, CheckCircle2, AlertTriangle, RotateCw } from "lucide-react"
import { CHANGELOG, LATEST_CHANGELOG_VERSION } from "@/lib/changelog"
import { useLanguage } from "@/contexts/language-context"

export function ProductUpdatesPanel() {
  const { t } = useLanguage()
  const [count, setCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reenvío puntual a una cuenta específica — pedido explícito del dueño del proyecto:
  // "debe haber una opción también de reenviar el correo por si al usuario no le cae".
  // Estado separado del envío masivo de arriba: son dos acciones distintas (una manda
  // a todos los que opinaron que sí, la otra reenvía a una persona puntual sin volver
  // a chequear esa casilla — ver app/api/admin/product-update-email/route.ts).
  const [targetEmail, setTargetEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false)
  const [resendResult, setResendResult] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/product-update-email")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setCount(json.count)
      })
      .catch(() => setCount(null))
      .finally(() => setLoadingCount(false))
  }, [])

  const handleSend = async () => {
    setConfirmOpen(false)
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/product-update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || t("admin_product_updates_error_default"))
      } else {
        setResult({ sentCount: json.sentCount, failedCount: json.failedCount })
      }
    } catch {
      setError(t("admin_product_updates_error_network"))
    } finally {
      setSending(false)
    }
  }

  const handleResend = async () => {
    setResendConfirmOpen(false)
    setResending(true)
    setResendError(null)
    setResendResult(null)
    try {
      const res = await fetch("/api/admin/product-update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, targetEmail: targetEmail.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setResendError(json.error || t("admin_product_updates_resend_error_default"))
      } else {
        setResendResult(json.resentTo || targetEmail.trim())
      }
    } catch {
      setResendError(t("admin_product_updates_resend_error_network"))
    } finally {
      setResending(false)
    }
  }

  const latestEntry = CHANGELOG[0]
  const preview = latestEntry?.content.es
  const canResend = targetEmail.trim().length > 3 && targetEmail.includes("@")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            {t("admin_product_updates_title")}
          </CardTitle>
          <CardDescription>{t("admin_product_updates_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {t("admin_product_updates_changelog_version_label")}
            </p>
            <p className="text-sm font-semibold text-foreground">{latestEntry?.version}</p>
            {preview && (
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground list-disc pl-4">
                {preview.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("admin_product_updates_recipients_label")}
              </p>
              <p className="text-2xl font-bold text-foreground">
                {loadingCount ? "…" : count ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("admin_product_updates_recipients_desc")}</p>
            </div>
            <Button onClick={() => setConfirmOpen(true)} disabled={sending || loadingCount || !count}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {t("admin_product_updates_send_button")}
            </Button>
          </div>

          {result && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {t("admin_product_updates_sent_result_prefix").replace("{count}", String(result.sentCount))}
                {result.failedCount > 0
                  ? t("admin_product_updates_sent_result_failed").replace("{count}", String(result.failedCount))
                  : "."}
              </span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Reenvío puntual — por si a alguien no le llegó (bounce, filtro de spam,
              casilla equivocada al momento del envío masivo, etc.). No vuelve a chequear
              la casilla de "novedades" — ver comentario en la API. */}
          <div className="rounded-lg border p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t("admin_product_updates_resend_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("admin_product_updates_resend_desc")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder={t("admin_product_updates_resend_placeholder")}
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                className="max-w-xs"
              />
              <Button
                variant="outline"
                onClick={() => setResendConfirmOpen(true)}
                disabled={resending || !canResend}
              >
                {resending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCw className="h-4 w-4 mr-2" />}
                {t("admin_product_updates_resend_button")}
              </Button>
            </div>
            {resendResult && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t("admin_product_updates_resend_result").replace("{email}", resendResult)}</span>
              </div>
            )}
            {resendError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{resendError}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_product_updates_confirm_send_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_product_updates_confirm_send_desc")
                .replace("{count}", String(count ?? 0))
                .replace("{version}", LATEST_CHANGELOG_VERSION)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>{t("admin_product_updates_confirm_send_action")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_product_updates_confirm_resend_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_product_updates_confirm_resend_desc")
                .replace("{email}", targetEmail.trim())
                .replace("{version}", LATEST_CHANGELOG_VERSION)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResend}>{t("admin_product_updates_confirm_resend_action")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
