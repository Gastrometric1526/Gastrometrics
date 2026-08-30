"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ProgressBar } from "@/components/ui/dashboard"
import { useLanguage } from "@/contexts/language-context"
import { Users, Building2, MailWarning, Bug } from "lucide-react"

interface Stats {
  totalUsers: number
  totalBusinesses: number
  totalTeamMembers: number
  planDistribution: { slug: string; name: string; count: number }[]
  estimatedMrrUsdCents: number
}

// Mismo patrón visual que las tarjetas de estadística de app/dashboard/page.tsx (chip de
// ícono con tinte de color, usando los tokens --chart-* ya definidos en globals.css) —
// antes esta pestaña solo mostraba números planos, sin nada visual que los distinga.
const STAT_CARDS = [
  { key: "totalUsers" as const, labelKey: "admin_stat_users" as const, icon: Users, bg: "bg-chart-1/10", text: "text-chart-1" },
  { key: "totalBusinesses" as const, labelKey: "admin_stat_businesses" as const, icon: Building2, bg: "bg-chart-2/10", text: "text-chart-2" },
  { key: "unread" as const, labelKey: "admin_stat_unread" as const, icon: MailWarning, bg: "bg-chart-4/10", text: "text-chart-4" },
  { key: "bugs" as const, labelKey: "admin_stat_bugs" as const, icon: Bug, bg: "bg-chart-7/10", text: "text-chart-7" },
]

const PLAN_BAR_COLORS: Array<"blue" | "green" | "amber" | "red"> = ["blue", "green", "amber", "red"]

/** Estadísticas globales reales (no "este navegador") — pedido explícito del dueño del proyecto, ver docs/63. Rediseñado en docs/71. */
export function StatsPanel({ feedbackCounts }: { feedbackCounts: { total: number; nuevo: number; bug: number } }) {
  const { t } = useLanguage()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setStats(data)
      })
      .catch((error) => console.error("Error cargando estadísticas:", error))
  }, [])

  const mrr = stats ? (stats.estimatedMrrUsdCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—"
  const maxPlanCount = stats ? Math.max(1, ...stats.planDistribution.map((p) => p.count)) : 1
  const values: Record<string, number> = {
    totalUsers: stats?.totalUsers ?? 0,
    totalBusinesses: stats?.totalBusinesses ?? 0,
    unread: feedbackCounts.nuevo,
    bugs: feedbackCounts.bug,
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map((card) => (
          <Card key={card.key}>
            <CardContent className="p-4 space-y-3">
              <div className={`inline-flex p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.text}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(card.labelKey)}</p>
                {stats ? (
                  <p className="text-2xl font-bold text-foreground">{values[card.key]}</p>
                ) : (
                  <Skeleton className="h-8 w-12 mt-1" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_plan_distribution_title")}</CardTitle>
          <CardDescription>
            {t("admin_stat_mrr")}: <span className="font-semibold text-foreground">{mrr}</span>
            <br />
            <span className="text-xs">{t("admin_mrr_disclaimer")}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-3">
              {stats.planDistribution.map((p, index) => (
                <div key={p.slug} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.count}</span>
                  </div>
                  <ProgressBar
                    value={(p.count / maxPlanCount) * 100}
                    color={PLAN_BAR_COLORS[index % PLAN_BAR_COLORS.length]}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
