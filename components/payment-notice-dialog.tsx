"use client"

/**
 * Confirmación de cobro en la app (docs/183): al entrar después de un cobro de Stripe,
 * una ventana dice si se cobró (monto, plan, fecha, siguiente cobro, factura) o si NO se
 * pudo cobrar (no se cobró nada; actualizar la tarjeta). Sale una sola vez por cobro y
 * espera a que no haya otra ventana abierta. El mismo aviso llega por correo.
 */

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { formatDate } from "@/lib/date-format"
import { getPlanBySlug } from "@/lib/plans"
import type { PaymentRecord } from "@/lib/payment-notice"

const QUIET_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/planes", "/about", "/contacto", "/admin"]

export const formatMoney = (cents: number | null, currency: string) =>
  typeof cents === "number" ? `${currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `}${(cents / 100).toFixed(2)}` : "—"

export function PaymentNoticeDialog() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const pathname = usePathname()
  const [payment, setPayment] = useState<PaymentRecord | null>(null)
  const [open, setOpen] = useState(false)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    if (!user || QUIET_PATHS.includes(pathname || "")) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    fetch("/api/billing/notice")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.payment) return
        setPayment(json.payment)
        const tryOpen = () => {
          if (cancelled) return
          if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
            timer = setTimeout(tryOpen, 1500)
            return
          }
          setOpen(true)
          fetch("/api/billing/notice", { method: "POST" }).catch(() => {})
        }
        timer = setTimeout(tryOpen, 1500)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Una vez por sesión de usuario; pathname solo decide si es una página de la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const updateCard = async () => {
    setOpening(true)
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
        return
      }
      window.location.href = "/mi-plan"
    } catch {
      window.location.href = "/mi-plan"
    }
  }

  if (!payment) return null
  const paid = payment.status === "paid"
  const plan = payment.planSlug ? getPlanBySlug(payment.planSlug).name : "GastroMetrics"
  const amount = formatMoney(payment.amountCents, payment.currency)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {paid ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
            <DialogTitle>{paid ? t("payment_notice_paid_title") : t("payment_notice_failed_title")}</DialogTitle>
          </div>
          <DialogDescription className="text-foreground">
            {(paid ? t("payment_notice_paid_body") : t("payment_notice_failed_body"))
              .replace("{amount}", amount)
              .replace("{plan}", plan)
              .replace("{date}", formatDate(payment.at))}
          </DialogDescription>
        </DialogHeader>
        {paid && payment.nextAt && <p className="text-sm text-muted-foreground">{t("payment_notice_next").replace("{date}", formatDate(payment.nextAt))}</p>}
        {!paid && <p className="text-sm text-muted-foreground">{t("payment_notice_failed_hint")}</p>}
        <DialogFooter className="gap-2 sm:gap-0">
          {paid ? (
            <>
              {payment.invoiceUrl && (
                <Button asChild variant="outline">
                  <a href={payment.invoiceUrl} target="_blank" rel="noopener noreferrer">
                    {t("payment_notice_invoice")}
                  </a>
                </Button>
              )}
              <Button onClick={() => setOpen(false)}>{t("payment_notice_ok")}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={opening}>
                {t("payment_notice_later")}
              </Button>
              <Button onClick={updateCard} disabled={opening} className="gap-2">
                {opening && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("payment_notice_update_card")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
