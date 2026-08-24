export type FeedbackType = "sugerencia" | "queja" | "bug"

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
