import type { Metadata } from "next"
import { FoodCostCalculatorContent } from "@/components/food-cost-calculator-content"
import { canonicalSiteUrl } from "@/lib/site-url"

// Calculadora pública y gratuita (docs/178): atrae búsquedas como «calculadora de food cost»
// o «cómo calcular el precio de un plato» y lleva a crear cuenta.

const SITE = canonicalSiteUrl()

export const metadata: Metadata = {
  title: "Calculadora de food cost y precio de venta gratis — Gastrometrics",
  description:
    "Calcula gratis y sin registro el precio de venta de tu plato con tu food cost objetivo, el ISV y la comisión de delivery, y el costo real de un ingrediente con merma.",
  alternates: { canonical: `${SITE}/calculadora-food-cost` },
  openGraph: {
    title: "Calculadora de food cost gratis",
    description: "Pon el costo de tu plato y te decimos a cuánto venderlo. Gratis, sin registro.",
    type: "website",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Calculadora de food cost — Gastrometrics",
  url: `${SITE}/calculadora-food-cost`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: "es",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
}

export default function FoodCostCalculatorPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FoodCostCalculatorContent />
    </>
  )
}
