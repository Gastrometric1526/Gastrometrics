import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CaracteristicasDetailContent } from "@/components/caracteristicas-detail-content"
import { getFeaturePage, featurePages } from "@/lib/feature-pages"
import { translate } from "@/lib/i18n/translations"

export function generateStaticParams() {
  return featurePages.map((f) => ({ slug: f.slug }))
}

// El idioma real de quien visita se resuelve del lado del cliente (ver
// contexts/language-context.tsx) — no hay ninguna señal de idioma disponible del lado
// del servidor (sin cookie, sin header Accept-Language), así que los metadatos, que
// SÍ se generan en el servidor, solo pueden estar en español. Es lo mismo que ve
// cualquier buscador de todas formas, sin importar qué tan traducida esté la página.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const feature = getFeaturePage(params.slug)
  if (!feature) return {}

  const title = `${translate("es", feature.titleKey)} — Gastrometrics`
  const description = translate("es", feature.taglineKey)

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const feature = getFeaturePage(params.slug)
  if (!feature) notFound()

  return <CaracteristicasDetailContent feature={feature} />
}
