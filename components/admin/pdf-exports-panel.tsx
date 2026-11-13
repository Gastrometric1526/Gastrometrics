"use client"

/**
 * /admin → Crecimiento y uso → «PDF descargados» (pedido del dueño, docs/291): qué PDF
 * descargó cada cuenta y cuándo. Totales del período, reparto por tipo y la lista de cada
 * descarga (fecha y hora, tipo, documento, versión, negocio y cuenta), con filtro por tipo.
 * Las descargas anteriores a docs/291 no guardaban el nombre del documento: salen sin él.
 */

import { useMemo, useState } from "react"
import { FileDown, Users, Trophy } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import type { TranslationKey } from "@/lib/i18n/translations"
import { AdminCard, BarList, EmptyState, ErrorState, KpiCard, KpiGrid, LoadingBlock, useAdminData } from "@/components/admin/ui"
import { AccountLink } from "@/components/admin/account-link"
import { formatDateTime } from "@/lib/date-format"
import type { PdfExportRow, summarizePdfExports } from "@/lib/admin/pdf-exports"
import { cn } from "@/lib/utils"

type Data = { days: number; summary: ReturnType<typeof summarizePdfExports>; rows: PdfExportRow[]; readAt: string }
const PERIODS = [7, 30, 90, 365] as const
const SHOWN = 200

export function PdfExportsPanel() {
  const { t } = useLanguage()
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [kind, setKind] = useState<string | null>(null)
  const { data, loading, error, reload } = useAdminData<Data>(`/api/admin/pdf-exports?days=${days}`)
  const kindLabel = (k: string) => {
    const key = `admin_biz_pdf_${k}`
    const label = t(key as TranslationKey)
    return label && label !== key ? label : t("admin_biz_pdf_other")
  }
  const variantLabel = (v: string | null) => {
    if (!v) return null
    const key = `admin_pdf_variant_${v}`
    const label = t(key as TranslationKey)
    return label && label !== key ? label : v
  }
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => !kind || r.kind === kind), [data, kind])

  return (
    <div className="space-y-6" data-pdf-exports>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t("admin_pdf_period")}</span>
        {PERIODS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={cn("rounded-full border px-3 py-1 text-sm", d === days ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary")}
          >
            {t("admin_pdf_days").replace("{n}", String(d))}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <LoadingBlock rows={5} />
      ) : error && !data ? (
        <ErrorState onRetry={() => reload(true)} />
      ) : !data || !Array.isArray(data.rows) ? null : (
        <>
          <KpiGrid cols={3}>
            <KpiCard label={t("admin_pdf_total")} icon={FileDown} value={data.summary.total} sub={t("admin_pdf_days").replace("{n}", String(data.days))} />
            <KpiCard label={t("admin_pdf_accounts")} icon={Users} value={data.summary.accounts} />
            <KpiCard
              label={t("admin_pdf_top")}
              icon={Trophy}
              value={data.summary.topAccount ? data.summary.topAccount.count : 0}
              sub={data.summary.topAccount?.email ?? undefined}
            />
          </KpiGrid>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <AdminCard title={t("admin_pdf_by_kind")} icon={FileDown}>
              <BarList rows={data.summary.byKind.map((k) => ({ key: k.kind, label: kindLabel(k.kind), value: k.count }))} empty={t("admin_pdf_empty")} />
            </AdminCard>

            <AdminCard title={t("admin_pdf_list_title")} icon={FileDown} description={t("admin_pdf_list_desc")}>
              <div className="mb-4 flex flex-wrap gap-2">
                {[null, ...data.summary.byKind.map((k) => k.kind)].map((k) => (
                  <button
                    key={k ?? "all"}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn("rounded-full border px-3 py-1 text-xs", k === kind ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary")}
                  >
                    {k ? kindLabel(k) : t("admin_pdf_all")}
                  </button>
                ))}
              </div>
              {rows.length === 0 ? (
                <EmptyState text={t("admin_pdf_empty")} icon={FileDown} />
              ) : (
                <ul className="divide-y divide-border" data-pdf-list>
                  {rows.slice(0, SHOWN).map((r, i) => (
                    <li key={`${r.at}-${i}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground sm:w-32">{formatDateTime(r.at)}</span>
                      <span className="min-w-0 flex-1 space-y-0.5 text-sm">
                        <span className="block text-foreground">
                          <span className="font-medium">{kindLabel(r.kind)}</span>
                          {r.name ? <span> · {r.name}</span> : <span className="text-muted-foreground"> · {t("admin_pdf_no_name")}</span>}
                          {variantLabel(r.variant) ? <span className="text-muted-foreground"> ({variantLabel(r.variant)})</span> : null}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {r.email ? <AccountLink email={r.email} className="inline" /> : t("admin_pdf_deleted_account")} · {r.businessName ?? t("admin_pdf_main_space")}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {rows.length > SHOWN && <p className="pt-3 text-xs text-muted-foreground">{t("admin_pdf_more").replace("{shown}", String(SHOWN)).replace("{total}", String(rows.length))}</p>}
            </AdminCard>
          </div>
          <p className="text-xs text-muted-foreground">{t("admin_pdf_note")}</p>
        </>
      )}
    </div>
  )
}
