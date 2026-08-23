// Comprime el logo de un negocio a un data URL PNG chico antes de guardarlo en
// localStorage (sin backend, ver docs/12-guia-backend.md). PNG (no JPEG, a diferencia
// de lib/utils/image-compress.ts) para conservar transparencia — la mayoría de logos
// vienen con fondo transparente y jsPDF dibuja el "PNG" declarado tal cual (ver
// lib/pdf/recipe-pdf-generator.ts). Un logo se muestra siempre chico (encabezado de
// PDF o un ícono de ~48px), así que el máximo es mucho menor que el de una captura
// de pantalla de feedback.
const MAX_DIMENSION = 400

export async function compressLogoToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo preparar el lienzo para comprimir el logo")
  ctx.drawImage(bitmap, 0, 0, width, height)

  return canvas.toDataURL("image/png")
}
