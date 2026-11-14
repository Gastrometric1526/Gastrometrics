import { jsPDF } from "jspdf"
import { getPdfBranding, pdfFooterPrefix, pdfHeaderName } from "./pdf-branding"
import { fiscalLines } from "./pdf-fiscal"
import { safeFilePart } from "./pdf-filename"
import { recordPdfExport } from "./track-export"
import { getPdfLabels, type PdfLabels } from "@/lib/i18n/pdf-labels"
import { formatCurrency } from "@/lib/currency"
import { fileDate, formatDateTime } from "@/lib/date-format"
import type { PosReceipt } from "@/lib/pos-waiter"
import type { PaymentMethod } from "@/types/sales-import"

/**
 * Recibo y pre-cuenta del POS (pedido del dueño, docs/302): tira de 80 mm, como la de una
 * impresora de tickets, para imprimir o mandar por WhatsApp desde el celular del mesero.
 * Los montos salen de `buildPosReceipt` (lib/pos-waiter.ts), los mismos del cobro. Lleva
 * los datos fiscales del negocio (`fiscalLines`) y el aviso de que no es una factura fiscal.
 */

const WIDTH = 80
const M = 5
const INNER = WIDTH - 2 * M

const clean = (input: string | null | undefined): string =>
  (input ?? "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim()

function paymentLabel(labels: PdfLabels, p: PaymentMethod | null): string | null {
  if (!p) return null
  return p === "cash" ? labels.efectivo : p === "card" ? labels.tarjeta : p === "transfer" ? labels.transferencia : labels.otraFormaPago
}

export interface PosReceiptPdfOptions {
  businessId?: string
  businessName?: string | null
  /** «Silla {n}» y «Mesa» ya traducidos (para la cuenta dividida). */
  seatName?: (seat: number) => string
}

/** Dibuja el recibo y devuelve hasta dónde llegó (se llama dos veces: medir y dibujar). */
function draw(doc: jsPDF, r: PosReceipt, o: PosReceiptPdfOptions, labels: PdfLabels): number {
  let y = M + 2
  const center = (text: string, size: number, bold = false, gray = false) => {
    doc.setFontSize(size)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(gray ? 100 : 30, gray ? 100 : 30, gray ? 100 : 30)
    const lines = doc.splitTextToSize(clean(text), INNER) as string[]
    doc.text(lines, WIDTH / 2, y, { align: "center" })
    y += lines.length * size * 0.42 + 1
  }
  const row = (left: string, right: string, size = 8.5, bold = false) => {
    doc.setFontSize(size)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(30, 30, 30)
    const rightW = doc.getTextWidth(right) + 2
    const lines = doc.splitTextToSize(clean(left), INNER - rightW) as string[]
    doc.text(lines, M, y)
    doc.text(right, WIDTH - M, y, { align: "right" })
    y += lines.length * size * 0.42 + 1.2
  }
  const small = (text: string, indent = 3) => {
    doc.setFontSize(7.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(90, 90, 90)
    const lines = doc.splitTextToSize(clean(text), INNER - indent) as string[]
    doc.text(lines, M + indent, y)
    y += lines.length * 3.2 + 0.4
  }
  const rule = () => {
    doc.setDrawColor(170, 170, 170)
    doc.setLineWidth(0.2)
    doc.setLineDashPattern([0.8, 0.8], 0)
    doc.line(M, y, WIDTH - M, y)
    doc.setLineDashPattern([], 0)
    y += 3.5
  }

  center(pdfHeaderName(o.businessId, o.businessName), 12, true)
  for (const line of fiscalLines(getPdfBranding(o.businessId).fiscal, labels.idFiscal)) center(line, 7.5, false, true)
  y += 1
  center(r.paid ? labels.recibo : labels.preCuenta, 10, true)
  center(formatDateTime(r.at), 7.5, false, true)
  rule()

  const head: string[] = [[r.tableLabel, r.areaName].filter(Boolean).join(" · ")]
  if (r.waiter) head.push(`${labels.mesero}: ${r.waiter}`)
  if (r.guests) head.push(`${labels.comensales}: ${r.guests}`)
  if (r.seats && o.seatName) head.push(`${labels.sillasCobradas}: ${r.seats.map(o.seatName).join(", ")}`)
  for (const h of head) small(h, 0)
  rule()

  for (const l of r.lines) {
    row(`${l.quantity} × ${l.name}`, formatCurrency(l.amount))
    for (const e of l.extras) small(`+ ${e}`)
    if (l.note) small(`«${l.note}»`)
  }
  rule()

  row(labels.subtotal, formatCurrency(r.subtotal))
  if (r.discount > 0) row(labels.descuento, `− ${formatCurrency(r.discount)}`)
  if (r.tip > 0) row(labels.propina, formatCurrency(r.tip))
  y += 0.5
  row(labels.total.toUpperCase(), formatCurrency(r.total), 11, true)
  const pay = paymentLabel(labels, r.payment)
  if (pay) row(labels.formaPago, pay, 8)
  if (r.received != null) row(labels.recibido, formatCurrency(r.received), 8)
  if (r.change != null) row(labels.vuelto, formatCurrency(r.change), 8, true)
  rule()

  if (r.paid) center(labels.graciasVisita, 8.5, true)
  center(r.paid ? labels.facturaAvisoNoFiscal : labels.avisoPreCuenta, 6.5, false, true)
  const footer = pdfFooterPrefix(o.businessId).replace(/[·\s]+$/, "")
  if (footer) center(footer, 6.5, false, true)
  return y + M
}

export function generatePosReceiptPDF(receipt: PosReceipt, options: PosReceiptPdfOptions = {}): jsPDF {
  const labels = getPdfLabels()
  // Primero se mide en una tira larga; después se dibuja en una del alto justo.
  const probe = new jsPDF({ unit: "mm", format: [WIDTH, 2000] })
  const height = Math.max(90, Math.ceil(draw(probe, receipt, options, labels)))
  const doc = new jsPDF({ unit: "mm", format: [WIDTH, height] })
  draw(doc, receipt, options, labels)
  return doc
}

export function posReceiptFilename(receipt: PosReceipt): string {
  const labels = getPdfLabels()
  const kind = receipt.paid ? labels.recibo : labels.preCuenta
  return `${safeFilePart(kind, "Recibo")}_${safeFilePart(receipt.tableLabel, "mesa")}_${fileDate(receipt.at)}.pdf`
}

/** Descarga el recibo (o la pre-cuenta) y lo cuenta en /admin. */
export function downloadPosReceiptPDF(receipt: PosReceipt, options: PosReceiptPdfOptions = {}): void {
  const doc = generatePosReceiptPDF(receipt, options)
  doc.save(posReceiptFilename(receipt))
  recordPdfExport("invoice", options.businessId, { name: receipt.tableLabel, variant: receipt.paid ? "pos_receipt" : "pos_precheck" })
}
