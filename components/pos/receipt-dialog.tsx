"use client"

/**
 * Después de cobrar (pedido del dueño, docs/302): el mesero ve cuánto se cobró y el vuelto, y
 * puede bajar el recibo (tira de 80 mm, para imprimir o mandar por WhatsApp) o hacer la
 * factura con el nombre y el número fiscal del cliente. La factura queda en Facturas con el
 * número siguiente y no se vuelve a sumar como venta (ya se sumó al cobrar).
 */

import { useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { CheckCircle2, FileText, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { formatCurrency } from "@/lib/currency"
import { toIsoDate } from "@/lib/date-format"
import { posInvoice, type PosReceipt } from "@/lib/pos-waiter"
import { downloadPosReceiptPDF } from "@/lib/pdf/pos-receipt-pdf-generator"
import { downloadInvoicePDF } from "@/lib/pdf/invoice-pdf-generator"
import { addInvoiceWithNextNumber } from "@/lib/storage/invoices"
import { getBusinessById } from "@/lib/storage/businesses"

export function ReceiptDialog({
  open,
  onOpenChange,
  receipt,
  ticketId,
  businessId,
  businessName,
  canInvoice,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  receipt: PosReceipt | null
  ticketId: string | null
  businessId: string
  businessName: string | null
  /** Hacer factura pide el permiso de Facturas (Equipo) o un plan que lo incluya. */
  canInvoice: boolean
}) {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [invoicing, setInvoicing] = useState(false)
  const [client, setClient] = useState("")
  const [taxId, setTaxId] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setInvoicing(false)
      setClient("")
      setTaxId("")
      setEmail("")
      setInvoiceNumber(null)
    }
  }, [open])

  if (!receipt) return null
  const seatName = (s: number) => (s === 0 ? t("pos_seat_table") : t("pos_seat_n").replace("{n}", String(s)))
  const business = businessId !== "main" ? getBusinessById(businessId) : null

  const printReceipt = () => {
    try {
      downloadPosReceiptPDF(receipt, { businessId, businessName, seatName })
    } catch (error) {
      console.error("[salon] No se pudo hacer el recibo:", error)
      toast({ title: t("pos_receipt_error"), variant: "destructive" })
    }
  }

  const makeInvoice = async () => {
    if (!ticketId) return
    setSaving(true)
    try {
      const notes = [
        [receipt.tableLabel, receipt.waiter ? `${t("ventas_waiter_label")}: ${receipt.waiter}` : null].filter(Boolean).join(" · "),
        receipt.tip > 0 ? `${t("ventas_tip_label")}: ${formatCurrency(receipt.tip)}` : null,
      ]
        .filter(Boolean)
        .join("\n")
      const draft = posInvoice(receipt, {
        id: uuidv4(),
        number: "",
        businessId,
        posTicketId: ticketId,
        clientName: client.trim() || t("pos_invoice_default_client"),
        clientTaxId: taxId,
        clientEmail: email,
        notes,
        issueDate: toIsoDate(new Date()),
        newId: uuidv4,
      })
      const { number: _n, ...withoutNumber } = draft
      const saved = await addInvoiceWithNextNumber(businessId, withoutNumber)
      setInvoiceNumber(saved.number)
      downloadInvoicePDF(saved, { businessName: business?.name ?? businessName ?? undefined, businessLogo: business?.logo, businessId })
      toast({ title: t("pos_invoice_done").replace("{n}", saved.number) })
    } catch (error) {
      console.error("[salon] No se pudo hacer la factura:", error)
      toast({ title: t("pos_invoice_error"), description: t("pos_invoice_error_desc"), variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            {t("pos_receipt_title").replace("{total}", formatCurrency(receipt.total))}
          </DialogTitle>
          <DialogDescription>{receipt.tableLabel}</DialogDescription>
        </DialogHeader>

        {receipt.change != null && (
          <div className="rounded-lg border border-success/40 bg-success-soft p-4 text-center" role="status">
            <p className="text-sm text-success">{t("pos_change_label")}</p>
            <p className="text-3xl font-bold tabular-nums text-success">{formatCurrency(receipt.change)}</p>
          </div>
        )}

        {invoicing && !invoiceNumber && (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("pos_invoice_client")}</span>
              <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t("pos_invoice_default_client")} maxLength={80} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("pos_invoice_tax_id")}</span>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder={t("ventas_optional")} maxLength={40} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">{t("pos_invoice_email")}</span>
              <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("ventas_optional")} maxLength={120} />
            </label>
            <p className="text-xs text-muted-foreground">{t("pos_invoice_note")}</p>
          </div>
        )}

        {invoiceNumber && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm" role="status">
            {t("pos_invoice_done").replace("{n}", invoiceNumber)}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {invoicing && !invoiceNumber ? (
            <>
              <Button size="lg" className="w-full gap-2" onClick={makeInvoice} disabled={saving}>
                <FileText className="h-4 w-4" />
                {t("pos_invoice_make")}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setInvoicing(false)} disabled={saving}>
                {t("pos_picker_back")}
              </Button>
            </>
          ) : (
            <>
              <Button size="lg" className="w-full gap-2" onClick={printReceipt}>
                <Printer className="h-4 w-4" />
                {t("pos_receipt_download")}
              </Button>
              {canInvoice && !invoiceNumber && (
                <Button variant="outline" size="lg" className="w-full gap-2" onClick={() => setInvoicing(true)}>
                  <FileText className="h-4 w-4" />
                  {t("pos_invoice_open")}
                </Button>
              )}
              <Button variant="ghost" className="w-full" onClick={() => onOpenChange(false)}>
                {t("pos_receipt_done")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
