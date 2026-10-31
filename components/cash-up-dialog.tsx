"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Camera, CheckCircle2, AlertTriangle, Info, Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { logActivity } from "@/lib/services/activity-log"
import { formatCurrency } from "@/lib/currency"
import { updateSalesImport } from "@/lib/storage/sales-imports"
import { getBusinessById } from "@/lib/storage/businesses"
import { useFeatureAccess } from "@/lib/plan-access"
import { useOcrUsage } from "@/lib/ocr-usage"
import { OCR_LANG, recognizeRecipeImage } from "@/lib/recipe-import/ocr"
import { CASH_UP_TOLERANCE, computeCashUp, emptyCashUp, parseTerminalTotal, type CashUpMethod } from "@/lib/cash-up"
import { generateCashUpPDF, generateCashUpPDFFilename } from "@/lib/pdf/cash-up-pdf-generator"
import { ShareDocumentMenu } from "@/components/share-document-menu"
import { formatDate, localDayOf } from "@/lib/date-format"
import { cn } from "@/lib/utils"
import type { CashUp, SalesImport } from "@/types/sales-import"

interface CashUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  salesImport: SalesImport | null
  onSaved: (updated: SalesImport) => void
}

/** Campo de monto: vacío = «sin anotar» (null). */
const toNumberOrNull = (v: string): number | null => {
  if (v.trim() === "") return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? Math.max(n, 0) : null
}
const fieldValue = (n: number | null) => (n === null ? "" : String(n))

/**
 * Cuadre de caja de un día (docs/217): lo que debería haber según las cuentas (por forma de
 * pago, docs/215) contra lo contado en la caja, el cierre de lote del datáfono y las
 * transferencias recibidas. El total del datáfono se puede leer de una foto del voucher
 * (OCR en el navegador, docs/146). Se guarda dentro del registro del día; la cuenta vive en
 * lib/cash-up.ts.
 */
