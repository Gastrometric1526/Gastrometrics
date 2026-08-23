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
          <p className="text-sm text-muted-foreground italic">{t("terminos_intro_italic")}</p>
        </div>

        <section className="space-y-3">
          <p className="text-foreground">
            {t("terminos_accept_p1")}{" "}
            <a href="/politica-privacidad" className="text-primary hover:underline">
              {t("terminos_accept_privacy_link")}
            </a>
            {t("terminos_accept_p2")}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s1_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s1_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s2_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s2_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s3_title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("terminos_s3_item1")}</li>
            <li>{t("terminos_s3_item2")}</li>
            <li>{t("terminos_s3_item3")}</li>
            <li>{t("terminos_s3_item4")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s4_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s4_body1")}</p>
          <p className="text-muted-foreground">{t("terminos_s4_body2")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s5_title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("terminos_s5_item1")}</li>
            <li>{t("terminos_s5_item2")}</li>
            <li>{t("terminos_s5_item3")}</li>
            <li>{t("terminos_s5_item4")}</li>
            <li>{t("terminos_s5_item5")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s6_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s6_intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("terminos_s6_item1")}</li>
            <li>{t("terminos_s6_item2")}</li>
            <li>{t("terminos_s6_item3")}</li>
            <li>{t("terminos_s6_item4")}</li>
            <li>{t("terminos_s6_item5")}</li>
            <li>{t("terminos_s6_item6")}</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s7_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s7_body1")}</p>
          <p className="text-muted-foreground">{t("terminos_s7_body2")}</p>
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
          <p className="text-muted-foreground">{t("terminos_s10_body1")}</p>
          <p className="text-muted-foreground">{t("terminos_s10_body2")}</p>
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
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">{t("terminos_s15_item1_label")}</strong> {t("terminos_s15_item1_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("terminos_s15_item2_label")}</strong> {t("terminos_s15_item2_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("terminos_s15_item3_label")}</strong> {t("terminos_s15_item3_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("terminos_s15_item4_label")}</strong> {t("terminos_s15_item4_body")}
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s16_title")}</h2>
          <p className="text-muted-foreground">{t("terminos_s16_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("terminos_s17_title")}</h2>
          <p className="text-muted-foreground">
            {t("terminos_s17_body1")}{" "}
            <a href="/contacto" className="text-primary hover:underline">
              /contacto
            </a>{" "}
            {t("terminos_s17_body2")} <span className="text-foreground">GastroMetrics@outlook.com</span>. {t("terminos_s17_body3")}
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
