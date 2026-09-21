"use client"

import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { useLanguage } from "@/contexts/language-context"

export function TerminosDeUsoContent() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 max-w-3xl space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-foreground">{t("terminos_page_title")}</h1>
          <p className="text-muted-foreground">{t("terminos_last_updated")}</p>
          <p className="text-sm font-medium text-foreground bg-muted/50 rounded-md px-3 py-2">{t("terminos_binding_notice")}</p>
          <p className="text-sm text-muted-foreground">
            {t("terminos_read_also")}{" "}
            <a href="/politica-privacidad" className="text-primary hover:underline">
              {t("privacidad_page_title")}
            </a>
            {" · "}
            <a href="/aviso-de-responsabilidad" className="text-primary hover:underline">
              {t("aviso_page_title")}
            </a>
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s1_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s1_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s2_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s2_body")}</p>
          <p className="text-sm font-medium text-foreground bg-muted/50 rounded-md px-3 py-2">{t("terminos_s2_highlight")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s3_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s3_body")}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s4_title")}</h2>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t("terminos_s4_1_title")}</h3>
            <p className="text-muted-foreground">{t("terminos_s4_1_body")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t("terminos_s4_2_title")}</h3>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>{t("terminos_s4_2_item1")}</li>
              <li>{t("terminos_s4_2_item2")}</li>
              <li>{t("terminos_s4_2_item3")}</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t("terminos_s4_3_title")}</h3>
            <p className="text-muted-foreground">{t("terminos_s4_3_body")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t("terminos_s4_4_title")}</h3>
            <p className="text-muted-foreground">{t("terminos_s4_4_body")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t("terminos_s4_5_title")}</h3>
            <p className="text-muted-foreground">{t("terminos_s4_5_body")}</p>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{t("terminos_s4_6_title")}</h3>
            <p className="text-muted-foreground">{t("terminos_s4_6_body")}</p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s5_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s5_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s6_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s6_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s7_title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("terminos_s7_item1")}</li>
            <li>{t("terminos_s7_item2")}</li>
            <li>{t("terminos_s7_item3")}</li>
            <li>{t("terminos_s7_item4")}</li>
            <li>{t("terminos_s7_item5")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s8_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s8_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s9_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s9_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s10_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s10_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s11_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s11_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s12_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s12_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s13_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s13_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s14_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s14_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s15_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s15_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s16_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s16_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_contact_label")}</h2>
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
