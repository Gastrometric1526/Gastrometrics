"use client"

/**
 * Configuración → Notificaciones: recibir avisos en este aparato (docs/241). Se activa por
 * aparato y nunca se pide el permiso solo al entrar a la app.
 */

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { isDeviceRegistered, needsHomeScreen, pushSupported, registerDevice, unregisterDevice } from "@/lib/push-client"

export function PushDeviceSetting() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [supported, setSupported] = useState(true)
  const [homeScreen, setHomeScreen] = useState(false)

  useEffect(() => {
    setSupported(pushSupported())
    setHomeScreen(needsHomeScreen())
    isDeviceRegistered("/api/push").then(setEnabled).catch(() => {})
  }, [])

  const toggle = async (next: boolean) => {
    setBusy(true)
    try {
      if (next) {
        const granted = await registerDevice("/api/push")
        if (!granted) toast({ title: t("push_denied_title"), description: t("push_denied_desc"), variant: "destructive" })
        setEnabled(granted)
      } else {
        await unregisterDevice("/api/push")
        setEnabled(false)
      }
    } catch {
      toast({ title: t("push_error"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="notif-push-device">{t("push_setting_title")}</Label>
          <p className="text-sm text-muted-foreground">{t("push_setting_desc")}</p>
        </div>
        <Switch id="notif-push-device" checked={enabled} disabled={busy || !supported || homeScreen} onCheckedChange={toggle} />
      </div>
      {(homeScreen || !supported) && <p className="text-xs text-muted-foreground">{t(homeScreen ? "push_setting_ios" : "push_setting_unsupported")}</p>}
    </div>
  )
}
