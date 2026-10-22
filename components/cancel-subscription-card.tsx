"use client"

/**
 * «Cancelar suscripción» en Mi Plan (docs/182), sin pasar por el Portal de Stripe. Usa
 * /api/plan/set-free: con suscripción, programa cancel_at_period_end (sigue el plan hasta
 * el fin del período pagado, Términos §4.1) y el webhook escribe la fecha; Mi Plan muestra
 * entonces el aviso «Tu suscripción está cancelada…».
 */

import { useState } from "react"
import { Loader2, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/date-format"

export function CancelSubscriptionCard({ planName, periodEnd, onCancelled }: { planName: string; periodEnd: string | null; onCancelled: () => void }) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const cancel = async () => {
    setBusy(true)
    setError("")
    try {
      const res = await fetch("/api/plan/set-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: "foodie" }),
      })
      if (!res.ok) {
        setError(t("planes_downgrade_error_desc"))
        return
      }
      toast({
        title: t("mi_plan_cancel_sub_done_title"),
        description: periodEnd ? t("mi_plan_cancel_sub_done_desc").replace("{date}", formatDate(periodEnd)) : t("mi_plan_cancel_sub_done_desc_no_date"),
      })
      setConfirming(false)
      onCancelled()
    } catch {
      setError(t("planes_downgrade_error_desc"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-destructive" />
          {t("mi_plan_cancel_sub_title")}
        </CardTitle>
        <CardDescription>
          {periodEnd
            ? t("mi_plan_cancel_sub_body").replace("{plan}", planName).replace("{date}", formatDate(periodEnd))
            : t("mi_plan_cancel_sub_body_no_date").replace("{plan}", planName)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!confirming ? (
          <Button variant="outline" className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/10" onClick={() => setConfirming(true)}>
            <XCircle className="h-4 w-4" />
            {t("mi_plan_cancel_sub_button")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-foreground">{t("mi_plan_cancel_sub_confirm")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy}>
                {t("mi_plan_cancel_sub_keep")}
              </Button>
              <Button variant="destructive" onClick={cancel} disabled={busy} className="gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("mi_plan_cancel_sub_confirm_button")}
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
