"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Eye, CalendarDays, CalendarRange } from "lucide-react"
import { BUSINESS_TYPES, BUSINESS_SIZES, EXPERIENCE_LEVELS, COUNTRIES } from "@/lib/types/user"

interface AnalyticsData {
  totalAllTime: number
  total30d: number
  total7d: number
  topPaths: { path: string; count: number }[]
  languageBreakdown: { language: string; count: number }[]
  viewsByDay: { day: string; count: number }[]
  productEvents: { event: string; count: number }[]
  businessProfile: {
    types: { value: string; count: number }[]
    sizes: { value: string; count: number }[]
    experience: { value: string; count: number }[]
    countries: { value: string; count: number }[]
  }
}

// Mismo orden que el embudo real: llegó → creó cuenta → creó su primer ingrediente →
// creó su primera receta → exportó su primer PDF → hizo clic en actualizar → empezó a
// pagar. Nombres legibles acá en vez de en la base — ver
// supabase/migrations/0029_product_events.sql para el nombre real de cada evento.
const EVENT_LABELS: Record<string, string> = {
  signup_completed: "Cuentas creadas",
  first_ingredient_created: "Ingredientes creados",
  first_recipe_created: "Recetas creadas",
  first_pdf_exported: "PDFs exportados",
  upgrade_clicked: "Clics en \"actualizar plan\"",
  checkout_started: "Pagos iniciados (Stripe)",
}

// Perfil de negocios — mismos catálogos que app/signup/page.tsx paso 3, para que la
// etiqueta que ve el admin sea idéntica a la que vio la persona al registrarse.
function businessTypeLabel(t: (key: any) => string, value: string): string {
  const found = BUSINESS_TYPES.find((b) => b.value === value)
  return found ? t(found.labelKey) : value
}
function businessSizeLabel(t: (key: any) => string, value: string): string {
  const found = BUSINESS_SIZES.find((b) => b.value === value)
  return found ? t(found.labelKey) : value
}
function experienceLabel(t: (key: any) => string, value: string): string {
  const found = EXPERIENCE_LEVELS.find((e) => e.value === value)
  return found ? t(found.labelKey) : value
}
function countryLabel(t: (key: any) => string, code: string): string {
  const found = COUNTRIES.find((c) => c.code === code)
  return found ? t(found.labelKey) : code
}

const STAT_CARDS = [
  { key: "totalAllTime" as const, labelKey: "admin_analytics_total_alltime" as const, icon: Eye, bg: "bg-chart-1/10", text: "text-chart-1" },
  { key: "total30d" as const, labelKey: "admin_analytics_total_30d" as const, icon: CalendarRange, bg: "bg-chart-2/10", text: "text-chart-2" },
  { key: "total7d" as const, labelKey: "admin_analytics_total_7d" as const, icon: CalendarDays, bg: "bg-chart-3/10", text: "text-chart-3" },
]

/** Analíticas propias de tráfico (ver docs/67) — no depende de Vercel Web Analytics. Rediseñado en docs/71. */
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
        {STAT_CARDS.map((card) => (
          <Card key={card.key}>
            <CardContent className="p-4 space-y-3">
              <div className={`inline-flex p-2 rounded-lg ${card.bg}`}>
                <card.icon className={`h-5 w-5 ${card.text}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(card.labelKey)}</p>
                {data ? (
                  <p className="text-2xl font-bold text-foreground">{data[card.key]}</p>
                ) : (
                  <Skeleton className="h-8 w-12 mt-1" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Embudo de activación (ver supabase/migrations/0029_product_events.sql) —
          conteos agregados de los últimos 30 días, no un embudo por-persona (esta app
          no guarda ningún identificador persistente de visitante, a propósito, ver el
          comentario de la migración). Si la lista sale vacía con `data` ya cargado, lo
          más probable es que la migración 0029 todavía no se corrió en el SQL Editor
          de Supabase, no que de verdad no pasó nada. */}
      <Card>
        <CardHeader>
          <CardTitle>Embudo de activación (últimos 30 días)</CardTitle>
          <CardDescription>Cuántas veces pasó cada paso — no es por-persona, son conteos totales.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.productEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay eventos registrados. Si esperabas ver algo acá, confirma que la migración
              0029_product_events.sql ya se corrió en el SQL Editor de Supabase.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.productEvents.map((e) => (
                <div key={e.event} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm text-foreground">{EVENT_LABELS[e.event] || e.event}</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perfil de negocios — pedido explícito del dueño del proyecto: ver en admin
          qué contestó la gente en el cuestionario del registro (paso 3 de
          app/signup/page.tsx). Todas las cuentas reales tienen esto, obligatorio
          desde el principio del registro — a diferencia del embudo de arriba, esto
          no depende de ninguna migración nueva. */}
      <Card>
        <CardHeader>
          <CardTitle>Perfil de negocios</CardTitle>
          <CardDescription>Lo que la gente contestó al registrarse — todas las cuentas reales.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {(
                [
                  { title: "Tipo de negocio", rows: data.businessProfile.types, label: businessTypeLabel },
                  { title: "Tamaño", rows: data.businessProfile.sizes, label: businessSizeLabel },
                  { title: "Experiencia", rows: data.businessProfile.experience, label: experienceLabel },
                  { title: "País", rows: data.businessProfile.countries, label: countryLabel },
                ] as const
              ).map((group) => {
                const total = group.rows.reduce((sum, r) => sum + r.count, 0) || 1
                return (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{group.title}</p>
                    {group.rows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-1.5">
                        {group.rows.slice(0, 5).map((row) => (
                          <div key={row.value} className="space-y-0.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-foreground truncate pr-2">
                                {row.value === "—" ? "—" : group.label(t, row.value)}
                              </span>
                              <span className="text-muted-foreground tabular-nums shrink-0">{row.count}</span>
                            </div>
                            <div className="h-1 rounded-full bg-hairline overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${(row.count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {data ? t("admin_analytics_empty") : <Skeleton className="h-4 w-48 mx-auto" />}
          </CardContent>
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
                <div className="rounded-lg border border-border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("admin_analytics_table_path")}</TableHead>
                        <TableHead className="text-right">{t("admin_analytics_table_views")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.topPaths.map((p) => (
                        <TableRow key={p.path}>
                          <TableCell className="text-foreground">{p.path}</TableCell>
                          <TableCell className="text-muted-foreground text-right">{p.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
