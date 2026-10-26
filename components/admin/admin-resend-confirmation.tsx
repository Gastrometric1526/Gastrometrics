"use client"

/** /admin: «Reenviar confirmación» a una cuenta sin confirmar (docs/204). */

import { useState } from "react"
import { MailCheck, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"

export function AdminResendConfirmation({ userId, email, size = "sm" }: { userId?: string; email?: string; size?: "sm" | "default" }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/admin/resend-confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userId ? { userId } : { email }) })
      const data = await res.json().catch(() => ({}))
      const result = data?.result as string | undefined
      if (result === "sent") toast({ title: t("admin_resend_confirmation_sent") })
      else if (result === "already_confirmed") toast({ title: t("admin_resend_confirmation_already") })
      else if (result === "too_soon") toast({ title: t("resend_confirmation_too_soon") })
      else if (result === "not_found") toast({ title: t("admin_resend_confirmation_not_found"), variant: "destructive" })
      else toast({ title: t("resend_confirmation_error"), variant: "destructive" })
    } catch {
      toast({ title: t("resend_confirmation_error"), variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button type="button" size={size} variant="outline" onClick={run} disabled={busy} className="gap-1.5">
      {busy ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <MailCheck className="h-3.5 w-3.5" />}
      {t("admin_resend_confirmation")}
    </Button>
  )
}
