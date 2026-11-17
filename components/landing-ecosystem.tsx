"use client"

/**
 * «Un solo ecosistema» en la página de inicio (pedido del dueño, docs/330): cómo se conectan
 * los módulos —ingredientes → fichas técnicas → compras e inventario → ventas → finanzas—, que
 * cada uno funciona solo y un ejemplo de un cambio que llega a todo. Cada bloque dice desde qué
 * plan está (regla de docs/257) y lleva a su página de características.
 */

import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { GmFinance, GmIngredients, GmInventory, GmSales, GmTechSheet, type GmIcon } from "@/components/icons/gm-icons"
import { Reveal, SectionHeading } from "@/components/marketing-ui"
import { useLanguage } from "@/contexts/language-context"
import type { TranslationKey } from "@/lib/i18n/translations"

const NODES: { n: 1 | 2 | 3 | 4 | 5; icon: GmIcon; href: string }[] = [
  { n: 1, icon: GmIngredients, href: "/caracteristicas/ingredientes-inventario" },
  { n: 2, icon: GmTechSheet, href: "/caracteristicas/fichas-tecnicas" },
  { n: 3, icon: GmInventory, href: "/caracteristicas/ordenes-compra" },
  { n: 4, icon: GmSales, href: "/caracteristicas/ventas-pos" },
  { n: 5, icon: GmFinance, href: "/caracteristicas/finanzas" },
]

export function LandingEcosystem() {
  const { t } = useLanguage()
  const k = (s: string) => t(s as TranslationKey)
  return (
    <section id="ecosistema" className="scroll-mt-24 bg-canvas-alt border-y border-hairline">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-16 md:py-24 space-y-12">
        <SectionHeading kicker={t("eco_kicker")} title={t("eco_title")} subtitle={t("eco_subtitle")} center />

        {/* La cadena: en computadora, en fila con flechas; en el celular, en columna. */}
        <ol className="grid gap-3 lg:grid-cols-5 lg:gap-0">
          {NODES.map(({ n, icon: Icon, href }, i) => (
            <Reveal as="li" key={n} delay={i * 90} className="relative flex lg:pr-6">
              <Link
                href={href}
                className="group flex w-full flex-col gap-3 rounded-2xl border border-hairline bg-card p-5 transition-colors hover:border-primary/50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs tabular-nums text-text-4">{String(n).padStart(2, "0")}</span>
                </span>
                <span className="font-semibold text-foreground leading-snug">{k(`eco_node${n}_title`)}</span>
                <span className="text-sm text-text-3 leading-snug text-pretty">{k(`eco_node${n}_desc`)}</span>
                <span className="mt-auto text-xs font-medium text-primary">{k(`eco_node${n}_plan`)}</span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground group-hover:text-primary">
                  {t("eco_node_more")} <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
              {i < NODES.length - 1 && (
                <ArrowRight aria-hidden="true" className="absolute right-0.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-text-4 lg:block" />
              )}
            </Reveal>
          ))}
        </ol>

        <div className="grid gap-6 lg:grid-cols-2">
          <Reveal className="rounded-2xl border border-hairline bg-card p-6 md:p-8 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{t("eco_alone_title")}</h3>
            <ul className="space-y-3">
              {([1, 2, 3, 4] as const).map((n) => (
                <li key={n} className="flex items-start gap-3 text-sm text-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-pretty">{k(`eco_alone${n}`)}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120} className="rounded-2xl border border-hairline bg-card p-6 md:p-8 space-y-4">
            <h3 className="text-lg font-semibold text-foreground">{t("eco_chain_title")}</h3>
            <ol className="space-y-3">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <li key={n} className="flex items-start gap-3 text-sm text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">{n}</span>
                  <span className="pt-0.5 text-pretty">{k(`eco_chain${n}`)}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
