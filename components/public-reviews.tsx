"use client"

/**
 * Opiniones reales de chefs (docs/173), en la página principal, en Planes, en el Dashboard y
 * en /resenas. Solo las que la persona permitió mostrar y el dueño publicó en /admin.
 *
 * Con menos de MIN_PUBLISHED_REVIEWS (3) no se muestra nada (o el `fallback`): un bloque de
 * opiniones con una sola resta confianza en vez de sumarla. Las estrellas son el promedio
 * real de las notas publicadas (0–10 → 0–5), nunca un adorno.
 */

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Star, Quote, ArrowRight } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { TRUSTPILOT_URL, GOOGLE_REVIEW_URL } from "@/lib/site-links"
import { MIN_PUBLISHED_REVIEWS, scoreToStars, type PublicReview } from "@/lib/reviews"
import { BUSINESS_TYPES } from "@/lib/types/user"
import { getDateLocale, type TranslationKey } from "@/lib/i18n/translations"

let cache: PublicReview[] | null = null
let inflight: Promise<PublicReview[]> | null = null

function loadReviews(): Promise<PublicReview[]> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch("/api/reviews")
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((j) => (cache = Array.isArray(j.reviews) ? j.reviews : []))
      .catch(() => [])
  }
  return inflight
}

export function usePublicReviews(): PublicReview[] | null {
  const [reviews, setReviews] = useState<PublicReview[] | null>(cache)
  useEffect(() => {
    let alive = true
    loadReviews().then((r) => alive && setReviews(r))
    return () => {
      alive = false
    }
  }, [])
  return reviews
}

function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="flex text-primary" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${className} ${value >= i - 0.25 ? "fill-current" : value >= i - 0.75 ? "fill-current opacity-50" : "opacity-30"}`} />
      ))}
    </span>
  )
}

export function PublicReviews({
  variant,
  max,
  filterable = false,
  fallback = null,
  wrapperClassName,
}: {
  variant: "landing" | "planes" | "dashboard" | "page"
  max?: number
  /** Planes: filtro por tipo de negocio (restaurante, chef personal, catering…). */
  filterable?: boolean
  fallback?: React.ReactNode
  /** Márgenes del contenedor (solo se aplican si hay opiniones que mostrar). */
  wrapperClassName?: string
}) {
  const { t, language } = useLanguage()
  const reviews = usePublicReviews()
  const [type, setType] = useState<string>("all")

  const types = useMemo(() => [...new Set((reviews ?? []).map((r) => r.businessType).filter((x): x is string => Boolean(x)))], [reviews])
  if (!reviews || reviews.length < MIN_PUBLISHED_REVIEWS) return <>{fallback}</>

  const scored = reviews.filter((r) => typeof r.score === "number")
  const avg = scored.length ? scored.reduce((s, r) => s + scoreToStars(r.score!), 0) / scored.length : null
  const shown = (type === "all" ? reviews : reviews.filter((r) => r.businessType === type)).slice(0, max ?? reviews.length)
  const typeLabel = (v: string | null) => {
    const hit = BUSINESS_TYPES.find((b) => b.value === v)
    return hit ? t(hit.labelKey as TranslationKey) : null
  }
  const countryName = (code: string | null) => {
    if (!code) return null
    try {
      return new Intl.DisplayNames([getDateLocale(language)], { type: "region" }).of(code) || code
    } catch {
      return code
    }
  }
  const compact = variant === "dashboard"

  return (
    <section className={`${compact ? "space-y-3" : "space-y-6"} ${wrapperClassName ?? ""}`} data-tour="public-reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className={compact ? "text-base font-semibold text-foreground" : "text-2xl md:text-3xl font-semibold tracking-tight text-foreground"}>
            {t("reviews_heading")}
          </h2>
          {avg !== null && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Stars value={avg} />
              {t("reviews_average").replace("{avg}", avg.toFixed(1)).replace("{count}", String(reviews.length))}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {variant !== "page" && (
            <Link href="/resenas" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {t("reviews_see_all")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
          <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {t("reviews_trustpilot")} <ArrowRight className="h-3.5 w-3.5" />
          </a>
          {GOOGLE_REVIEW_URL && (
            <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {t("reviews_google")} <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {filterable && types.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {["all", ...types].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={type === v}
              onClick={() => setType(v)}
              className={`rounded-full border px-3 py-1 text-xs ${type === v ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}
            >
              {v === "all" ? t("reviews_filter_all") : typeLabel(v)}
            </button>
          ))}
        </div>
      )}

      <div className={compact ? "space-y-2" : "grid grid-cols-1 gap-4 md:grid-cols-3"}>
        {shown.map((r) => (
          <figure key={r.id} className={`rounded-xl border border-border bg-card ${compact ? "p-3" : "p-5"} space-y-3`}>
            {typeof r.score === "number" && <Stars value={scoreToStars(r.score)} className="h-3.5 w-3.5" />}
            <blockquote className={`${compact ? "text-sm" : "text-base"} text-foreground leading-relaxed`}>
              {!compact && <Quote className="mb-1 h-4 w-4 text-primary" />}“{r.comment}”
            </blockquote>
            <figcaption className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{r.name}</span>
              {[typeLabel(r.businessType), countryName(r.country)].filter(Boolean).map((x) => ` · ${x}`)}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
