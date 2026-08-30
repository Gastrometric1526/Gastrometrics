import type { Metadata } from "next"
import { RecursosContent } from "@/components/recursos-content"

// Mismo patrón de cascarón-servidor que app/page.tsx — ver docs/72.
export const metadata: Metadata = {
  title: "Recursos — Gastrometrics",
  description: "Guías prácticas de costeo, fichas técnicas e inventario para restaurantes.",
  openGraph: {
    title: "Recursos — Gastrometrics",
    description: "Guías prácticas de costeo, fichas técnicas e inventario para restaurantes.",
  },
}

export default function RecursosPage() {
  return <RecursosContent />
}
