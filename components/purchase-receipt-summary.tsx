"use client"

/**
 * En el panel de una orden (docs/322): qué llegó contra lo pedido y las devoluciones hechas.
 * Solo aparece si la orden se recibió revisándola o tiene devoluciones.
 */

import { CalcHelp } from "@/components/calc-help"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/utils"
import { formatDate } from "@/lib/date-format"
import { getUnitLabel } from "@/lib/ingredient-labels"
import { cn } from "@/lib/utils"
import { orderPurchaseValue, receiptLines, receiptSummary, returnValue } from "@/lib/purchase-receipt"
import type { PurchaseOrder } from "@/types/purchase-order"

const fmtQty = (n: number) => String(Math.round(n * 1000) / 1000)

export function PurchaseReceiptSummary({ order }: { order: PurchaseOrder }) {
  const { t, language } = useLanguage()
  if (!order.receipt && !(order.returns?.length)) return null
  const lines = receiptLines(order)
  const sum = receiptSummary(order)
  const returns = order.returns ?? []
  const returnedTotal = Math.round(returns.reduce((s, r) => s + returnValue(order, r).total, 0) * 100) / 100
  const net = Math.round((orderPurchaseValue(order) - returnedTotal) * 100) / 100
  const names = new Map(lines.map((l) => [l.key, l]))

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm" data-testid="receipt-summary">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{t("receipt_summary_title")}</p>
          {order.receipt?.invoiceNumber && (
            <p className="text-xs text-muted-foreground">{t("receipt_summary_invoice").replace("{number}", order.receipt.invoiceNumber)}</p>
          )}
        </div>
        <CalcHelp
          title={t("receipt_summary_calc_title")}
          intro={t("receipt_summary_calc_intro")}
          steps={[
            { label: t("receive_received_total"), formula: `${formatCurrency(sum.receivedSubtotal)} × (1 + ${Math.round(sum.taxRate * 10000) / 100} %) = ${formatCurrency(orderPurchaseValue(order))}` },
            ...(returns.length
              ? [{ label: t("receipt_summary_returned"), formula: `${returns.map((r) => formatCurrency(returnValue(order, r).total)).join(" + ")} = ${formatCurrency(returnedTotal)}` }]
              : []),
            { label: t("receipt_summary_net"), formula: `${formatCurrency(orderPurchaseValue(order))} − ${formatCurrency(returnedTotal)} = ${formatCurrency(net)}`, note: t("receipt_summary_net_note") },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{t("receive_ordered_total")}</p>
          <p className="font-semibold tabular-nums">{formatCurrency(order.total || 0)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("receive_received_total")}</p>
          <p className="font-semibold tabular-nums">{formatCurrency(orderPurchaseValue(order))}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("receipt_summary_net")}</p>
          <p className="font-semibold tabular-nums">{formatCurrency(net)}</p>
        </div>
      </div>

      {order.receipt && sum.linesWithDifference > 0 && (
        <ul className="space-y-1 text-xs">
          {lines
            .filter((l) => l.quantityDiff !== 0 || l.priceDiff !== 0)
            .map((l) => (
              <li key={l.key} className="flex flex-wrap justify-between gap-x-2">
                <span>
                  {l.name}:{" "}
                  {l.quantityDiff !== 0 &&
                    (l.quantityDiff < 0 ? t("receive_missing") : t("receive_extra")).replace("{qty}", `${fmtQty(Math.abs(l.quantityDiff))} ${getUnitLabel(l.unit, language)}`)}
                  {l.quantityDiff !== 0 && l.priceDiff !== 0 && " · "}
                  {l.priceDiff !== 0 && (l.priceDiff > 0 ? t("receive_price_up") : t("receive_price_down")).replace("{amount}", formatCurrency(Math.abs(l.priceDiff)))}
                </span>
                <span className={cn("font-medium tabular-nums", l.valueDiff > 0 ? "text-destructive" : "text-success")}>
                  {l.valueDiff > 0 ? "+" : ""}
                  {formatCurrency(l.valueDiff)}
                </span>
              </li>
            ))}
        </ul>
      )}

      {returns.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium">{t("receipt_summary_returns")}</p>
          <ul className="space-y-1 text-xs">
            {returns.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-x-2">
                <span>
                  {formatDate(r.at)} · {t(`return_reason_${r.reason}`)} ·{" "}
                  {r.lines.map((l) => `${names.get(l.key)?.name || ""} ${fmtQty(l.quantity)}`).join(", ")}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
                <span className="font-medium tabular-nums">−{formatCurrency(returnValue(order, r).total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
