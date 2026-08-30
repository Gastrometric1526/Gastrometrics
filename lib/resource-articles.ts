// Artículos educativos de /recursos/[slug] — pensados para búsquedas de "cómo hacer X"
// (distinto de /caracteristicas/[slug], que apunta a búsquedas de "software para X").
// Elegidos para no pisar las palabras clave que ya cubren esas 6 páginas — ver docs/72.
//
// Mismo patrón que lib/feature-pages.ts: guarda claves de traducción (TranslationKey),
// no texto literal — el texto real se resuelve con t() dentro del componente cliente
// que consume esto (components/resource-article-content.tsx), y con translate() del
// lado del servidor para generateMetadata (que solo puede estar en español, ver docs/72).

import type { TranslationKey } from "@/lib/i18n/translations"

export interface ResourceArticleSectionDef {
  headingKey: TranslationKey
  bodyKey: TranslationKey
}

export interface ResourceArticleDef {
  slug: string
  titleKey: TranslationKey
  taglineKey: TranslationKey
  metaDescriptionKey: TranslationKey
  introKey: TranslationKey
  sections: ResourceArticleSectionDef[]
  ctaHeadingKey: TranslationKey
  ctaBodyKey: TranslationKey
  // Link interno hacia la página de /caracteristicas correspondiente, si existe una.
  relatedFeatureSlug?: string
}

export const resourceArticles: ResourceArticleDef[] = [
  {
    slug: "como-calcular-food-cost-restaurante",
    titleKey: "resource_foodcost_title",
    taglineKey: "resource_foodcost_tagline",
    metaDescriptionKey: "resource_foodcost_meta_description",
    introKey: "resource_foodcost_intro",
    sections: [
      { headingKey: "resource_foodcost_section1_heading", bodyKey: "resource_foodcost_section1_body" },
      { headingKey: "resource_foodcost_section2_heading", bodyKey: "resource_foodcost_section2_body" },
      { headingKey: "resource_foodcost_section3_heading", bodyKey: "resource_foodcost_section3_body" },
      { headingKey: "resource_foodcost_section4_heading", bodyKey: "resource_foodcost_section4_body" },
    ],
    ctaHeadingKey: "resource_foodcost_cta_heading",
    ctaBodyKey: "resource_foodcost_cta_body",
    relatedFeatureSlug: "costeo",
  },
  {
    slug: "como-hacer-ficha-tecnica-de-cocina",
    titleKey: "resource_fichaguia_title",
    taglineKey: "resource_fichaguia_tagline",
    metaDescriptionKey: "resource_fichaguia_meta_description",
    introKey: "resource_fichaguia_intro",
    sections: [
      { headingKey: "resource_fichaguia_section1_heading", bodyKey: "resource_fichaguia_section1_body" },
      { headingKey: "resource_fichaguia_section2_heading", bodyKey: "resource_fichaguia_section2_body" },
      { headingKey: "resource_fichaguia_section3_heading", bodyKey: "resource_fichaguia_section3_body" },
      { headingKey: "resource_fichaguia_section4_heading", bodyKey: "resource_fichaguia_section4_body" },
    ],
    ctaHeadingKey: "resource_fichaguia_cta_heading",
    ctaBodyKey: "resource_fichaguia_cta_body",
    relatedFeatureSlug: "fichas-tecnicas",
  },
  {
    slug: "como-controlar-inventario-restaurante-reducir-mermas",
    titleKey: "resource_inventario_title",
    taglineKey: "resource_inventario_tagline",
    metaDescriptionKey: "resource_inventario_meta_description",
    introKey: "resource_inventario_intro",
    sections: [
      { headingKey: "resource_inventario_section1_heading", bodyKey: "resource_inventario_section1_body" },
      { headingKey: "resource_inventario_section2_heading", bodyKey: "resource_inventario_section2_body" },
      { headingKey: "resource_inventario_section3_heading", bodyKey: "resource_inventario_section3_body" },
      { headingKey: "resource_inventario_section4_heading", bodyKey: "resource_inventario_section4_body" },
    ],
    ctaHeadingKey: "resource_inventario_cta_heading",
    ctaBodyKey: "resource_inventario_cta_body",
    relatedFeatureSlug: "ingredientes-inventario",
  },
]

export function getResourceArticle(slug: string): ResourceArticleDef | null {
  return resourceArticles.find((a) => a.slug === slug) ?? null
}
