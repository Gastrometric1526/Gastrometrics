// "experiencia" = respuesta a la encuesta de satisfacción de las 4 horas (ver
// docs/117) — mismo buzón de /admin que sugerencia/queja/bug, categoría propia.
export type FeedbackType = "sugerencia" | "queja" | "bug" | "experiencia"

export type FeedbackStatus = "nuevo" | "revisado" | "resuelto"

export interface Feedback {
  id: string
  type: FeedbackType
  message: string
  userName?: string
  userEmail?: string
  page?: string
  // Captura de pantalla adjunta, ya comprimida a data URL (ver app/contacto/page.tsx,
  // compressImageToDataUrl) — nunca el archivo original, para no reventar la cuota de
  // localStorage con una imagen de varios MB.
  imageDataUrl?: string
  status: FeedbackStatus
  createdAt: string
  adminReply?: string
  repliedAt?: string
}
