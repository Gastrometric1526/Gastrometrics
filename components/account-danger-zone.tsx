"use client"

/**
 * «Borrar todo el contenido» y «Eliminar cuenta» (self-service). Antes vivían solo dentro
 * de Configuración; desde docs/182 también en Mi Plan, así que se comparten aquí.
 * - Borrar contenido: app/api/account/wipe-content/route.ts (deja la cuenta).
 * - Eliminar cuenta: app/api/account/delete/route.ts (cancela Stripe, 30 días de gracia
 *   para reactivar, después borrado definitivo por el cron).
 * Las dos piden escribir el correo exacto de la cuenta para confirmar.
 */

import { useState } from "react"
import { AlertTriangle, Eraser, Loader2, Trash2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"

function ConfirmByEmail({
  id,
  intro,
  badge,
  value,
  onChange,
  error,
  busy,
  busyLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  id: string
  intro: string
  badge?: string
  value: string
  onChange: (v: string) => void
  error: string
  busy: boolean
  busyLabel: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useLanguage()
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="space-y-2 flex-1">
            <h4 className="font-semibold text-destructive">{t("settings_confirm_title")}</h4>
            <p className="text-sm text-muted-foreground">{intro}</p>
            {badge && (
              <Badge variant="destructive" className="mt-2">
                {badge}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm">
          {t("settings_delete_account_confirm_input_label").replace("{email}", user?.email || "")}
        </Label>
        <Input id={id} type="email" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} placeholder={user?.email || ""} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy} className="flex-1">
          {t("common_cancel")}
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={busy || !value} className="flex-1 gap-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export function AccountDangerZone() {
  const { t } = useLanguage()
  const { user, logout } = useAuth()

  const [showDelete, setShowDelete] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const [showWipe, setShowWipe] = useState(false)
  const [wipeEmail, setWipeEmail] = useState("")
  const [wipeError, setWipeError] = useState("")
  const [isWiping, setIsWiping] = useState(false)
  const [wipeDone, setWipeDone] = useState(false)

  const matches = (value: string) => Boolean(user?.email) && value.trim().toLowerCase() === user!.email!.toLowerCase()

  const handleDelete = async () => {
    if (!matches(deleteEmail)) {
      setDeleteError(t("settings_delete_account_error_mismatch"))
      return
    }
    setDeleteError("")
    setIsDeleting(true)
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleteEmail.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDeleteError(json.error || t("settings_delete_account_generic_error"))
        setIsDeleting(false)
        return
      }
      await logout()
      // Navegación dura: la cuenta ya no existe, un router.push podría chocar con el guard.
      window.location.href = "/"
    } catch (error) {
      console.error("Error eliminando la cuenta:", error)
      setDeleteError(t("settings_delete_account_generic_error"))
      setIsDeleting(false)
    }
  }

  const handleWipe = async () => {
    if (!matches(wipeEmail)) {
      setWipeError(t("settings_delete_account_error_mismatch"))
      return
    }
    setWipeError("")
    setIsWiping(true)
    try {
      const res = await fetch("/api/account/wipe-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: wipeEmail.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWipeError(json.error || t("settings_delete_account_generic_error"))
        setIsWiping(false)
        return
      }
      setWipeDone(true)
      // Navegación dura: las cachés en memoria apuntan a datos que ya no existen.
      window.location.href = "/dashboard"
    } catch (error) {
      console.error("Error borrando el contenido de la cuenta:", error)
      setWipeError(t("settings_delete_account_generic_error"))
      setIsWiping(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eraser className="h-5 w-5 text-destructive" />
            {t("settings_wipe_content_title")}
          </CardTitle>
          <CardDescription>{t("settings_wipe_content_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wipeDone ? (
            <p className="text-sm text-foreground">{t("settings_wipe_content_done")}</p>
          ) : !showWipe ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("settings_wipe_content_body")}</p>
              <Button
                variant="destructive"
                onClick={() => {
                  setWipeError("")
                  setWipeEmail("")
                  setShowWipe(true)
                }}
                className="gap-2"
              >
                <Eraser className="h-4 w-4" />
                {t("settings_wipe_content_button")}
              </Button>
            </div>
          ) : (
            <ConfirmByEmail
              id="wipe-content-email"
              intro={t("settings_wipe_content_confirm_intro")}
              value={wipeEmail}
              onChange={setWipeEmail}
              error={wipeError}
              busy={isWiping}
              busyLabel={t("settings_wipe_content_wiping")}
              confirmLabel={t("settings_wipe_content_confirm_button")}
              onCancel={() => setShowWipe(false)}
              onConfirm={handleWipe}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t("settings_delete_account_title")}
          </CardTitle>
          <CardDescription>{t("settings_delete_account_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDelete ? (
            <div data-tour="settings-account-delete" className="space-y-3">
              <p className="text-sm text-muted-foreground">{t("settings_delete_account_body")}</p>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteError("")
                  setDeleteEmail("")
                  setShowDelete(true)
                }}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {t("settings_delete_account_button")}
              </Button>
            </div>
          ) : (
            <ConfirmByEmail
              id="delete-account-email"
              intro={t("settings_delete_account_confirm_intro")}
              badge={t("settings_delete_account_grace_notice")}
              value={deleteEmail}
              onChange={setDeleteEmail}
              error={deleteError}
              busy={isDeleting}
              busyLabel={t("settings_delete_account_deleting")}
              confirmLabel={t("settings_delete_account_confirm_button")}
              onCancel={() => setShowDelete(false)}
              onConfirm={handleDelete}
            />
          )}
        </CardContent>
      </Card>
    </>
  )
}
