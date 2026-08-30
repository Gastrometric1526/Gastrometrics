import type { Metadata } from "next"
import { AboutContent } from "@/components/about-content"

// Mismo patrón de cascarón-servidor que app/page.tsx — ver docs/72.
export const metadata: Metadata = {
  title: "Cómo funciona Gastrometrics — Fichas técnicas, costeo, inventario y menús",
  description:
    "Un recorrido por cada módulo de Gastrometrics: fichas técnicas, ingredientes e inventario, menús, órdenes de compra, estadísticas y multi-negocio.",
  openGraph: {
    title: "Cómo funciona Gastrometrics — Fichas técnicas, costeo, inventario y menús",
    description:
      "Un recorrido por cada módulo de Gastrometrics: fichas técnicas, ingredientes e inventario, menús, órdenes de compra, estadísticas y multi-negocio.",
  },
}

export default function AboutPage() {
  return <AboutContent />
}
