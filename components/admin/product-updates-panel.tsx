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
import { Mail, Send, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { CHANGELOG, LATEST_CHANGELOG_VERSION } from "@/lib/changelog"

/**
 * Único punto donde se dispara el correo de "novedades del producto" — siempre un
 * clic humano del dueño del proyecto, nunca algo automático al agregar una entrada a
 * lib/changelog.ts ni al hacer deploy (ver app/api/admin/product-update-email/route.ts).
 */
export function ProductUpdatesPanel() {
  const [count, setCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        setError(json.error || "No se pudo enviar.")
      } else {
        setResult({ sentCount: json.sentCount, failedCount: json.failedCount })
      }
    } catch {
      setError("No se pudo enviar. Revisa la conexión.")
    } finally {
      setSending(false)
    }
  }

  const latestEntry = CHANGELOG[0]
  const preview = latestEntry?.content.es

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Correo de novedades del producto
          </CardTitle>
          <CardDescription>
            Se manda solo a cuentas que marcaron la casilla de novedades (al registrarse, o después en
            Configuración → Notificaciones). Nunca se dispara solo — hace falta este botón.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Versión actual del changelog
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Destinatarios</p>
              <p className="text-2xl font-bold text-foreground">
                {loadingCount ? "…" : count ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">cuentas con la casilla marcada</p>
            </div>
            <Button onClick={() => setConfirmOpen(true)} disabled={sending || loadingCount || !count}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar correo de novedades
            </Button>
          </div>

          {result && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Enviado a {result.sentCount} cuenta{result.sentCount === 1 ? "" : "s"}
                {result.failedCount > 0 ? ` — falló para ${result.failedCount}.` : "."}
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
            <AlertDialogTitle>¿Enviar el correo de novedades ahora?</AlertDialogTitle>
            <AlertDialogDescription>
              Le llegará a {count ?? 0} cuenta{count === 1 ? "" : "s"} de inmediato, con la versión "
              {LATEST_CHANGELOG_VERSION}" del changelog. No se puede deshacer un correo ya enviado.
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
