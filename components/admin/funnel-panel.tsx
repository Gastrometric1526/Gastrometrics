"use client"

/**
 * /admin → Crecimiento → Embudo (docs/275): dónde se pierde la gente, de la cuenta nueva a la
 * renovación, y si la invitación a volver a un módulo termina en algo útil o solo en un clic.
 */

import { useState } from "react"
import { Filter, MousePointerClick, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"
import type { FunnelSummary, NudgeOutcome } from "@/lib/admin/funnel"
import { AdminCard, ErrorState, LoadingBlock, formatPercent, useAdminData } from "@/components/admin/ui"

type Range = "30" | "90" | "all"

export function FunnelPanel() {
  const { t } = useLanguage()
  const [range, setRange] = useState<Range>("90")
  const { data, error, loading, reload } = useAdminData<{ funnel: FunnelSummary; nudges: NudgeOutcome[]; stripeChecked: boolean }>(`/api/admin/funnel?since=${range}`)
  if (error && !data) return <ErrorState onRetry={() => reload()} />
  const max = data?.funnel.rows[0]?.count || 1

  return (
    <div className="space-y-6">
      <AdminCard
        title={t("admin_funnel_title")}
        icon={Filter}
        description={t("admin_funnel_desc")}
        help={t("admin_funnel_help")}
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["30", "90", "all"] as Range[]).map((r) => (
            <Button key={r} size="sm" variant={range === r ? "default" : "outline"} onClick={() => setRange(r)}>
              {r === "all" ? t("admin_funnel_all") : t("admin_funnel_days").replace("{n}", r)}
            </Button>
          ))}
        </div>
        {loading && !data ? (
          <LoadingBlock rows={6} />
        ) : data ? (
          <div className="space-y-3">
            {data.funnel.rows.map((row, i) => (
              <div key={row.stage} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {i + 1}. {t(`admin_funnel_stage_${row.stage}` as never)}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    <span className="font-semibold text-foreground">{row.count}</span>
                    {i > 0 && ` · ${t("admin_funnel_of_prev").replace("{p}", formatPercent(row.ofPrevious))}`}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${data.funnel.biggestDrop === row.stage ? "bg-warning" : "bg-primary/70"}`}
                    style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.funnel.biggestDrop && (
              <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning">
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
                {t("admin_funnel_biggest_drop").replace("{stage}", t(`admin_funnel_stage_${data.funnel.biggestDrop}` as never))}
              </p>
            )}
            {data.funnel.tooNewToReturn > 0 && (
              <p className="text-xs text-muted-foreground">{t("admin_funnel_too_new").replace("{n}", String(data.funnel.tooNewToReturn))}</p>
            )}
            {!data.stripeChecked && <p className="text-xs text-muted-foreground">{t("admin_funnel_no_stripe")}</p>}
          </div>
        ) : null}
      </AdminCard>

      <AdminCard title={t("admin_nudge_title")} icon={MousePointerClick} description={t("admin_nudge_desc")}>
        {loading && !data ? (
          <LoadingBlock rows={4} />
        ) : !data || data.nudges.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("admin_nudge_empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">{t("admin_nudge_col_module")}</th>
                  <th className="py-2 text-right font-medium">{t("admin_nudge_col_shown")}</th>
                  <th className="py-2 text-right font-medium">{t("admin_nudge_col_opened")}</th>
                  <th className="py-2 text-right font-medium">{t("admin_nudge_col_useful")}</th>
                </tr>
              </thead>
              <tbody>
                {data.nudges.map((n) => (
                  <tr key={n.module} className="border-b border-border/60">
                    <td className="py-2">{n.module}</td>
                    <td className="py-2 text-right tabular-nums">{n.shown}</td>
                    <td className="py-2 text-right tabular-nums">{n.opened}</td>
                    <td className="py-2 text-right tabular-nums">
                      {n.useful}
                      {n.opened > 0 && <span className="ml-1 text-xs text-muted-foreground">({formatPercent((n.useful / n.opened) * 100)})</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  )
}
