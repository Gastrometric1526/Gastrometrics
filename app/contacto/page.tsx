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

// searchParams llega como prop del servidor (Next.js se lo pasa directo a page.tsx) —
// permite preseleccionar el tipo (?type=experiencia, ver docs/117) sin necesitar
// useSearchParams() en el cliente ni envolver la página en <Suspense>.
export default function ContactoPage({ searchParams }: { searchParams: { type?: string } }) {
  return <ContactoContent initialType={searchParams.type} />
}
