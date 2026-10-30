"use client"

/**
 * Detalle de una notificación (pedido del dueño, docs/208): al tocar un aviso de
 * «Notificaciones» se abre esta ventana con qué pasó, el antes y el después, por qué pasó y
 * un botón para ir a resolverlo (la Ficha de la receta, Mi Plan…). La usan el Dashboard y la
 * pantalla de cada negocio.
 */

import { useRouter } from "next/navigation"
import { ArrowRight, Bell, CreditCard, TrendingUp } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import { formatDateTime } from "@/lib/date-format"
import { formatCurrency } from "@/lib/currency"
import { getPlanBySlug } from "@/lib/plans"
import { formatActivityEntry, notificationHref, type ActivityLogEntry } from "@/lib/services/activity-log"

export function NotificationDetailDialog({ entry, onClose }: { entry: ActivityLogEntry | null; onClose: () => void }) {
  const { t } = useLanguage()
  const router = useRouter()
  if (!entry) return null

  const m = entry.metadata ?? {}
  const num = (v: unknown) => Number(v ?? 0)
  const rows: [string, string][] = []
  let why = ""
  let action = ""
  let Icon = Bell

  if (entry.action === "price_raised") {
    Icon = TrendingUp
    rows.push([t("notif_detail_recipe"), entry.entityLabel ?? "—"])
    rows.push([t("notif_detail_price_before"), formatCurrency(num(m.from))])
    rows.push([t("notif_detail_price_now"), formatCurrency(num(m.to))])
    why = t("notif_detail_why_price_raised")
    action = t("notif_detail_action_recipe")
  } else if (entry.action === "margin_up") {
    Icon = TrendingUp
    rows.push([t("notif_detail_recipe"), entry.entityLabel ?? "—"])
    rows.push([t("notif_detail_price_kept"), formatCurrency(num(m.price))])
    rows.push([t("notif_detail_margin"), `${num(m.from).toFixed(1)} % → ${num(m.to).toFixed(1)} %`])
    why = t("notif_detail_why_margin_up")
    action = t("notif_detail_action_recipe")
  } else if (entry.action === "plan_changed") {
    Icon = CreditCard
    rows.push([t("notif_detail_plan_before"), getPlanBySlug(String(m.from ?? "")).name])
    rows.push([t("notif_detail_plan_now"), getPlanBySlug(String(m.to ?? entry.entityLabel ?? "")).name])
    why = t("notif_detail_why_plan")
    action = t("notif_detail_action_plan")
  }

  const href = notificationHref(entry)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-left">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>{formatActivityEntry(entry, t)}</span>
          </DialogTitle>
          <DialogDescription className="text-left">{formatDateTime(entry.createdAt)}</DialogDescription>
        </DialogHeader>
        {rows.length > 0 && (
          <dl className="divide-y divide-border rounded-lg border border-border text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {why && (
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground">
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("notif_detail_why")}</p>
            <p className="leading-relaxed">{why}</p>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            {t("whats_new_close")}
          </Button>
          {href && (
            <Button
              className="w-full gap-2 sm:w-auto"
              onClick={() => {
                onClose()
                router.push(href)
              }}
            >
              {action || t("notif_detail_action_go")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
