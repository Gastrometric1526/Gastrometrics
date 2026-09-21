import { AvisoDeResponsabilidadContent } from "@/components/aviso-de-responsabilidad-content"

// Tercer documento legal (junto a /terminos-de-uso y /politica-privacidad), pedido
// explícito del dueño del proyecto: implementar los 3 documentos reales que entregó
// (PDF), versión 1.2. Ver docs/118.
//
// El contenido traducible vive en components/aviso-de-responsabilidad-content.tsx
// (Client Component, usa useLanguage) por la misma razón que los otros dos: `export
// const metadata` de abajo solo es válido en un Server Component.

export const metadata = {
  title: "Aviso de Responsabilidad — Gastrometrics",
  description: "Aviso de Responsabilidad de Gastrometrics: naturaleza orientativa de los cálculos, exclusión de garantías y limitación de responsabilidad.",
}

export default function AvisoDeResponsabilidadPage() {
  return <AvisoDeResponsabilidadContent />
}
