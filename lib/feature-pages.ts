// Contenido de las páginas de detalle de cada característica (/caracteristicas/[slug]).
// Separado de app/page.tsx y app/about/page.tsx porque este contenido es más largo y
// tiene su propia estructura (pasos + capturas), no encaja en las tarjetas cortas de
// esas dos páginas. El texto describe únicamente funciones que existen de verdad en la
// app — nada aspiracional (regla del proyecto, ver docs/22).
//
// Guarda claves de traducción (TranslationKey), no texto literal — el texto real se
// resuelve con t() dentro del componente cliente que consume esto (mismo patrón que
// app/about/page.tsx), ya que t() requiere estar dentro de un componente.

import type { TranslationKey } from "@/lib/i18n/translations"

export interface FeatureStepDef {
  titleKey: TranslationKey
  descKey: TranslationKey
}

export interface FeatureScreenshotDef {
  src: string
  altKey: TranslationKey
  captionKey: TranslationKey
}

export interface FeaturePageDef {
  slug: string
  titleKey: TranslationKey
  taglineKey: TranslationKey
  introKey: TranslationKey
  steps: FeatureStepDef[]
  highlightKeys: TranslationKey[]
  screenshots: FeatureScreenshotDef[]
}

export const featurePages: FeaturePageDef[] = [
  {
    slug: "fichas-tecnicas",
    titleKey: "feat_fichas_title",
    taglineKey: "feat_fichas_tagline",
    introKey: "feat_fichas_intro",
    steps: [
      { titleKey: "feat_fichas_step1_title", descKey: "feat_fichas_step1_desc" },
      { titleKey: "feat_fichas_step2_title", descKey: "feat_fichas_step2_desc" },
      { titleKey: "feat_fichas_step3_title", descKey: "feat_fichas_step3_desc" },
      { titleKey: "feat_fichas_step4_title", descKey: "feat_fichas_step4_desc" },
    ],
    highlightKeys: [
      "feat_fichas_highlight1",
      "feat_fichas_highlight2",
      "feat_fichas_highlight3",
      "feat_fichas_highlight4",
    ],
    screenshots: [
      { src: "/screenshots/ficha-tecnica-top.png", altKey: "feat_fichas_shot1_alt", captionKey: "feat_fichas_shot1_caption" },
    ],
  },
  {
    slug: "costeo",
    titleKey: "feat_costeo_title",
    taglineKey: "feat_costeo_tagline",
    introKey: "feat_costeo_intro",
    steps: [
      { titleKey: "feat_costeo_step1_title", descKey: "feat_costeo_step1_desc" },
      { titleKey: "feat_costeo_step2_title", descKey: "feat_costeo_step2_desc" },
      { titleKey: "feat_costeo_step3_title", descKey: "feat_costeo_step3_desc" },
      { titleKey: "feat_costeo_step4_title", descKey: "feat_costeo_step4_desc" },
    ],
    highlightKeys: [
      "feat_costeo_highlight1",
      "feat_costeo_highlight2",
      "feat_costeo_highlight3",
      "feat_costeo_highlight4",
    ],
    screenshots: [
      { src: "/screenshots/ficha-tecnica-costeo.png", altKey: "feat_costeo_shot1_alt", captionKey: "feat_costeo_shot1_caption" },
    ],
  },
  {
    slug: "ingredientes-inventario",
    titleKey: "feat_ingredientes_title",
    taglineKey: "feat_ingredientes_tagline",
    introKey: "feat_ingredientes_intro",
    steps: [
      { titleKey: "feat_ingredientes_step1_title", descKey: "feat_ingredientes_step1_desc" },
      { titleKey: "feat_ingredientes_step2_title", descKey: "feat_ingredientes_step2_desc" },
      { titleKey: "feat_ingredientes_step3_title", descKey: "feat_ingredientes_step3_desc" },
    ],
    highlightKeys: [
      "feat_ingredientes_highlight1",
      "feat_ingredientes_highlight2",
      "feat_ingredientes_highlight3",
      "feat_ingredientes_highlight4",
    ],
    screenshots: [
      { src: "/screenshots/ingredientes.png", altKey: "feat_ingredientes_shot1_alt", captionKey: "feat_ingredientes_shot1_caption" },
      { src: "/screenshots/inventario.png", altKey: "feat_ingredientes_shot2_alt", captionKey: "feat_ingredientes_shot2_caption" },
    ],
  },
  {
    slug: "menus",
    titleKey: "feat_menus_title",
    taglineKey: "feat_menus_tagline",
    introKey: "feat_menus_intro",
    steps: [
      { titleKey: "feat_menus_step1_title", descKey: "feat_menus_step1_desc" },
      { titleKey: "feat_menus_step2_title", descKey: "feat_menus_step2_desc" },
      { titleKey: "feat_menus_step3_title", descKey: "feat_menus_step3_desc" },
    ],
    highlightKeys: [
      "feat_menus_highlight1",
      "feat_menus_highlight2",
      "feat_menus_highlight3",
      "feat_menus_highlight4",
    ],
    screenshots: [
      { src: "/screenshots/menus.png", altKey: "feat_menus_shot1_alt", captionKey: "feat_menus_shot1_caption" },
    ],
  },
  {
    slug: "ordenes-compra",
    titleKey: "feat_ordenes_title",
    taglineKey: "feat_ordenes_tagline",
    introKey: "feat_ordenes_intro",
    steps: [
      { titleKey: "feat_ordenes_step1_title", descKey: "feat_ordenes_step1_desc" },
      { titleKey: "feat_ordenes_step2_title", descKey: "feat_ordenes_step2_desc" },
      { titleKey: "feat_ordenes_step3_title", descKey: "feat_ordenes_step3_desc" },
    ],
    highlightKeys: [
      "feat_ordenes_highlight1",
      "feat_ordenes_highlight2",
      "feat_ordenes_highlight3",
      "feat_ordenes_highlight4",
    ],
    screenshots: [
      { src: "/screenshots/ordenes-compra.png", altKey: "feat_ordenes_shot1_alt", captionKey: "feat_ordenes_shot1_caption" },
    ],
  },
  {
    slug: "estadisticas",
    titleKey: "feat_estadisticas_title",
    taglineKey: "feat_estadisticas_tagline",
    introKey: "feat_estadisticas_intro",
    steps: [
      { titleKey: "feat_estadisticas_step1_title", descKey: "feat_estadisticas_step1_desc" },
      { titleKey: "feat_estadisticas_step2_title", descKey: "feat_estadisticas_step2_desc" },
      { titleKey: "feat_estadisticas_step3_title", descKey: "feat_estadisticas_step3_desc" },
    ],
    highlightKeys: [
      "feat_estadisticas_highlight1",
      "feat_estadisticas_highlight2",
      "feat_estadisticas_highlight3",
      "feat_estadisticas_highlight4",
    ],
    screenshots: [
      { src: "/screenshots/estadisticas.png", altKey: "feat_estadisticas_shot1_alt", captionKey: "feat_estadisticas_shot1_caption" },
    ],
  },
]

export function getFeaturePage(slug: string): FeaturePageDef | null {
  return featurePages.find((f) => f.slug === slug) ?? null
}
