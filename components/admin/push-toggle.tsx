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

function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window

export function AdminPushToggle() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!pushSupported()) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(Boolean(sub)))
      .catch(() => {})
  }, [])

  const enable = async () => {
    if (!pushSupported()) {
      toast({ title: t("admin_push_unsupported_title"), description: t("admin_push_unsupported_desc"), variant: "destructive" })
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      toast({ title: t("admin_push_denied_title"), description: t("admin_push_denied_desc"), variant: "destructive" })
      return
    }
    const info = await fetch("/api/admin/push").then((r) => (r.ok ? r.json() : Promise.reject()))
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(info.publicKey) })
    const saved = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON(), label: navigator.userAgent }),
    })
    if (!saved.ok) throw new Error()
    await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) })
    setEnabled(true)
    toast({ title: t("admin_push_on_title"), description: t("admin_push_on_desc") })
  }

  const disable = async () => {
    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      await fetch("/api/admin/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) })
      await subscription.unsubscribe()
    }
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
