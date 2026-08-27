"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"

interface Stats {
  totalUsers: number
  totalBusinesses: number
  totalTeamMembers: number
  planDistribution: { slug: string; name: string; count: number }[]
  estimatedMrrUsdCents: number
}

/** Estadísticas globales reales (no "este navegador") — pedido explícito del dueño del proyecto, ver docs/63. */
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_stat_users")}</CardDescription>
            <CardTitle className="text-3xl">{stats ? stats.totalUsers : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_stat_businesses")}</CardDescription>
            <CardTitle className="text-3xl">{stats ? stats.totalBusinesses : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_stat_unread")}</CardDescription>
            <CardTitle className="text-3xl">{feedbackCounts.nuevo}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_stat_bugs")}</CardDescription>
            <CardTitle className="text-3xl">{feedbackCounts.bug}</CardTitle>
          </CardHeader>
        </Card>
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
            <div className="space-y-2">
              {stats.planDistribution.map((p) => (
                <div key={p.slug} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.name}</span>
                  <span className="text-muted-foreground">{p.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">…</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
