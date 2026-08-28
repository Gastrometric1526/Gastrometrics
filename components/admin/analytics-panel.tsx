"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useLanguage } from "@/contexts/language-context"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface AnalyticsData {
  totalAllTime: number
  total30d: number
  total7d: number
  topPaths: { path: string; count: number }[]
  languageBreakdown: { language: string; count: number }[]
  viewsByDay: { day: string; count: number }[]
}

/** Analíticas propias de tráfico (ver docs/67) — no depende de Vercel Web Analytics. */
export function AnalyticsPanel() {
  const { t } = useLanguage()
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setData(json)
      })
      .catch((error) => console.error("Error cargando analíticas:", error))
  }, [])

  const hasData = !!data && data.totalAllTime > 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_analytics_total_alltime")}</CardDescription>
            <CardTitle className="text-3xl">{data ? data.totalAllTime : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_analytics_total_30d")}</CardDescription>
            <CardTitle className="text-3xl">{data ? data.total30d : "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("admin_analytics_total_7d")}</CardDescription>
            <CardTitle className="text-3xl">{data ? data.total7d : "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">{t("admin_analytics_empty")}</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t("admin_analytics_chart_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data!.viewsByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("admin_analytics_top_paths_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-border">
                      <th className="py-2 pr-2 font-medium">{t("admin_analytics_table_path")}</th>
                      <th className="py-2 pr-2 font-medium text-right">{t("admin_analytics_table_views")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.topPaths.map((p) => (
                      <tr key={p.path} className="border-b border-border/50">
                        <td className="py-2 pr-2 text-foreground">{p.path}</td>
                        <td className="py-2 pr-2 text-muted-foreground text-right">{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("admin_analytics_language_title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data!.languageBreakdown.map((l) => (
                    <div key={l.language} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{l.language}</span>
                      <span className="text-muted-foreground">{l.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
