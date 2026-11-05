"use client"

/**
 * Botón de /admin para recibir notificaciones en este aparato (docs/240). Cada persona con
 * acceso lo activa en su computadora o celular; al activarlo llega un aviso de prueba.
 */

import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { isDeviceRegistered, needsHomeScreen, pushSupported, registerDevice, unregisterDevice } from "@/lib/push-client"

export function AdminPushToggle() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    isDeviceRegistered("/api/admin/push").then(setEnabled).catch(() => {})
  }, [])

  const enable = async () => {
    if (!pushSupported() || needsHomeScreen()) {
      toast({ title: t("admin_push_unsupported_title"), description: t("admin_push_unsupported_desc"), variant: "destructive" })
      return
    }
    if (!(await registerDevice("/api/admin/push"))) {
      toast({ title: t("admin_push_denied_title"), description: t("admin_push_denied_desc"), variant: "destructive" })
      return
    }
    await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) })
    setEnabled(true)
    toast({ title: t("admin_push_on_title"), description: t("admin_push_on_desc") })
  }

  const disable = async () => {
    await unregisterDevice("/api/admin/push")
    setEnabled(false)
    toast({ title: t("admin_push_off_title") })
  }

  const toggle = async () => {
    setBusy(true)
    try {
      await (enabled ? disable() : enable())
    } catch {
      toast({ title: t("admin_push_error"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={toggle} disabled={busy} title={t("admin_push_hint")}>
      {enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      {enabled ? t("admin_push_disable") : t("admin_push_enable")}
    </Button>
  )
}
