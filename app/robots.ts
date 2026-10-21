import type { MetadataRoute } from "next"
import { canonicalSiteUrl } from "@/lib/site-url"

// robots.txt real — no existía ninguno antes (ver docs/72). Bloquea las rutas que
// requieren sesión (nadie relevante para SEO puede verlas de todas formas, RLS/el
// candado de /admin ya las protege del lado de los datos — esto es solo una señal
// para buscadores, no un mecanismo de seguridad) y deja indexar todo lo público.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = canonicalSiteUrl()

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/dashboard", "/api/", "/mi-plan", "/equipo", "/negocios"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
