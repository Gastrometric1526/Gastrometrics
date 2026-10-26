"use client"

/**
 * «Reenviar correo de confirmación» (docs/204): en «Revisa tu correo» después del registro y en
 * el inicio de sesión cuando la cuenta todavía no confirmó. Espera 60 s entre envíos (igual que
 * el servidor) y lo muestra con una cuenta regresiva.
 */

import { useEffect, useState } from "react"
import { MailCheck, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"

export function ResendConfirmationButton({ email, variant = "outline", className = "" }: { email: string; variant?: "outline" | "ghost" | "default"; className?: string }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [sending, setSending] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  const resend = async () => {
    if (!email || sending || wait > 0) return
    setSending(true)
    try {
      const res = await fetch("/api/auth/resend-confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        toast({ title: t("resend_confirmation_too_soon") })
        setWait(60)
      } else if (!res.ok) {
        toast({ title: t("resend_confirmation_error"), variant: "destructive" })
      } else if (data?.alreadyConfirmed) {
        toast({ title: t("resend_confirmation_already") })
      } else {
        toast({ title: t("resend_confirmation_sent_title"), description: t("resend_confirmation_sent_desc").replace("{email}", email) })
        setWait(60)
      }
    } catch {
      toast({ title: t("resend_confirmation_error"), variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <Button type="button" variant={variant} onClick={resend} disabled={!email || sending || wait > 0} className={`gap-2 ${className}`}>
      {sending ? <RotateCw className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
      {wait > 0 ? t("resend_confirmation_wait").replace("{seconds}", String(wait)) : t("resend_confirmation_button")}
    </Button>
  )
}
