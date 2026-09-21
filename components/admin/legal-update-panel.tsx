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
        setError(json.error || "No se pudo enviar.")
      } else {
        setResult({ sentCount: json.sentCount, skippedCount: json.skippedCount, failedCount: json.failedCount })
        loadCount()
      }
    } catch {
      setError("No se pudo enviar. Revisa la conexión.")
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
            Aviso legal: nuevos Términos, Política de Privacidad y Aviso de Responsabilidad
          </CardTitle>
          <CardDescription>
            Se manda a TODAS las cuentas existentes con correo real (no depende de la casilla de novedades) —
            avisa sobre la versión 1.2 de los 3 documentos legales. Como máximo un envío por cuenta, para
            siempre: volver a apretar el botón nunca duplica un correo ya mandado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendientes de recibirlo</p>
              <p className="text-2xl font-bold text-foreground">
                {loadingCount ? "…" : pendingCount ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                de {loadingCount ? "…" : count ?? "—"} cuentas totales con correo real
              </p>
            </div>
            <Button onClick={() => setConfirmOpen(true)} disabled={sending || loadingCount || !pendingCount}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar aviso legal
            </Button>
          </div>

          {result && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Enviado a {result.sentCount} cuenta{result.sentCount === 1 ? "" : "s"}
                {result.skippedCount > 0 ? ` — ${result.skippedCount} ya lo había recibido antes.` : "."}
                {result.failedCount > 0 ? ` Falló para ${result.failedCount}.` : ""}
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
            <AlertDialogTitle>¿Enviar el aviso legal ahora?</AlertDialogTitle>
            <AlertDialogDescription>
              Le llegará a {pendingCount ?? 0} cuenta{pendingCount === 1 ? "" : "s"} que todavía no lo recibió, de
              inmediato. No se puede deshacer un correo ya enviado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend}>Sí, enviar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
