import { notFound } from "next/navigation"
import { CaracteristicasDetailContent } from "@/components/caracteristicas-detail-content"
import { getFeaturePage, featurePages } from "@/lib/feature-pages"

export function generateStaticParams() {
  return featurePages.map((f) => ({ slug: f.slug }))
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const feature = getFeaturePage(params.slug)
  if (!feature) notFound()

  return <CaracteristicasDetailContent feature={feature} />
}
