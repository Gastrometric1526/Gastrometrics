import type { jsPDF } from "jspdf"
import type { PdfFiscal } from "./pdf-branding"

/**
 * Datos fiscales del negocio en facturas y órdenes de compra (pedido del dueño, docs/251).
 * Sin datos no se dibuja nada. Se guardan por negocio (Configuración → Apariencia → Tus PDF).
 */

/** Las líneas del bloque, en orden. Puro. */
export function fiscalLines(fiscal: PdfFiscal | undefined, taxLabel: string): string[] {
  if (!fiscal) return []
  const join = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(" · ")
  return [
    fiscal.legalName ?? "",
    join(fiscal.taxId ? `${taxLabel}: ${fiscal.taxId}` : undefined, fiscal.address),
    join(fiscal.phone, fiscal.email),
  ].filter(Boolean)
}

/** Dibuja el bloque y devuelve dónde sigue el contenido. */
export function drawFiscalBlock(
  doc: jsPDF,
  input: { lines: string[]; title: string; x: number; y: number; width: number },
): number {
  if (input.lines.length === 0) return input.y
  doc.setFontSize(7.5)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  doc.text(input.title, input.x, input.y + 3)
  let y = input.y + 7
  doc.setTextColor(40, 40, 40)
  input.lines.forEach((line, index) => {
    doc.setFontSize(index === 0 ? 9 : 8)
    doc.setFont("helvetica", index === 0 ? "bold" : "normal")
    const wrapped = doc.splitTextToSize(line, input.width) as string[]
    doc.text(wrapped, input.x, y)
    y += wrapped.length * 4
  })
  return y + 3
}
