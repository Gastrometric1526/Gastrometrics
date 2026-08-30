"use client"

import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"

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
          <Link href="/contacto" className="hover:text-foreground transition-colors">
            {t("marketing_footer_suggestions")}
          </Link>
          <Link href="/recursos" className="hover:text-foreground transition-colors">
            {t("marketing_footer_resources")}
          </Link>
          <a href="mailto:GastroMetrics@outlook.com" className="hover:text-foreground transition-colors">
            GastroMetrics@outlook.com
          </a>
        </div>
        <div className="text-center text-muted-foreground text-sm space-y-1">
          <p>{t("marketing_footer_help_text")}</p>
          <p>{t("marketing_footer_rights")}</p>
        </div>
      </div>
    </footer>
  )
}
