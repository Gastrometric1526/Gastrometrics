"use client"

import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { useLanguage } from "@/contexts/language-context"

export function AvisoDeResponsabilidadContent() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 max-w-3xl space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-foreground">{t("aviso_page_title")}</h1>
          <p className="text-muted-foreground">{t("aviso_subtitle")}</p>
          <p className="text-muted-foreground">{t("aviso_last_updated")}</p>
          <p className="text-sm font-medium text-foreground bg-muted/50 rounded-md px-3 py-2">{t("aviso_binding_notice")}</p>
          <p className="text-sm text-muted-foreground">
            {t("terminos_read_also")}{" "}
            <a href="/terminos-de-uso" className="text-primary hover:underline">
              {t("terminos_page_title")}
            </a>
            {" · "}
            <a href="/politica-privacidad" className="text-primary hover:underline">
              {t("privacidad_page_title")}
            </a>
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_s1_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s1_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_s2_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s2_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_s3_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s3_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_s4_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s4_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_s5_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s5_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_s6_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s6_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("aviso_contact_label")}</h2>
          <p className="text-muted-foreground">
            <a href="/contacto" className="text-primary hover:underline">
              /contacto
            </a>{" "}
            · <span className="text-foreground">gastrometrics@outlook.com</span>
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
