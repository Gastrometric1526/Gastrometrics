import type { jsPDF } from "jspdf"

// Imágenes en los PDF (docs/137): fotos de receta y logos del negocio.
//
// BUG CORREGIDO: las fotos se dibujaban con un tamaño fijo (80×55 o 100×60 mm) sin mirar su
// proporción — una foto vertical o panorámica salía deformada — y siempre como "JPEG" (y los
// logos siempre como "PNG"): si el archivo real era de otro formato, jsPDF fallaba y la
// imagen desaparecía en silencio. Acá se detecta el formato real del data URL y la imagen se
// encaja dentro de una caja respetando su proporción.

export type PdfImageFormat = "PNG" | "JPEG" | "WEBP"

export function imageFormatOf(dataUrl: string | null | undefined): PdfImageFormat | null {
  if (!dataUrl) return null
  const match = /^data:image\/(png|jpe?g|webp)/i.exec(dataUrl)
  if (!match) return null
  const kind = match[1].toLowerCase()
  return kind === "png" ? "PNG" : kind === "webp" ? "WEBP" : "JPEG"
}

export interface DrawnImage {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Dibuja `dataUrl` dentro de la caja (x, y, maxWidth × maxHeight) sin deformarla: la achica
 * hasta que quepa y la alinea horizontalmente. Devuelve el área ocupada, o null si la imagen
 * no se pudo leer (formato no soportado, archivo dañado).
 */
export function drawImageFit(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number,
  align: "left" | "center" = "center",
): DrawnImage | null {
  const format = imageFormatOf(dataUrl)
  if (!format) return null
  try {
    const props = doc.getImageProperties(dataUrl)
    if (!props.width || !props.height) return null
    const ratio = props.width / props.height
    let width = maxWidth
    let height = width / ratio
    if (height > maxHeight) {
      height = maxHeight
      width = height * ratio
    }
    const drawX = align === "center" ? x + (maxWidth - width) / 2 : x
    doc.addImage(dataUrl, format, drawX, y, width, height)
    return { x: drawX, y, width, height }
  } catch (error) {
    console.error("[pdf-image] No se pudo agregar la imagen al PDF:", error)
    return null
  }
}

/**
 * Reduce y normaliza una foto subida por el usuario (docs/137): lado mayor de 1600 px como
 * máximo y JPEG de buena calidad. Antes se guardaba el archivo original tal cual (a veces
 * varios MB en base64 dentro de la receta, y en formatos que el PDF no podía dibujar).
 * Si el navegador no puede procesarla, se devuelve el original.
 */
export function normalizeUploadedPhoto(file: File, maxSide = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onerror = () => resolve("")
    reader.onload = () => {
      const original = String(reader.result || "")
      if (typeof document === "undefined") return resolve(original)
      const img = new Image()
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
          const canvas = document.createElement("canvas")
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
          const ctx = canvas.getContext("2d")
          if (!ctx) return resolve(original)
          ctx.fillStyle = "#ffffff" // fondo blanco para PNG con transparencia
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL("image/jpeg", quality))
        } catch {
          resolve(original)
        }
      }
      img.onerror = () => resolve(original)
      img.src = original
    }
    reader.readAsDataURL(file)
  })
}
