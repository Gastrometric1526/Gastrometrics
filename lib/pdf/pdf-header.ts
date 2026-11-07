import type { jsPDF } from "jspdf"
import { drawBusinessLogo } from "./pdf-logo"

/**
 * Encabezado común de los PDF de gestión (pedido del dueño, docs/251): antes cada generador
 * lo dibujaba por su cuenta, con logo y título de distinto tamaño y altura. Las copias de la
 * Ficha Técnica y la carta conservan su diseño propio, pero usan este mismo tamaño de logo.
 */

export const PDF_LOGO_SIZE = 15
export const PDF_HEADER_HEIGHT = 24
/** Donde empieza el contenido bajo el encabezado. */
export const PDF_CONTENT_TOP = 32

const MARGIN = 14
const BACKGROUND: [number, number, number] = [245, 245, 245]
const BORDER: [number, number, number] = [200, 200, 200]
const TEXT: [number, number, number] = [40, 40, 40]
const MUTED: [number, number, number] = [100, 100, 100]

export function drawPdfHeader(
  doc: jsPDF,
  header: {
    logo?: string | null
    /** Nombre del negocio, ya limpio. */
    name: string
    /** Línea bajo el nombre: fecha de exportación o del documento. */
    meta: string
    title: string
    subtitle: string
    primary: [number, number, number]
  },
): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BACKGROUND)
  doc.rect(0, 0, pageWidth, PDF_HEADER_HEIGHT, "F")
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.3)
  doc.line(0, PDF_HEADER_HEIGHT, pageWidth, PDF_HEADER_HEIGHT)

  const logoTop = (PDF_HEADER_HEIGHT - PDF_LOGO_SIZE) / 2
  if (header.logo) drawBusinessLogo(doc, header.logo, MARGIN, logoTop, PDF_LOGO_SIZE, PDF_LOGO_SIZE)
  const textX = MARGIN + (header.logo ? PDF_LOGO_SIZE + 3 : 0)

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...TEXT)
  doc.text(header.name, textX, 11)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...MUTED)
  doc.text(header.meta, textX, 18)

  doc.setFontSize(15)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(...header.primary)
  doc.text(header.title, pageWidth - MARGIN, 11, { align: "right" })

  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(...TEXT)
  doc.text(header.subtitle, pageWidth - MARGIN, 18, { align: "right" })
}
