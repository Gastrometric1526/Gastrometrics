import type { Metadata } from "next"
import { HomeContent } from "@/components/home-content"
import { plans } from "@/lib/plans"
import { CONTACT_EMAIL, SOCIAL_LINKS, TRUSTPILOT_URL } from "@/lib/site-links"

// El contenido traducible vive en components/home-content.tsx (Client Component, usa
// useLanguage) porque `export const metadata` de abajo solo es válido en un Server
// Component — este archivo se queda como cascarón de servidor para el <title>/
// <meta description>, y delega todo el JSX real al componente cliente (mismo patrón
// que components/terminos-de-uso-content.tsx, ver docs/72). El idioma real se resuelve
// del lado del cliente (no hay señal de idioma en el servidor), así que estos
// metadatos solo pueden estar en español — es lo mismo que ve cualquier buscador.
export const metadata: Metadata = {
  title: "Gastrometrics — Costeo, fichas técnicas e inventario para restaurantes",
  description:
    "Calcula el costo real de cada plato, controla tu inventario y arma fichas técnicas sin hojas de cálculo. Gratis para empezar.",
  openGraph: {
    title: "Gastrometrics — Costeo, fichas técnicas e inventario para restaurantes",
    description:
      "Calcula el costo real de cada plato, controla tu inventario y arma fichas técnicas sin hojas de cálculo. Gratis para empezar.",
  },
}

// Datos estructurados (schema.org, docs/135): le dicen a Google qué es Gastrometrics —
// empresa, aplicación web, precios reales de lib/plans.ts, idiomas, redes sociales y
// perfil de Trustpilot — para resultados enriquecidos y el panel de marca.
function structuredData() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gastrometrics.org"
  const sameAs = [TRUSTPILOT_URL, ...SOCIAL_LINKS.map((link) => link.url)]
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Gastrometrics",
      url: siteUrl,
      logo: `${siteUrl}/icon-512x512.png`,
      email: CONTACT_EMAIL,
      sameAs,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Gastrometrics",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: siteUrl,
      inLanguage: ["es", "en", "da", "fr", "pt", "zh"],
      description:
        "Costeo de recetas, fichas técnicas, precio de venta sugerido, inventario con stock teórico, menús y órdenes de compra para restaurantes.",
      offers: plans
        .filter((plan) => !plan.comingSoon)
        .map((plan) => ({
          "@type": "Offer",
          name: plan.name,
          price: (plan.priceUsdCents / 100).toFixed(2),
          priceCurrency: "USD",
        })),
    },
  ]
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }} />
      <HomeContent />
    </>
  )
}
