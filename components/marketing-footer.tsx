"use client"

import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"
import { Facebook, Instagram, Linkedin, Music2, Youtube, Star } from "lucide-react"
import { SOCIAL_LINKS, TRUSTPILOT_URL, CONTACT_EMAIL, type SocialNetwork } from "@/lib/site-links"

const SOCIAL_ICONS: Record<SocialNetwork, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: Music2,
  youtube: Youtube,
}

// Footer compartido por las páginas públicas ("/", "/about", "/caracteristicas/[slug]").
// Antes cada página repetía el mismo <footer> a mano sin enlaces legales — se centraliza
// aquí para que Política de Privacidad y Términos de Uso queden accesibles desde todo
// el sitio público, no solo desde el registro.
export function MarketingFooter() {
  const { t } = useLanguage()

  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="container mx-auto px-4 py-8 space-y-4">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/politica-privacidad" className="hover:text-foreground transition-colors">
            {t("marketing_footer_privacy")}
          </Link>
          <Link href="/terminos-de-uso" className="hover:text-foreground transition-colors">
            {t("marketing_footer_terms")}
          </Link>
          <Link href="/aviso-de-responsabilidad" className="hover:text-foreground transition-colors">
            {t("marketing_footer_liability")}
          </Link>
          <Link href="/contacto" className="hover:text-foreground transition-colors">
            {t("marketing_footer_suggestions")}
          </Link>
          <Link href="/recursos" className="hover:text-foreground transition-colors">
            {t("marketing_footer_resources")}
          </Link>
          <a
            href={TRUSTPILOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <Star className="h-3.5 w-3.5" />
            {t("marketing_footer_reviews")}
          </a>
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground transition-colors">
            {CONTACT_EMAIL}
          </a>
        </div>
        {/* Redes: solo aparecen las que tengan URL en su variable de entorno (lib/site-links.ts, docs/135). */}
        {SOCIAL_LINKS.length > 0 && (
          <div className="flex justify-center gap-4">
            {SOCIAL_LINKS.map((link) => {
              const Icon = SOCIAL_ICONS[link.network]
              return (
                <a
                  key={link.network}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.label}
                  title={link.label}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Icon className="h-5 w-5" />
                </a>
              )
            })}
          </div>
        )}
        <div className="text-center text-muted-foreground text-sm space-y-1">
          <p>{t("marketing_footer_help_text")}</p>
          <p>{t("marketing_footer_rights")}</p>
        </div>
      </div>
    </footer>
  )
}
