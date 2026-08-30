import type { MetadataRoute } from "next"
import { featurePages } from "@/lib/feature-pages"
import { resourceArticles } from "@/lib/resource-articles"

// Sitemap real — no existía ninguno antes (ver docs/72). Solo rutas públicas
// indexables: nada de /dashboard, /admin, /api ni otras pantallas que requieren
// sesión (esas ya quedan bloqueadas aparte en app/robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
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
    "/recursos",
  ]

  const featureRoutes = featurePages.map((f) => `/caracteristicas/${f.slug}`)
  const resourceRoutes = resourceArticles.map((a) => `/recursos/${a.slug}`)

  return [...staticRoutes, ...featureRoutes, ...resourceRoutes].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
  }))
}
