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
          <p className="text-sm text-muted-foreground italic">{t("privacidad_intro_italic")}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_summary_title")}</h2>
          <p className="text-foreground">{t("privacidad_summary_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s1_title")}</h2>
          <p className="text-muted-foreground">{t("privacidad_s1_body1")}</p>
          <p className="text-muted-foreground">{t("privacidad_s1_body2")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s2_title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">{t("privacidad_s2_item1_label")}</strong> {t("privacidad_s2_item1_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("privacidad_s2_item2_label")}</strong> {t("privacidad_s2_item2_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("privacidad_s2_item3_label")}</strong> {t("privacidad_s2_item3_body1")}{" "}
              <strong className="text-foreground">{t("privacidad_s2_item3_bold")}</strong> {t("privacidad_s2_item3_body2")}
            </li>
            <li>
              <strong className="text-foreground">{t("privacidad_s2_item4_label")}</strong> {t("privacidad_s2_item4_body")}
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s3_title")}</h2>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("privacidad_s3_item1")}</li>
            <li>{t("privacidad_s3_item2")}</li>
            <li>{t("privacidad_s3_item3")}</li>
          </ul>
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
          <p className="text-muted-foreground">{t("privacidad_s10_intro")}</p>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>{t("privacidad_s10_right1")}</li>
            <li>{t("privacidad_s10_right2")}</li>
            <li>{t("privacidad_s10_right3")}</li>
            <li>{t("privacidad_s10_right4")}</li>
            <li>{t("privacidad_s10_right5")}</li>
            <li>{t("privacidad_s10_right6")}</li>
            <li>{t("privacidad_s10_right7")}</li>
          </ul>
          <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
            <li>
              <strong className="text-foreground">{t("privacidad_s10_gdpr_label")}</strong> {t("privacidad_s10_gdpr_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("privacidad_s10_ccpa_label")}</strong> {t("privacidad_s10_ccpa_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("privacidad_s10_lgpd_label")}</strong> {t("privacidad_s10_lgpd_and")}{" "}
              <strong className="text-foreground">{t("privacidad_s10_pipeda_label")}</strong> {t("privacidad_s10_lgpd_body")}
            </li>
            <li>
              <strong className="text-foreground">{t("privacidad_s10_ca_label")}</strong> {t("privacidad_s10_ca_body")}
            </li>
          </ul>
          <p className="text-muted-foreground">{t("privacidad_s10_closing")}</p>
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
          <h2 className="text-2xl font-semibold text-foreground">{t("privacidad_s13_title")}</h2>
          <p className="text-muted-foreground">
            {t("privacidad_s13_body1")}{" "}
            <a href="/contacto" className="text-primary hover:underline">
              /contacto
            </a>{" "}
            {t("privacidad_s13_body2")} <span className="text-foreground">GastroMetrics@outlook.com</span>. {t("privacidad_s13_body3")}
          </p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
