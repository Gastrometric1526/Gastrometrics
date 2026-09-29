"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale, type TranslationKey } from "@/lib/i18n/translations"
import { getPlanBySlug } from "@/lib/plans"
import { Trophy } from "lucide-react"

interface UserUsage {
  userId: string
  email: string
  name: string
  plan: string
  activeDays: number
  actions: number
  visits: number
  topModules: string[]
  totalActiveSeconds: number
  lastSeenAt: string | null
}

interface TopUsersData {
  days: number
  totalActiveUsers: number
  users: UserUsage[]
}

// Nombre visible de cada módulo de activity_log — los mismos textos del menú lateral.
const MODULE_LABEL_KEY: Record<string, TranslationKey> = {
  dashboard: "nav_dashboard",
  ficha_tecnica: "nav_ficha_tecnica",
  recetas: "nav_mis_recetas",
  ingredientes: "nav_ingredientes",
  inventario: "nav_inventario",
  equipo: "nav_equipo",
  menus: "nav_menus",
  ordenes_compra: "nav_ordenes_compra",
  estadisticas: "nav_estadisticas",
  negocios: "nav_negocios",
  merma: "admin_top_users_module_merma",
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}

/**
 * Usuarios que más usan la app (docs/141): días activos, acciones y visitas en el período,
 * módulos más usados, tiempo total en la app y última vez visto. Datos de
 * /api/admin/top-users (activity_log + user_presence).
 */
export function TopUsersPanel() {
  const { t, language } = useLanguage()
  const [days, setDays] = useState("30")
  const [sort, setSort] = useState("days")
  const [data, setData] = useState<TopUsersData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFailed(false)
    fetch(`/api/admin/top-users?days=${days}&sort=${sort}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return
        if (json.error) setFailed(true)
        else setData(json)
      })
      .catch((error) => {
        console.error("Error cargando usuarios más activos:", error)
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [days, sort])

  const moduleLabel = (m: string) => (MODULE_LABEL_KEY[m] ? t(MODULE_LABEL_KEY[m]) : m)

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {t("admin_top_users_title")}
          </CardTitle>
          <CardDescription>
            {data
              ? t("admin_top_users_summary")
                  .replace("{count}", String(data.totalActiveUsers))
                  .replace("{days}", String(data.days))
              : t("admin_top_users_description")}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-[150px]" aria-label={t("admin_top_users_period")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["7", "30", "90"].map((d) => (
                <SelectItem key={d} value={d}>
                  {t("admin_top_users_last_days").replace("{days}", d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[190px]" aria-label={t("admin_top_users_sort")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="days">{t("admin_top_users_sort_days")}</SelectItem>
              <SelectItem value="actions">{t("admin_top_users_sort_actions")}</SelectItem>
              <SelectItem value="time">{t("admin_top_users_sort_time")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {failed ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("admin_top_users_error")}</p>
        ) : !data ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : data.users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("admin_top_users_empty")}</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{t("admin_top_users_col_user")}</TableHead>
                  <TableHead>{t("admin_top_users_col_plan")}</TableHead>
                  <TableHead className="text-right">{t("admin_top_users_col_days")}</TableHead>
                  <TableHead className="text-right">{t("admin_top_users_col_actions")}</TableHead>
                  <TableHead className="text-right">{t("admin_top_users_col_visits")}</TableHead>
                  <TableHead>{t("admin_top_users_col_modules")}</TableHead>
                  <TableHead className="text-right">{t("admin_top_users_col_time")}</TableHead>
                  <TableHead>{t("admin_top_users_col_last_seen")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((u, i) => (
                  <TableRow key={u.userId}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPlanBySlug(u.plan).name}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{u.activeDays}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.actions}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.visits}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.topModules.length ? u.topModules.map(moduleLabel).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatDuration(u.totalActiveSeconds)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString(getDateLocale(language)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("admin_top_users_footnote")}</p>
      </CardContent>
    </Card>
  )
}
