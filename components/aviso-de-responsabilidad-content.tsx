"use client"

import { MarketingPage } from "@/components/marketing-ui"
import { useLanguage } from "@/contexts/language-context"

export function AvisoDeResponsabilidadContent() {
  const { t } = useLanguage()

  return (
    <MarketingPage>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(60%_60%_at_80%_0%,hsl(var(--primary)/0.08),transparent_70%)]" />

      <div className="relative mx-auto px-4 sm:px-6 pt-12 md:pt-16 pb-20 max-w-3xl space-y-10">
        <div className="space-y-3">
          <h1 className="text-[34px] md:text-5xl font-semibold tracking-[-0.04em] leading-[1.08] text-foreground text-balance">{t("aviso_page_title")}</h1>
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
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_s1_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s1_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_s2_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s2_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_s3_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s3_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_s4_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s4_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_s5_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s5_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_s6_title")}</h2>
          <p className="text-muted-foreground">{t("aviso_s6_body")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl md:text-2xl font-semibold tracking-[-0.02em] text-foreground">{t("aviso_contact_label")}</h2>
          <p className="text-muted-foreground">
            <a href="/contacto" className="text-primary hover:underline">
              /contacto
            </a>{" "}
            · <span className="text-foreground">gastrometrics@outlook.com</span>
          </p>
        </section>
      </div>

    </MarketingPage>
  )
}
