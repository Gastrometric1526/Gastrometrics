import type { Metadata } from "next"
import { PlanesContent } from "@/components/planes-content"

// Mismo patrón de cascarón-servidor que app/page.tsx — ver docs/72.
export const metadata: Metadata = {
  title: "Planes y precios — Gastrometrics",
  description:
    "Desde un plan gratis con fichas técnicas ilimitadas hasta inventario, menús y finanzas completas. Elegí el plan según el tamaño de tu negocio.",
  openGraph: {
    title: "Planes y precios — Gastrometrics",
    description:
      "Desde un plan gratis con fichas técnicas ilimitadas hasta inventario, menús y finanzas completas. Elegí el plan según el tamaño de tu negocio.",
  },
}

export default function PlanesPage() {
  return <PlanesContent />
}