export function CashUpDialog({ open, onOpenChange, businessId, salesImport, onSaved }: CashUpDialogProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const { t, language } = useLanguage()
  const canPdf = useFeatureAccess("pdf_admin")
  const recordOcr = useOcrUsage()
  const [draft, setDraft] = useState<CashUp>(() => emptyCashUp(new Date().toISOString()))
  const [isSaving, setIsSaving] = useState(false)
  const [reading, setReading] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open || !salesImport) return
    const who = user?.name || user?.email || null
    setDraft(salesImport.cashUp ? { ...salesImport.cashUp, payouts: salesImport.cashUp.payouts.map((p) => ({ ...p })) } : emptyCashUp(new Date().toISOString(), who))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, salesImport])

  const result = useMemo(() => (salesImport ? computeCashUp(salesImport, draft) : null), [salesImport, draft])
  if (!salesImport || !result) return null

  const day = localDayOf(salesImport.periodStart || salesImport.importedAt)
  const dayLabel = formatDate(new Date(`${day}T00:00:00`))
  const set = (patch: Partial<CashUp>) => setDraft((d) => ({ ...d, ...patch }))
  const methodLabel = (m: CashUpMethod) => t(`cashup_method_${m}` as never)
  const statusText = t(`cashup_status_${result.status}` as never)
  const signed = (n: number) => (n > CASH_UP_TOLERANCE ? `+${formatCurrency(n)}` : n < -CASH_UP_TOLERANCE ? `− ${formatCurrency(-n)}` : formatCurrency(0))

  const readVoucher = async (file: File) => {
    setReading(0)
    try {
      const ocr = await recognizeRecipeImage(file, OCR_LANG[language] ?? "spa", (p) => setReading(Math.round(p * 100)), { layout: "receipt" })
      recordOcr("receipt")
      const total = parseTerminalTotal(ocr.text)
      if (total === null) {
        toast({ title: t("cashup_ocr_not_found_title"), description: t("cashup_ocr_not_found_desc"), variant: "destructive" })
      } else {
        set({ terminalTotal: total })
        toast({ title: t("cashup_ocr_read_title").replace("{amount}", formatCurrency(total)), description: t("cashup_ocr_read_desc") })
      }
    } catch (error) {
      console.error("[cash-up] No se pudo leer el voucher:", error)
      toast({ title: t("cashup_ocr_not_found_title"), description: t("cashup_ocr_not_found_desc"), variant: "destructive" })
    } finally {
      setReading(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const persist = async (cashUp: CashUp | undefined) => {
    setIsSaving(true)
    const updated: SalesImport = { ...salesImport, cashUp }
    try {
      await updateSalesImport(updated, businessId)
    } catch (error) {
      console.error("[cash-up] No se pudo guardar:", error)
      toast({ title: t("manual_sales_save_error"), variant: "destructive" })
      setIsSaving(false)
      return
    }
    onSaved(updated)
    if (user) {
      logActivity({
        user,
        businessId: businessId && businessId !== "main" ? businessId : null,
        module: "estadisticas",
        action: cashUp ? "updated" : "deleted",
        entityLabel: `${t("cashup_title")} ${dayLabel}`,
        metadata: cashUp ? { cashUp: result.status, difference: result.totalDifference } : { cashUp: "removed" },
      })
    }
    toast({ title: cashUp ? t("cashup_toast_saved").replace("{status}", statusText) : t("cashup_toast_removed") })
    setIsSaving(false)
    onOpenChange(false)
  }

  const shareText = () => {
    const lines = [`${t("cashup_title")} · ${dayLabel}`, `${statusText} (${signed(result.totalDifference)})`]
    for (const r of result.rows) {
      lines.push(
        `${methodLabel(r.method)}: ${t("cashup_expected")} ${formatCurrency(r.expected)} · ${t("cashup_actual")} ${r.actual === null ? t("cashup_not_noted") : formatCurrency(r.actual)}${r.difference === null ? "" : ` · ${signed(r.difference)}`}`,
      )
    }
    if (result.unassigned.tickets) lines.push(t(result.unassigned.tickets === 1 ? "cashup_unassigned_one" : "cashup_unassigned").replace("{n}", String(result.unassigned.tickets)).replace("{amount}", formatCurrency(result.unassigned.amount)))
    if (draft.note) lines.push(draft.note)
    return lines.join("\n")
  }

  const tone =
    result.status === "balanced" ? "ok" : result.status === "short" || result.status === "over" ? "bad" : "warn"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto grid-cols-[minmax(0,1fr)]">
        <DialogHeader>
          <DialogTitle>
            {t("cashup_title")} · {dayLabel}
          </DialogTitle>
          <DialogDescription>{t("cashup_desc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              tone === "ok" && "border-green-600/30 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-200",
              tone === "bad" && "border-red-600/30 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
              tone === "warn" && "border-amber-600/30 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
            )}
          >
            {tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <div>
              <p className="font-semibold">
                {statusText}
                {result.status !== "incomplete" && <span className="font-normal">: {signed(result.totalDifference)}</span>}
              </p>
              <p className="text-xs opacity-90">{t(`cashup_status_${result.status}_hint` as never)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 sm:px-3 text-left font-medium">{t("cashup_col_method")}</th>
                  <th className="px-2 py-2 sm:px-3 text-right font-medium">{t("cashup_expected")}</th>
                  <th className="px-2 py-2 sm:px-3 text-right font-medium">{t("cashup_actual")}</th>
                  <th className="hidden px-2 py-2 sm:px-3 text-right font-medium sm:table-cell">{t("cashup_difference")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((r) => (
                  <tr key={r.method}>
                    <td className="px-2 py-2 sm:px-3">
                      <span className="font-medium text-foreground">{methodLabel(r.method)}</span>
                      <span className="block text-xs text-muted-foreground tabular-nums">
                        {t("cashup_sales_tips").replace("{sales}", formatCurrency(r.sales)).replace("{tips}", formatCurrency(r.tips))}
                      </span>
                    </td>
                    <td className="px-2 py-2 sm:px-3 text-right tabular-nums">{formatCurrency(r.expected)}</td>
                    <td className="px-2 py-2 sm:px-3 text-right tabular-nums">
                      {r.actual === null ? <span className="text-muted-foreground">{t("cashup_not_noted")}</span> : formatCurrency(r.actual)}
                      {/* En celular la diferencia va debajo de lo real (sin columna aparte). */}
                      {r.difference !== null && (
                        <span
                          className={cn(
                            "block text-xs font-semibold sm:hidden",
                            r.difference < -CASH_UP_TOLERANCE && "text-red-700 dark:text-red-300",
                            r.difference > CASH_UP_TOLERANCE && "text-green-700 dark:text-green-300",
                          )}
                        >
                          {signed(r.difference)}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "hidden px-2 py-2 sm:px-3 text-right font-semibold tabular-nums sm:table-cell",
                        r.difference !== null && r.difference < -CASH_UP_TOLERANCE && "text-red-700 dark:text-red-300",
                        r.difference !== null && r.difference > CASH_UP_TOLERANCE && "text-green-700 dark:text-green-300",
                      )}
                    >
                      {r.difference === null ? "—" : signed(r.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(result.unassigned.tickets > 0 || result.other.tickets > 0) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {result.unassigned.tickets > 0 && (
                <p className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t(result.unassigned.tickets === 1 ? "cashup_unassigned_one" : "cashup_unassigned").replace("{n}", String(result.unassigned.tickets)).replace("{amount}", formatCurrency(result.unassigned.amount))}
                </p>
              )}
              {result.other.tickets > 0 && (
                <p className="flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t(result.other.tickets === 1 ? "cashup_other_one" : "cashup_other").replace("{n}", String(result.other.tickets)).replace("{amount}", formatCurrency(result.other.amount))}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cashup-float">{t("cashup_float_label")}</Label>
              <Input id="cashup-float" type="number" min="0" step="0.01" value={draft.openingFloat || ""} placeholder="0" onChange={(e) => set({ openingFloat: toNumberOrNull(e.target.value) ?? 0 })} />
              <p className="text-xs text-muted-foreground">{t("cashup_float_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cashup-cash">{t("cashup_cash_label")}</Label>
              <Input id="cashup-cash" type="number" min="0" step="0.01" value={fieldValue(draft.countedCash)} onChange={(e) => set({ countedCash: toNumberOrNull(e.target.value) })} />
              <p className="text-xs text-muted-foreground">{t("cashup_cash_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cashup-terminal">{t("cashup_terminal_label")}</Label>
              <div className="flex gap-2">
                <Input id="cashup-terminal" type="number" min="0" step="0.01" value={fieldValue(draft.terminalTotal)} onChange={(e) => set({ terminalTotal: toNumberOrNull(e.target.value) })} />
                <Button type="button" variant="outline" className="shrink-0 gap-1.5" disabled={reading !== null} onClick={() => fileRef.current?.click()}>
                  <Camera className="h-4 w-4" />
                  {reading !== null ? `${reading}%` : t("cashup_read_photo")}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  aria-label={t("cashup_read_photo")}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void readVoucher(file)
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("cashup_terminal_hint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cashup-transfer">{t("cashup_transfer_label")}</Label>
              <Input id="cashup-transfer" type="number" min="0" step="0.01" value={fieldValue(draft.transferTotal)} onChange={(e) => set({ transferTotal: toNumberOrNull(e.target.value) })} />
              <p className="text-xs text-muted-foreground">{t("cashup_transfer_hint")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("cashup_payouts_label")}</Label>
              <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => set({ payouts: [...draft.payouts, { id: uuidv4(), concept: "", amount: 0 }] })}>
                <Plus className="h-4 w-4" />
                {t("cashup_payout_add")}
              </Button>
            </div>
            {draft.payouts.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("cashup_payouts_empty")}</p>
            ) : (
              <div className="space-y-2">
                {draft.payouts.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <Input
                      value={p.concept}
                      placeholder={t("cashup_payout_concept")}
                      aria-label={t("cashup_payout_concept")}
                      maxLength={80}
                      onChange={(e) => set({ payouts: draft.payouts.map((x) => (x.id === p.id ? { ...x, concept: e.target.value } : x)) })}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-32"
                      value={p.amount || ""}
                      placeholder="0"
                      aria-label={t("cashup_payout_amount")}
                      onChange={(e) => set({ payouts: draft.payouts.map((x) => (x.id === p.id ? { ...x, amount: toNumberOrNull(e.target.value) ?? 0 } : x)) })}
                    />
                    <Button type="button" variant="ghost" size="icon" aria-label={t("common_delete")} onClick={() => set({ payouts: draft.payouts.filter((x) => x.id !== p.id) })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {t("cashup_payouts_total")}: {formatCurrency(result.payouts)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("cashup_cash_tips_toggle")}</span>
              <Switch checked={draft.cashTipsInDrawer} onCheckedChange={(v) => set({ cashTipsInDrawer: v })} aria-label={t("cashup_cash_tips_toggle")} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>{t("cashup_card_tips_toggle")}</span>
              <Switch checked={draft.cardTipsInTerminal} onCheckedChange={(v) => set({ cardTipsInTerminal: v })} aria-label={t("cashup_card_tips_toggle")} />
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cashup-note">{t("ventas_note_label")}</Label>
            <Input id="cashup-note" value={draft.note ?? ""} placeholder={t("cashup_note_placeholder")} maxLength={200} onChange={(e) => set({ note: e.target.value || null })} />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {salesImport.cashUp && (
              <Button type="button" variant="ghost" className="text-destructive" disabled={isSaving} onClick={() => persist(undefined)}>
                {t("cashup_remove")}
              </Button>
            )}
            <ShareDocumentMenu
              variant="outline"
              size="default"
              pdfAllowed={canPdf !== false}
              filename={generateCashUpPDFFilename(day)}
              subject={`${t("cashup_title")} · ${dayLabel}`}
              buildPdf={() => {
                const business = getBusinessById(businessId || "main")
                return generateCashUpPDF(salesImport, draft, { businessName: business?.name, businessLogo: business?.logo, businessId: businessId || "main", day })
              }}
              shareText={shareText}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("common_cancel")}
            </Button>
            <Button onClick={() => persist({ ...draft, closedAt: new Date().toISOString() })} disabled={isSaving}>
              {isSaving ? t("manual_sales_saving") : t("cashup_save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
