import type { jsPDF } from "jspdf"

// Dibuja el logo del negocio respetando su proporción real, en vez de forzarlo a un
// cuadrado fijo (bug real: los 4 sitios que dibujaban el logo — 3 en
// recipe-pdf-generator.ts, 1 en purchase-order-pdf-generator.ts — usaban addImage con
// ancho y alto iguales hardcodeados, así que cualquier logo no cuadrado (la mayoría,
// sobre todo un wordmark horizontal) salía visiblemente estirado o achatado). Encaja
// el logo dentro de una caja máxima (maxWidth × maxHeight) preservando su relación de
// aspecto real, leída con jsPDF.getImageProperties — nunca lo agranda más allá de esa
// caja, solo lo achica si hace falta.
export function drawBusinessLogo(
  doc: jsPDF,
  logoDataUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
): boolean {
  try {
    const props = doc.getImageProperties(logoDataUrl)
    if (!props.width || !props.height) return false

    const aspectRatio = props.width / props.height
    let drawWidth = maxWidth
    let drawHeight = drawWidth / aspectRatio

    if (drawHeight > maxHeight) {
      drawHeight = maxHeight
      drawWidth = drawHeight * aspectRatio
    }

    doc.addImage(logoDataUrl, "PNG", x, y, drawWidth, drawHeight)
    return true
  } catch (error) {
    console.error("Error al agregar el logo del negocio al PDF:", error)
    return false
  }
}
