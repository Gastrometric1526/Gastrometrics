"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { ScanText } from "lucide-react"

interface Stat {
  average: number
  median: number | null
}

interface OcrUsage {
  windowDays: number
  total: number
  byKind: Record<string, number>
  accounts: number
  readsPerAccount: Stat
  first7Days: Stat
  first30Days: Stat
  returnedPercent: number
  payingPercent: number
  readsBeforeFirstCost: { accounts: number; median: number | null }
}

/**
 * Uso del OCR (docs/153): abierto en todos los planes; esto mide cuánto se usa, en los
 * primeros días de cada cuenta, si vuelven, si pagan y cuántas lecturas hacen falta para
 * llegar al primer costo — para decidir con datos si algún día conviene un límite.
 */
export function OcrUsagePanel() {
  const { t } = useLanguage()
  const [data, setData] = useState<OcrUsage | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    fetch("/api/admin/ocr-usage")
      .then((res) => res.json())
      .then((json) => (json.error ? setFailed(true) : setData(json)))
      .catch(() => setFailed(true))
  }, [])

  const stat = (label: string, value: number | string | null) => (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value ?? "—"}</p>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanText className="h-5 w-5 text-primary" />
          {t("admin_ocr_title")}
        </CardTitle>
        <CardDescription>{t("admin_ocr_desc").replace("{days}", String(data?.windowDays ?? 30))}</CardDescription>
      </CardHeader>
      <CardContent>
        {failed ? (
          <p className="text-sm text-muted-foreground">{t("admin_ocr_error")}</p>
        ) : !data ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {stat(t("admin_ocr_total"), data.total)}
              {stat(t("admin_ocr_recipes"), data.byKind.recipe ?? 0)}
              {stat(t("admin_ocr_receipts"), data.byKind.receipt ?? 0)}
              {stat(t("admin_ocr_inventory"), data.byKind.inventory ?? 0)}
              {stat(t("admin_ocr_accounts"), data.accounts)}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stat(t("admin_ocr_per_account"), data.readsPerAccount.median)}
              {stat(t("admin_ocr_first7"), data.first7Days.average)}
              {stat(t("admin_ocr_first30"), data.first30Days.average)}
              {stat(t("admin_ocr_returned"), `${data.returnedPercent}%`)}
              {stat(t("admin_ocr_paying"), `${data.payingPercent}%`)}
              {stat(t("admin_ocr_before_cost"), data.readsBeforeFirstCost.median)}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
