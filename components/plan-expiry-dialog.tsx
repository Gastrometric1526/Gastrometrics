"use client"

/**
 * Ventana de vencimiento del plan (docs/165). Pedido del dueño: 3 días antes y el día
 * que vence, avisar que la cuenta pasará a Foodie y ofrecer dejar programado el pago
 * del plan que la persona elija. El plan solo cambia cuando Stripe confirma el cobro
 * (lib/services/scheduled-renewal.ts).
 *
 * Sale sola una vez por etapa (3 días antes / el día) y si el cobro programado falló.
 * También se abre desde el indicador del menú lateral (OPEN_PLAN_EXPIRY_EVENT).
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarClock, Check, CheckCircle2, X, AlertTriangle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useToast } from "@/hooks/use-toast"
import { getLocalizedPlans, getLocalizedPlan, getPlanBySlug } from "@/lib/plans"
import { getDateLocale } from "@/lib/i18n/translations"
import { usePlanStatus, planExpiryOf, refreshPlanStatus, OPEN_PLAN_EXPIRY_EVENT } from "@/lib/plan-status"

// Páginas públicas y de cuenta: ahí no se interrumpe con la ventana.
const QUIET_PATHS = ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/planes", "/about", "/contacto", "/admin"]

function seenKey(userId: string, stage: string, ref: string) {
  return `gm_plan_expiry_seen:${userId}:${stage}:${ref}`
}
function wasSeen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1"
  } catch {
    return false
  }
}
function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, "1")
  } catch {
    // modo privado: puede volver a salir, no rompe nada
  }
}

export function PlanExpiryDialog() {
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const { toast } = useToast()
  const pathname = usePathname()
  const status = usePlanStatus()
  const expiry = planExpiryOf(status)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plans = useMemo(() => getLocalizedPlans(language), [language])
  const purchasable = plans.filter((plan) => plan.priceUsdCents > 0 && !plan.comingSoon)
  const currentPlan = status ? getLocalizedPlan(getPlanBySlug(status.planSlug), language) : null
  const defaultSlug =
    purchasable.find((plan) => plan.slug === status?.planSlug)?.slug ||
    purchasable.find((plan) => plan.highlighted)?.slug ||
    purchasable[purchasable.length - 1]?.slug
  const [selected, setSelected] = useState<string | undefined>(defaultSlug)
  useEffect(() => setSelected(defaultSlug), [defaultSlug])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(getDateLocale(language), { weekday: "long", day: "numeric", month: "long" })

  // Apertura automática: una vez por etapa y fecha de vencimiento.
  useEffect(() => {
    if (!user || !status || QUIET_PATHS.includes(pathname || "")) return
    let key: string | null = null
    if (status.renewal?.status === "payment_failed") key = seenKey(user.id, "failed", new Date().toDateString())
    else if (expiry?.reminderStage && !status.renewal) key = seenKey(user.id, expiry.reminderStage, status.planExpiresAt || "")
    if (!key || wasSeen(key)) return
    // Espera a que se cierre cualquier otra ventana (novedades, cambio de plan, tutorial)
    // para no encimarse.
    let timer: ReturnType<typeof setTimeout>
    const tryOpen = () => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        timer = setTimeout(tryOpen, 1500)
        return
      }
      markSeen(key!)
      setOpen(true)
    }
    timer = setTimeout(tryOpen, 1200)
    return () => clearTimeout(timer)
  }, [user, status, expiry?.reminderStage, pathname])

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_PLAN_EXPIRY_EVENT, handler)
    return () => window.removeEventListener(OPEN_PLAN_EXPIRY_EVENT, handler)
  }, [])

  if (!status || !currentPlan) return null
  const renewal = status.renewal
  if (!expiry && !renewal) return null

  const foodie = getLocalizedPlan(getPlanBySlug("foodie"), language)
  const lost = foodie.locked.slice(0, 5)
  const moreCount = foodie.locked.length - lost.length
  const selectedPlan = purchasable.find((plan) => plan.slug === selected)
  const expiresLabel = status.planExpiresAt ? formatDate(status.planExpiresAt) : ""
  const title = !expiry
    ? ""
    : expiry.daysLeft === 0
      ? t("plan_expiry_title_today").replace("{plan}", currentPlan.name)
      : (expiry.daysLeft === 1 ? t("plan_expiry_title_one_day") : t("plan_expiry_title_days"))
          .replace("{plan}", currentPlan.name)
          .replace("{count}", String(expiry.daysLeft))

  const startCheckout = async () => {
    if (!selectedPlan) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: selectedPlan.slug, renewal: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error || t("plan_expiry_error"))
    } catch {
      setError(t("plan_expiry_error"))
    }
    setBusy(false)
  }

  const cancelScheduled = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/plan/renewal", { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: t("plan_expiry_cancelled_toast") })
      if (user) await refreshPlanStatus(user.id)
    } catch {
      setError(t("plan_expiry_error"))
    }
    setBusy(false)
  }

  // Pago ya programado: confirmación tranquila, con opción de cancelarlo.
  if (renewal?.status === "scheduled") {
    const plan = getLocalizedPlan(getPlanBySlug(renewal.planSlug), language)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">{t("plan_expiry_scheduled_title")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("plan_expiry_scheduled_desc").replace("{plan}", plan.name).replace("{date}", formatDate(renewal.startsAt))}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => setOpen(false)} className="w-full">
              {t("plan_expiry_ok")}
            </Button>
            <Button variant="ghost" onClick={cancelScheduled} disabled={busy} className="w-full text-muted-foreground">
              {t("plan_expiry_cancel_scheduled")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const failed = renewal?.status === "payment_failed"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div
            className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full ${
              failed || expiry?.urgency === "today" ? "bg-destructive/10" : "bg-amber-500/10"
            }`}
          >
            {failed ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <CalendarClock className={`h-6 w-6 ${expiry?.urgency === "today" ? "text-destructive" : "text-amber-600"}`} />
            )}
          </div>
          <DialogTitle className="text-center">{failed ? t("plan_expiry_failed_title") : title}</DialogTitle>
          <DialogDescription className="text-center">
            {failed ? t("plan_expiry_failed_desc") : t("plan_expiry_body").replace("{date}", expiresLabel)}
          </DialogDescription>
        </DialogHeader>

        {!failed && (
          <ul className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
            {lost.map((item) => (
              <li key={item} className="flex items-start gap-2 text-muted-foreground">
                <X className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
            {moreCount > 0 && (
              <li className="pl-6 text-xs text-muted-foreground">{t("plan_expiry_more").replace("{count}", String(moreCount))}</li>
            )}
          </ul>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("plan_expiry_choose")}</p>
          {purchasable.map((plan) => {
            const isSelected = plan.slug === selected
            return (
              <button
                key={plan.slug}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(plan.slug)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                  isSelected ? "border-primary bg-primary/5" : "border-muted hover:bg-accent/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{plan.name}</span>
                    {plan.highlighted && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                        {t("planes_most_chosen_badge")}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{plan.tagline}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold text-foreground">{plan.price}</span>
                  {isSelected && <Check className="h-4 w-4 text-primary" />}
                </div>
              </button>
            )
          })}
          <p className="text-xs text-muted-foreground">
            {expiry?.canSchedule && !failed
              ? t("plan_expiry_schedule_hint")
                  .replace("{price}", selectedPlan?.price || "")
                  .replace("{date}", expiresLabel)
              : t("plan_expiry_now_hint")}
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={startCheckout} disabled={busy || !selectedPlan} className="w-full">
            {failed
              ? t("plan_expiry_retry_button")
              : expiry?.canSchedule
                ? t("plan_expiry_schedule_button")
                : t("plan_expiry_pay_button").replace("{plan}", selectedPlan?.name || "")}
          </Button>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-muted-foreground">
              {t("plan_expiry_later")}
            </Button>
            <Link href="/mi-plan" onClick={() => setOpen(false)} className="text-sm font-medium text-primary hover:underline">
              {t("plan_expiry_see_plans")}
            </Link>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
