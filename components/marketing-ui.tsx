"use client"

/**
 * Piezas compartidas del sitio público (docs/196): mismo marco, portada, títulos de sección,
 * capturas REALES de la app y bloque de cierre que la landing, para que todas las páginas
 * (Acerca de, Características, Planes, Recursos, Reseñas, Calculadora, Contacto…) se vean
 * como una sola. Movimiento solo con transform/opacity al entrar en pantalla, y nada con
 * «reducir movimiento» (clase gm-anim).
 */

import type React from "react"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { useLanguage } from "@/contexts/language-context"
import { LaptopFrame, mediaLang } from "@/components/landing-showcase"

/**
 * true (una sola vez) cuando el elemento entra en pantalla. Ref de callback: si el elemento se
 * vuelve a montar (p. ej. al cargar el idioma) se observa el nuevo, no el que ya no existe.
 */
export function useInViewOnce<T extends Element>(threshold = 0.25) {
  const [el, setEl] = useState<T | null>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (seen || !el) return
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [el, seen, threshold])
  const ref = useCallback((node: T | null) => setEl(node), [])
  return [ref, seen] as const
}

export const reveal = (seen: boolean, delay = 0) => ({
  className: "gm-anim transition-all duration-700 ease-out " + (seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"),
  style: { transitionDelay: `${delay}ms` } as React.CSSProperties,
})

/** Bloque que aparece (sube y se aclara) al entrar en pantalla. */
export function Reveal({ children, delay = 0, className = "", id, as: Tag = "div" }: { children: React.ReactNode; delay?: number; className?: string; id?: string; as?: "div" | "section" | "li" }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.15)
  const r = reveal(seen, delay)
  return (
    <Tag ref={ref as unknown as React.Ref<never>} id={id} className={`${r.className} ${className}`} style={r.style}>
      {children}
    </Tag>
  )
}

export function SectionHeading({ kicker, title, subtitle, center = false }: { kicker?: string; title: string; subtitle?: string; center?: boolean }) {
  return (
    <div className={"max-w-2xl space-y-3 " + (center ? "mx-auto text-center" : "")}>
      {kicker && <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{kicker}</p>}
      <h2 className="text-3xl md:text-[40px] font-semibold tracking-[-0.038em] text-foreground leading-[1.08] text-balance">{title}</h2>
      {subtitle && <p className="text-text-3 text-pretty">{subtitle}</p>}
    </div>
  )
}

/** Marco de toda página pública: cabecera, pie y el mismo fondo que la landing. */
export function MarketingPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="gm-landing-root min-h-screen flex flex-col bg-background">
      <MarketingHeader />
      <main className="relative flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}

export const PAGE_WIDTH = "max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10"

/** Portada de página: antetítulo, título grande y bajada, con el resplandor naranja de la landing. */
export function PageHero({
  kicker,
  title,
  accent,
  subtitle,
  back,
  center = true,
  children,
}: {
  kicker?: string
  title: string
  /** Parte del título en naranja (va después de `title`). */
  accent?: string
  subtitle?: string
  back?: { href: string; label: string }
  center?: boolean
  children?: React.ReactNode
}) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.05)
  const r = reveal(seen)
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_80%_0%,hsl(var(--primary)/0.10),transparent_70%)]" />
      <div ref={ref} className={`relative ${PAGE_WIDTH} pt-10 md:pt-16 pb-10 md:pb-14`}>
        {back && (
          <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-text-3 hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            {back.label}
          </Link>
        )}
        <div className={`${r.className} space-y-5 ${center ? "text-center max-w-3xl mx-auto" : "max-w-3xl"}`} style={r.style}>
          {kicker && <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">{kicker}</p>}
          <h1 className="text-[36px] leading-[1.06] md:text-5xl xl:text-[56px] font-semibold tracking-[-0.042em] text-foreground text-balance">
            {title}
            {accent && (
              <>
                {" "}
                <span className="text-primary">{accent}</span>
              </>
            )}
          </h1>
          {subtitle && <p className={`text-lg text-text-3 text-pretty ${center ? "max-w-2xl mx-auto" : ""}`}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}

/**
 * Captura REAL de una pantalla de la app (public/landing/{idioma}/desk-*.webp, generada por
 * manual/scripts/landing-media.mjs con un restaurante de ejemplo), dentro del marco de laptop.
 * Al entrar en pantalla se acerca despacio hacia `focus` (en %).
 */
export function RealScreen({ screen, alt, url, focus = [50, 0], zoom = 1.06, className = "" }: { screen: string; alt: string; url: string; focus?: [number, number]; zoom?: number; className?: string }) {
  const { language } = useLanguage()
  const lang = mediaLang(language)
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.2)
  return (
    <div ref={ref} className={className}>
      <LaptopFrame url={url}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/landing/${lang}/desk-${screen}.webp`}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="gm-anim absolute inset-0 h-full w-full object-cover transition-transform duration-[3000ms] ease-out"
          style={{ objectPosition: `${focus[0]}% ${focus[1]}%`, transformOrigin: `${focus[0]}% ${focus[1]}%`, transform: `scale(${seen ? zoom : 1})` }}
        />
      </LaptopFrame>
    </div>
  )
}

/** El PDF real de la Ficha Técnica, como hoja de papel inclinada. */
export function RealPdf({ alt, className = "" }: { alt: string; className?: string }) {
  const { language } = useLanguage()
  const lang = mediaLang(language)
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.2)
  return (
    <div ref={ref} className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/landing/${lang}/pdf-ficha.webp`}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={"gm-anim w-full rounded-md border border-hairline bg-white shadow-[0_30px_60px_-25px_rgba(15,23,42,0.4)] transition-all duration-1000 ease-out " + (seen ? "opacity-100 translate-y-0 rotate-[-1.5deg]" : "opacity-0 translate-y-6")}
      />
    </div>
  )
}

/** Cierre oscuro con un solo llamado a la acción (mismo que el de la landing). */
export function CtaBand({ title, desc, primary, secondary, note }: { title: string; desc?: string; primary: { href: string; label: string }; secondary?: { href: string; label: string }; note?: string }) {
  return (
    <section className="px-4 sm:px-6 md:px-10 py-16 md:py-20">
      <Reveal className="relative max-w-[1200px] mx-auto overflow-hidden rounded-3xl bg-foreground px-6 py-14 md:px-16 md:py-16 text-center">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,hsl(var(--primary)/0.35),transparent_70%)]" />
        <div className="relative space-y-6">
          <h2 className="text-3xl md:text-[42px] font-semibold tracking-[-0.04em] text-background max-w-2xl mx-auto leading-[1.08] text-balance">{title}</h2>
          {desc && <p className="text-background/70 max-w-xl mx-auto">{desc}</p>}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={primary.href}>
              <Button size="lg" className="text-base px-7 py-3 bg-primary text-primary-foreground hover:bg-primary/90">
                {primary.label} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            {secondary && (
              <Link href={secondary.href} className="text-sm text-background/80 hover:text-background inline-flex items-center gap-1">
                {secondary.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          {note && <p className="text-sm text-background/60">{note}</p>}
        </div>
      </Reveal>
    </section>
  )
}
