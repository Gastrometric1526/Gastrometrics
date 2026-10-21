import type { Metadata } from "next"
import { ReviewsPageContent } from "@/components/reviews-page-content"

// Opiniones de chefs que usan GastroMetrics (docs/173): solo las publicadas con permiso.
export const metadata: Metadata = {
  title: "Opiniones de chefs — Gastrometrics",
  description: "Lo que dicen los chefs y dueños de cocinas que usan Gastrometrics para costear recetas, controlar inventario y poner precios.",
}

export default function ReviewsPage() {
  return <ReviewsPageContent />
}
