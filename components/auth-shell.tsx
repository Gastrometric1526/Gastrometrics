"use client"

/**
 * Marco de las pantallas de cuenta antes de entrar (iniciar sesión, registro, pago, recuperar y
 * nueva contraseña), docs/198: mismo resplandor y tipografía que el sitio público y, en
 * computadora, un panel al lado con la app REAL en movimiento (capturas del idioma de la página
 * que se alternan) y lo esencial de la oferta. En celular solo el formulario. No toca la lógica
 * de cada formulario: solo lo envuelve.
 */

import type React from "react"
import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { LaptopFrame, mediaLang } from "@/components/landing-showcase"

const SCREENS = [
  { id: "ficha", url: "gastrometrics.org/ficha-tecnica" },
  { id: "precio", url: "gastrometrics.org/ficha-tecnica" },
  { id: "reportes", url: "gastrometrics.org/estadisticas" },
  { id: "inventario", url: "gastrometrics.org/inventario" },
]
const STEP_MS = 4200

function Showcase() {
  const { t, language } = useLanguage()
  const lang = mediaLang(language)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = window.setInterval(() => setI((n) => (n + 1) % SCREENS.length), STEP_MS)
    return () => window.clearInterval(id)
  }, [])
  const points = [t("landing_hero_micro_free"), t("landing_hero_micro_nocard"), t("landing_hero_micro_langs"), t("landing_hero_micro_app")]
  return (
    <div className="relative h-full overflow-hidden bg-canvas-alt border-l border-hairline">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_10%,hsl(var(--primary)/0.14),transparent_70%)]" />
      <div className="relative flex h-full flex-col justify-center gap-10 px-10 xl:px-16 py-12">
        <h2 className="text-3xl xl:text-[40px] font-semibold tracking-[-0.04em] leading-[1.08] text-balance">
          <span className="text-foreground">{t("landing_hero_title_line1")}</span> <span className="text-primary">{t("landing_hero_title_line2")}</span>
        </h2>
        <LaptopFrame url={SCREENS[i].url}>
          {SCREENS.map((s, n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={`/landing/${lang}/desk-${s.id}.webp`}
              alt=""
              decoding="async"
              loading={n === 0 ? "eager" : "lazy"}
              className={"gm-anim absolute inset-0 h-full w-full object-cover object-top transition-all duration-1000 ease-out " + (n === i ? "opacity-100 scale-100" : "opacity-0 scale-[1.03]")}
            />
          ))}
        </LaptopFrame>
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {SCREENS.map((s, n) => (
            <span key={s.id} className={"h-1.5 rounded-full transition-all duration-500 " + (n === i ? "w-6 bg-primary" : "w-1.5 bg-hairline")} />
          ))}
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-3">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-text-3">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * `wide` = formulario ancho: «xl» (registro, 672 px) muestra el panel desde 1280 px; «2xl»
 * (pago, 768 px) desde 1536 px. Sin `wide`, desde 1024 px.
 */
const GRID = { none: "lg:grid-cols-2", xl: "xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]", "2xl": "2xl:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]" }
const ASIDE = { none: "lg:block", xl: "xl:block", "2xl": "2xl:block" }

export function AuthShell({ children, wide }: { children: React.ReactNode; wide?: "xl" | "2xl" }) {
  const w = wide ?? "none"
  return (
    <div className={`gm-landing-root min-h-screen bg-background grid ${GRID[w]}`}>
      <div className="relative flex items-center justify-center p-4 py-10 overflow-hidden">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[360px] bg-[radial-gradient(60%_60%_at_30%_0%,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="relative w-full flex justify-center">{children}</div>
      </div>
      <div className={`hidden ${ASIDE[w]} lg:sticky lg:top-0 lg:h-screen`}>
        <Showcase />
      </div>
    </div>
  )
}
