"use client"

/**
 * Indicador del vencimiento del plan en el menú lateral (docs/165), junto a «Plan: …».
 * Pedido del dueño: algo muy intuitivo que muestre cuánto falta o cuándo hay que pagar.
 *
 * - Faltan más de 7 días: gris, «12 días» (informa sin alarmar).
 * - 4 a 7 días: ámbar. 3 días o menos: rojo, «Vence en 2 d». El mismo día: «Vence hoy».
 * - Pago programado: verde, «Renueva 23 oct» (tranquilidad: ya está resuelto).
 * - Cobro programado fallido: rojo, «Pago pendiente».
 * Tocarlo abre la ventana de vencimiento (components/plan-expiry-dialog.tsx).
 */

import { CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { usePlanStatus, planExpiryOf, OPEN_PLAN_EXPIRY_EVENT } from "@/lib/plan-status"

export type ChipTone = "calm" | "soon" | "urgent" | "ok"

export function usePlanCountdown(): { tone: ChipTone; label: string; tooltip: string } | null {
  const { t, language } = useLanguage()
  const status = usePlanStatus()
  const expiry = planExpiryOf(status)
  if (!status) return null
  const shortDate = (iso: string) => new Date(iso).toLocaleDateString(getDateLocale(language), { day: "numeric", month: "short" })

  if (status.renewal?.status === "payment_failed") {
    return { tone: "urgent", label: t("plan_chip_payment_failed"), tooltip: t("plan_expiry_failed_title") }
  }
  if (status.renewal?.status === "scheduled") {
    const date = shortDate(status.renewal.startsAt)
    return { tone: "ok", label: t("plan_chip_renews").replace("{date}", date), tooltip: t("plan_expiry_scheduled_title") }
  }
  if (!expiry || !status.planExpiresAt) return null
  const tooltip = t("plan_chip_tooltip").replace("{date}", shortDate(status.planExpiresAt))
  if (expiry.urgency === "today") return { tone: "urgent", label: t("plan_chip_today"), tooltip }
  if (expiry.urgency === "urgent") return { tone: "urgent", label: t("plan_chip_days_short").replace("{count}", String(expiry.daysLeft)), tooltip }
  return {
    tone: expiry.urgency === "soon" ? "soon" : "calm",
    label: (expiry.daysLeft === 1 ? t("plan_chip_one_day") : t("plan_chip_days")).replace("{count}", String(expiry.daysLeft)),
    tooltip,
  }
}

const TONE_CLASSES: Record<ChipTone, string> = {
  calm: "bg-muted text-muted-foreground",
  soon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgent: "bg-destructive/15 text-destructive",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
}
const DOT_CLASSES: Record<ChipTone, string> = {
  calm: "bg-muted-foreground/60",
  soon: "bg-amber-500",
  urgent: "bg-destructive",
  ok: "bg-emerald-500",
}

export function openPlanExpiryDialog(event?: { preventDefault: () => void; stopPropagation: () => void }) {
  event?.preventDefault()
  event?.stopPropagation()
  window.dispatchEvent(new CustomEvent(OPEN_PLAN_EXPIRY_EVENT))
}

/** Pastilla con la cuenta regresiva (menú abierto). */
export function PlanCountdownChip({ className }: { className?: string }) {
  const countdown = usePlanCountdown()
  if (!countdown) return null
  const Icon = countdown.tone === "ok" ? CheckCircle2 : countdown.tone === "urgent" ? AlertTriangle : CalendarClock
  return (
    <span
      role="button"
      tabIndex={0}
      title={countdown.tooltip}
      onClick={openPlanExpiryDialog}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") openPlanExpiryDialog(event)
      }}
      data-tour="plan-countdown"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none",
        TONE_CLASSES[countdown.tone],
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {countdown.label}
    </span>
  )
}

/** Punto de color (menú colapsado o botón del menú en el celular). */
export function PlanCountdownDot({ className, onlyAlerts = false }: { className?: string; onlyAlerts?: boolean }) {
  const countdown = usePlanCountdown()
  if (!countdown || (onlyAlerts && countdown.tone !== "urgent" && countdown.tone !== "soon")) return null
  return (
    <span
      aria-hidden
      className={cn("absolute h-2 w-2 rounded-full ring-2 ring-card", DOT_CLASSES[countdown.tone], className)}
    />
  )
}
