import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Check } from "lucide-react"
import { GastrometricsLogo } from "@/components/gastrometrics-logo"
import { getSeoLanding, seoLandings } from "@/lib/seo-landings"
import { canonicalSiteUrl } from "@/lib/site-url"

// Páginas de búsqueda por idioma (docs/173): llegan del servidor ya en su idioma, con
// hreflang entre ellas y datos estructurados (SoftwareApplication + FAQPage).

const SITE = canonicalSiteUrl()

export function generateStaticParams() {
  return seoLandings.map((l) => ({ slug: l.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getSeoLanding(params.slug)
  if (!page) return {}
  const languages = Object.fromEntries(seoLandings.map((l) => [l.htmlLang, `${SITE}/software/${l.slug}`]))
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `${SITE}/software/${page.slug}`, languages: { ...languages, "x-default": `${SITE}/software/costeo-de-recetas` } },
    openGraph: { title: page.title, description: page.description, locale: page.htmlLang.replace("-", "_"), type: "website" },
  }
}

export default function SoftwareLandingPage({ params }: { params: { slug: string } }) {
  const page = getSeoLanding(params.slug)
  if (!page) notFound()

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Gastrometrics",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android, iOS",
      description: page.description,
      inLanguage: page.htmlLang,
      url: `${SITE}/software/${page.slug}`,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Foodie" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage: page.htmlLang,
      mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ]

  return (
    <div lang={page.htmlLang} className="min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Gastrometrics" className="flex items-center gap-2">
            <GastrometricsLogo className="h-8 w-8" />
            <span className="font-semibold">Gastrometrics</span>
          </Link>
          <Link href="/signup" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {page.ctaButton}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14 md:py-20 space-y-5">
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight leading-tight">{page.h1}</h1>
        <p className="max-w-3xl text-lg text-muted-foreground">{page.lead}</p>
        <Link href="/signup" className="inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90">
          {page.ctaButton}
        </Link>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12 grid gap-8 md:grid-cols-3">
        {page.sections.map((s) => (
          <article key={s.h2} className="space-y-2">
            <h2 className="text-xl font-semibold">{s.h2}</h2>
            <p className="text-muted-foreground leading-relaxed">{s.body}</p>
          </article>
        ))}
      </section>

      <section className="bg-canvas-alt border-y border-hairline">
        <div className="mx-auto max-w-5xl px-6 py-12 space-y-5">
          <h2 className="text-2xl font-semibold">{page.featuresTitle}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {page.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12 space-y-5">
        <h2 className="text-2xl font-semibold">{page.faqTitle}</h2>
        <div className="space-y-4">
          {page.faq.map((f) => (
            <details key={f.q} className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-8 space-y-3 text-center">
          <h2 className="text-2xl font-semibold">{page.closingTitle}</h2>
          <p className="text-muted-foreground">{page.closingBody}</p>
          <Link href="/signup" className="inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90">
            {page.ctaButton}
          </Link>
        </div>
      </section>

      <footer className="border-t border-hairline">
        <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-muted-foreground">
          <span className="mr-2">{page.otherLanguages}:</span>
          {seoLandings
            .filter((l) => l.slug !== page.slug)
            .map((l, i) => (
              <span key={l.slug}>
                {i > 0 && " · "}
                <Link href={`/software/${l.slug}`} hrefLang={l.htmlLang} className="hover:text-primary">
                  {l.languageName}
                </Link>
              </span>
            ))}
        </div>
      </footer>
    </div>
  )
}
