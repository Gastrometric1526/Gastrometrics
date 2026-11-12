"use client"

/**
 * /admin → Crecimiento y uso → «Toda la app» (pedido del dueño, docs/286): el parámetro
 * completo de la app, las cuentas y sus negocios. Totales, uso de cada módulo (cuántas cuentas
 * lo usan y qué parte del total), actividad de 30 días por módulo y cómo se reparten las
 * cuentas por idioma, país, tipo de negocio y plan. Cálculo en lib/admin/app-overview.ts.
 */

import { Activity, Globe2, Languages, Layers, LayoutGrid, Store } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { AdminCard, BarList, ErrorState, KpiCard, KpiGrid, LoadingBlock, useAdminData } from "@/components/admin/ui"
import { getPlanBySlug } from "@/lib/plans"
import { formatDateTime } from "@/lib/date-format"
import type { AppOverview } from "@/lib/admin/app-overview"

export function AppOverviewPanel() {
  const { t } = useLanguage()
  const { data, loading, error, reload } = useAdminData<AppOverview & { readAt: string }>("/api/admin/app-overview")
  if (loading && !data) return <LoadingBlock rows={6} />
  if (error && !data) return <ErrorState onRetry={() => reload(true)} />
  // Una respuesta sin la forma esperada (ruta vieja en caché, error parcial) no rompe /admin.
  if (!data || !Array.isArray(data.modules)) return null
  const pct = (n: number) => `${Math.round(n * 100)} %`
  const moduleName = (m: string) => t(`admin_app_module_${m}` as never)
  // «nav_*» son visitas a una pantalla (ya tienen nombre traducido); el resto, módulos.
  const activityName = (m: string) => {
    for (const key of [m, `admin_app_activity_${m}`]) {
      const label = t(key as never)
      if (label && label !== key) return m.startsWith("nav_") ? t("admin_app_activity_visit").replace("{name}", label) : label
    }
    return m
  }

  return (
    <div className="space-y-6" data-app-overview>
      <KpiGrid cols={4}>
        <KpiCard label={t("admin_app_kpi_accounts")} icon={LayoutGrid} value={data.confirmedAccounts} sub={t("admin_app_kpi_accounts_sub")} />
        <KpiCard label={t("admin_app_kpi_active7")} icon={Activity} tone="good" value={data.active7} sub={t("admin_app_kpi_active30").replace("{count}", String(data.active30))} />
        <KpiCard
          label={t("admin_app_kpi_businesses")}
          icon={Store}
          value={data.modules.find((m) => m.module === "businesses")?.rows ?? 0}
          sub={t("admin_app_kpi_businesses_sub").replace("{count}", String(data.modules.find((m) => m.module === "businesses")?.accounts ?? 0))}
        />
        <KpiCard label={t("admin_app_kpi_deleting")} icon={Layers} tone={data.pendingDeletion ? "warn" : "default"} value={data.pendingDeletion} sub={t("admin_app_kpi_deleting_sub")} />
      </KpiGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title={t("admin_app_adoption_title")} icon={LayoutGrid} description={t("admin_app_adoption_desc")}>
          <BarList
            showShare={false}
            max={Math.max(1, data.confirmedAccounts)}
            rows={[...data.modules]
              .sort((a, b) => b.accounts - a.accounts)
              .map((m) => ({
                key: m.module,
                label: moduleName(m.module),
                value: m.accounts,
                sub: t("admin_app_adoption_row").replace("{pct}", pct(m.adoption)).replace("{rows}", String(m.rows)).replace("{avg}", m.perAccount ? String(Number(m.perAccount.toFixed(1))) : "0"),
              }))}
          />
        </AdminCard>

        <AdminCard title={t("admin_app_activity_title")} icon={Activity} description={t("admin_app_activity_desc")}>
          <BarList
            showShare={false}
            empty={t("admin_app_activity_empty")}
            rows={data.activity.slice(0, 12).map((a) => ({
              key: a.module,
              label: activityName(a.module),
              value: a.users,
              sub: t("admin_app_activity_row").replace("{actions}", String(a.actions)),
            }))}
          />
        </AdminCard>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <AdminCard title={t("admin_app_dist_plans")} icon={Layers}>
          <BarList rows={data.plans.map((p) => ({ key: p.key, label: getPlanBySlug(p.key).name, value: p.count }))} />
        </AdminCard>
        <AdminCard title={t("admin_app_dist_countries")} icon={Globe2}>
          <BarList rows={data.countries.map((c) => ({ key: c.key, label: c.key, value: c.count }))} />
        </AdminCard>
        <AdminCard title={t("admin_app_dist_languages")} icon={Languages}>
          <BarList rows={data.languages.map((l) => ({ key: l.key, label: l.key.toUpperCase(), value: l.count }))} />
        </AdminCard>
        <AdminCard title={t("admin_app_dist_types")} icon={Store}>
          <BarList rows={data.businessTypes.map((b) => ({ key: b.key, label: b.key, value: b.count }))} />
        </AdminCard>
      </div>
      <p className="text-xs text-muted-foreground">{t("admin_app_read_at").replace("{date}", formatDateTime(data.readAt))}</p>
    </div>
  )
}
