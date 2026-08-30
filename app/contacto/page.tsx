import type { Metadata } from "next"
import { ContactoContent } from "@/components/contacto-content"

// Mismo patrón de cascarón-servidor que app/page.tsx — ver docs/72.
export const metadata: Metadata = {
  title: "Contacto — Gastrometrics",
  description: "Escribinos una sugerencia, una queja o un reporte de error, o contactanos directo por correo.",
  openGraph: {
    title: "Contacto — Gastrometrics",
    description: "Escribinos una sugerencia, una queja o un reporte de error, o contactanos directo por correo.",
  },
}

export default function ContactoPage() {
  return <ContactoContent />
}
