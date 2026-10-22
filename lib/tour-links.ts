/**
 * Enlaces directos a los tutoriales (docs/167). Ley del proyecto, pedida por el dueño:
 * cada novedad (lib/changelog.ts) lleva un botón al tutorial de la sección que cambió.
 *
 * Un tutorial se abre con `?tour=<slug>` en la URL de su página: components/page-tour.tsx
 * lo detecta al montar, lo abre desde el paso 1 aunque ya se hubiera visto y quita el
 * parámetro. Sirve igual desde la ventana de Novedades y desde el correo de novedades.
 */

/** Tutoriales que existen hoy: slug → página donde vive. El slug es el storageKey sin "tour_completed_". */
export const TOUR_PAGES: Record<string, string> = {
  "ficha-tecnica": "/ficha-tecnica",
  ingredientes: "/ingredientes",
  inventario: "/inventario",
  "mis-recetas": "/mis-recetas",
  menus: "/menus",
  estadisticas: "/estadisticas",
  "ordenes-compra": "/ordenes-compra",
  equipo: "/equipo",
  "mi-plan": "/mi-plan",
  "procesar-ordenes": "/procesar-ordenes",
  negocios: "/negocios",
  invita: "/invita",
}

export const TOUR_KEY_PREFIX = "tour_completed_"

/** URL que abre el tutorial de una sección. */
export function tourHref(slug: string): string {
  const page = TOUR_PAGES[slug]
  if (!page) throw new Error(`Tutorial desconocido: ${slug}`)
  return `${page}?tour=${slug}`
}

/** Slug del tutorial pedido en la URL, si coincide con este storageKey. */
export function requestedTourMatches(search: string, storageKey: string): boolean {
  const requested = new URLSearchParams(search).get("tour")
  if (!requested) return false
  return requested === storageKey || `${TOUR_KEY_PREFIX}${requested}` === storageKey
}

/** Separa "/mi-plan?tour=mi-plan" en página y slug. */
export function parseTourHref(href: string): { path: string; slug: string | null } {
  const [path, query = ""] = href.split("?")
  return { path, slug: new URLSearchParams(query).get("tour") }
}
