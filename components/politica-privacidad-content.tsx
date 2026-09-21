"use client"

import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { useLanguage } from "@/contexts/language-context"

export function PoliticaPrivacidadContent() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 max-w-3xl space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-foreground">{t("privacidad_page_title")}</h1>
          <p className="text-muted-foreground">{t("privacidad_last_updated")}</p>
          <p className="text-sm font-medium text-foreground bg-muted/50 rounded-md px-3 py-2">{t("privacidad_gdpr_notice")}</p>
          <p className="text-sm text-muted-foreground">
            {t("terminos_read_also")}{" "}
            <a href="/terminos-de-uso" className="text-primary hover:underline">
              {t("terminos_page_title")}
            </a>
            {" · "}
            <a href="/aviso-de-responsabilidad" className="text-primary hover:underline">
              {t("aviso_page_title")}
            </a>
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s1_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s1_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s2_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s2_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s3_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s3_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s4_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s4_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s5_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s5_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s6_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s6_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s7_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s7_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s8_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s8_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s9_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s9_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s10_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s10_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s11_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s11_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s12_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s12_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_contact_label")}</h2>
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
