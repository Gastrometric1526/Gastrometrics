import type { MetadataRoute } from "next"
import { featurePages } from "@/lib/feature-pages"
import { resourceArticles } from "@/lib/resource-articles"
import { seoLandings } from "@/lib/seo-landings"
import { canonicalSiteUrl } from "@/lib/site-url"

// Sitemap real — no existía ninguno antes (ver docs/72). Solo rutas públicas
// indexables: nada de /dashboard, /admin, /api ni otras pantallas que requieren
// sesión (esas ya quedan bloqueadas aparte en app/robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = canonicalSiteUrl()
  const now = new Date()

  const staticRoutes = [
    "",
    "/about",
    "/planes",
    "/contacto",
    "/login",
    "/signup",
    "/terminos-de-uso",
    "/politica-privacidad",
    "/aviso-de-responsabilidad",
    "/recursos",
    "/resenas",
  ]

  const featureRoutes = featurePages.map((f) => `/caracteristicas/${f.slug}`)
  const resourceRoutes = resourceArticles.map((a) => `/recursos/${a.slug}`)
  // Páginas de búsqueda por idioma (docs/173).
  const softwareRoutes = seoLandings.map((l) => `/software/${l.slug}`)

  return [...staticRoutes, ...featureRoutes, ...resourceRoutes, ...softwareRoutes].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
  }))
}
