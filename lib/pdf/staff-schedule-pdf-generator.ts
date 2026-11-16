import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { pdfFooterPrefix, pdfHeaderName } from "./pdf-branding"
import { getPdfLabels, getCurrentPdfLanguage } from "@/lib/i18n/pdf-labels"
import { getDateLocale } from "@/lib/i18n/translations"
import { getBusinessThemeRgb, getBusinessThemeTintRgb } from "@/lib/theme-colors"
import { safeFilePart } from "./pdf-filename"
import { PDF_CONTENT_TOP, drawPdfHeader } from "./pdf-header"
import { fileDate, formatDate, formatDateTime, formatDayMonth } from "@/lib/date-format"
import { formatCurrency } from "@/lib/currency"
import { weekByPerson, weekDays, type StaffSchedule } from "@/lib/staff-schedule"
import { recordPdfExport } from "@/lib/pdf/track-export"

// Horario del personal en PDF (pedido del dueño, docs/323): la semana en una hoja horizontal,
// una fila por persona y una columna por día, para imprimirla o mandarla al equipo. Mismo
// encabezado, color del negocio y pie que el resto de lib/pdf/. El costo solo sale si quien lo
// descarga ve costos (docs/304).

const COLORS = {
  primary: [41, 98, 255] as [number, number, number],
  tint: [240, 248, 255] as [number, number, number],
  secondary: [100, 100, 100] as [number, number, number],
  text: [40, 40, 40] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  tableHeader: [51, 51, 51] as [number, number, number],
  muted: [170, 170, 170] as [number, number, number],
}

export interface StaffSchedulePDFOptions {
  businessName?: string
  businessLogo?: string
  businessId?: string
  /** Lunes de la semana («AAAA-MM-DD»). */
  monday: string
  showCosts: boolean
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim()
const noon = (day: string) => `${day}T12:00:00`

export function generateStaffSchedulePDF(schedule: StaffSchedule, options: StaffSchedulePDFOptions): jsPDF {
  COLORS.primary = getBusinessThemeRgb(options.businessId)
  COLORS.tint = getBusinessThemeTintRgb(options.businessId)
  const labels = getPdfLabels()
  const locale = getDateLocale(getCurrentPdfLanguage())
  const days = weekDays(options.monday)
  const rows = weekByPerson(schedule, options.monday)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12

  drawPdfHeader(doc, {
    logo: options.businessLogo,
    name: clean(pdfHeaderName(options.businessId, options.businessName)),
    meta: `${labels.exportado}: ${formatDateTime(new Date())}`,
    title: labels.horarioPersonal,
    subtitle: labels.semanaDelAl.replace("{from}", formatDate(noon(days[0]))).replace("{to}", formatDate(noon(days[6]))),
    primary: COLORS.primary,
  })

  const head = [
    labels.persona,
    // «lun 16/11»: el año ya está en el título.
    ...days.map((d) => `${clean(new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(noon(d))))} ${formatDayMonth(noon(d))}`),
    labels.horasCol,
    ...(options.showCosts ? [labels.costoCol] : []),
  ]
  const body = rows.map((r) => [
    `${clean(r.person.name)}${r.person.role ? `\n${clean(r.person.role)}` : ""}`,
    ...r.days.map((shifts) => (shifts.length ? shifts.map((s) => `${s.start}–${s.end}`).join("\n") : "—")),
    String(r.hours),
    ...(options.showCosts ? [formatCurrency(r.cost)] : []),
  ])
  const totalHours = Math.round(rows.reduce((t, r) => t + r.hours, 0) * 100) / 100
  const totalCost = Math.round(rows.reduce((t, r) => t + r.cost, 0) * 100) / 100
  const foot = [[labels.total, ...days.map((_, i) => String(rows.filter((r) => r.days[i].length).length || "")), String(totalHours), ...(options.showCosts ? [formatCurrency(totalCost)] : [])]]

  const dayCol = options.showCosts ? 28 : 31
  autoTable(doc, {
    startY: PDF_CONTENT_TOP,
    head: [head],
    body,
    foot,
    theme: "grid",
    margin: { left: margin, right: margin },
    headStyles: { fillColor: COLORS.tableHeader, textColor: COLORS.white, fontSize: 8, fontStyle: "bold", halign: "center", cellPadding: 2 },
    bodyStyles: { fontSize: 8.5, textColor: COLORS.text, cellPadding: 2.2, valign: "middle", halign: "center", minCellHeight: 11 },
    footStyles: { fillColor: COLORS.tint, textColor: COLORS.text, fontSize: 8.5, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "left", cellWidth: "auto", fontStyle: "bold" },
      ...Object.fromEntries(days.map((_, i) => [i + 1, { cellWidth: dayCol }])),
    },
    didParseCell: (data) => {
      if (data.section !== "body") return
      const c = data.column.index
      if (c >= 1 && c <= 7) {
        const working = rows[data.row.index]?.days[c - 1]?.length
        if (working) {
          data.cell.styles.fillColor = COLORS.tint
          data.cell.styles.fontStyle = "bold"
        } else data.cell.styles.textColor = COLORS.muted
      }
    },
  })

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.secondary)
    doc.text(`${pdfFooterPrefix(options.businessId)}${labels.pagina} ${i} ${labels.de} ${pages}`, pageWidth / 2, pageHeight - 7, { align: "center" })
  }
  return doc
}

export function generateStaffSchedulePDFFilename(monday: string): string {
  const labels = getPdfLabels()
  return `${safeFilePart(labels.horarioPersonal, "horario")}_${fileDate(new Date(noon(monday)))}.pdf`
}

export function downloadStaffSchedulePDF(schedule: StaffSchedule, options: StaffSchedulePDFOptions): void {
  generateStaffSchedulePDF(schedule, options).save(generateStaffSchedulePDFFilename(options.monday))
  recordPdfExport("schedule", options.businessId, { name: options.monday })
}
