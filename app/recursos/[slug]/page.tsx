import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ResourceArticleContent } from "@/components/resource-article-content"
import { getResourceArticle, resourceArticles } from "@/lib/resource-articles"
import { translate } from "@/lib/i18n/translations"

export function generateStaticParams() {
  return resourceArticles.map((a) => ({ slug: a.slug }))
}

// Mismo criterio que app/caracteristicas/[slug]/page.tsx — ver docs/72: el idioma real
// se resuelve del lado del cliente, así que los metadatos solo pueden estar en español.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getResourceArticle(params.slug)
  if (!article) return {}

  const title = `${translate("es", article.titleKey)} — Gastrometrics`
  const description = translate("es", article.metaDescriptionKey)

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default function ResourceArticlePage({ params }: { params: { slug: string } }) {
  const article = getResourceArticle(params.slug)
  if (!article) notFound()

  return <ResourceArticleContent article={article} />
}
