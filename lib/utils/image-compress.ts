// Comprime una imagen (captura de pantalla adjunta a Sugerencias y Reportes, ver
// app/contacto/page.tsx) a un data URL JPEG chico antes de guardarla — todo vive en
// localStorage (sin backend, ver docs/12-guia-backend.md), que tiene una cuota de
// pocos MB por origen compartida con el resto de la app. Una captura de pantalla sin
// comprimir de un monitor 4K puede pesar varios MB y tirar esa cuota para todo,
// no solo para el feedback.
const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.7

export async function compressImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo preparar el lienzo para comprimir la imagen")
  ctx.drawImage(bitmap, 0, 0, width, height)

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
}
