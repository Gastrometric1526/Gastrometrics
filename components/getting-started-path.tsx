"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Circle, X } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { useIngredients } from "@/lib/storage/ingredients"
import { useModuleReveal } from "@/lib/module-reveal"
import { useActiveMembership } from "@/lib/plan-access"

/**
 * "Tu camino" en el Dashboard (docs/145): los pasos que revelan la app de a poco.
 *   1. Cargar ingredientes (abre la importación; o uno por uno)
 *   2. Importar o crear la primera receta → aparecen Reportes y Ventas
 *   3. Llegar a 3 recetas → aparecen Inventario, Menús, Órdenes de compra y Equipo
 *   4. Abrir uno de los módulos nuevos
 * Desaparece al completar todo o si la persona la cierra. No se muestra a miembros
 * invitados ni en la Vista previa de Equipo.
 */
export function GettingStartedPath() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const { active: previewActive } = useActiveMembership()
  const ingredients = useIngredients()
  const reveal = useModuleReveal({ disabled: previewActive })
  const [dismissed, setDismissed] = useState(true)
  const key = user ? `gm_getting_started_dismissed:${user.id}` : ""

  useEffect(() => {
    if (!key) return
    try {
      setDismissed(localStorage.getItem(key) === "1")
    } catch {
      setDismissed(false)
    }
  }, [key])

  const n = reveal.recipeCount
  const exploredNew = n >= 3 && !reveal.fresh.has("/inventario") && !reveal.fresh.has("/menus")
  const steps = useMemo(
    () => [
      // Los botones abren directo la importación (docs/148): migrar lo que ya tienes es
      // más rápido que escribirlo de nuevo. "Desde cero" queda como alternativa.
      {
        done: ingredients.length > 0,
        title: t("path_step1_title"),
        desc: t("path_step1_desc"),
        href: "/ingredientes?import=1",
        cta: t("path_step1_cta"),
        alt: { href: "/ingredientes", label: t("path_step1_alt") },
      },
      {
        done: n >= 1,
        title: t("path_step2_title"),
        desc: t("path_step2_desc"),
        href: "/mis-recetas?import=1",
        cta: t("path_step2_cta"),
        alt: { href: "/ficha-tecnica", label: t("path_step2_alt") },
      },
      {
        done: n >= 3,
        title: t("path_step3_title").replace("{n}", String(Math.min(n, 3))),
        desc: t("path_step3_desc"),
        href: "/mis-recetas?import=1",
        cta: t("path_step2_cta"),
        alt: { href: "/ficha-tecnica", label: t("path_step2_alt") },
      },
      { done: exploredNew, title: t("path_step4_title"), desc: t("path_step4_desc"), href: "/inventario", cta: t("path_step4_cta"), alt: null },
    ],
    [ingredients.length, n, exploredNew, t],
  )

  if (!reveal.ready || previewActive || dismissed || steps.every((s) => s.done)) return null
  const current = steps.findIndex((s) => !s.done)

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(key, "1")
    } catch {
      /* nada */
    }
  }

  return (
    <section className="rounded-2xl border border-hairline bg-card p-5 space-y-4" aria-label={t("path_title")}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">{t("path_kicker")}</p>
          <h2 className="text-lg font-semibold text-foreground">{t("path_title")}</h2>
        </div>
        <button type="button" onClick={dismiss} className="text-text-4 hover:text-foreground" aria-label={t("path_dismiss")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {steps.map((step, i) => (
          <li
            key={i}
            className={`rounded-xl border p-3 space-y-1.5 ${i === current ? "border-primary bg-primary-soft/40" : "border-hairline"}`}
          >
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-text-4 shrink-0" />
              )}
              {step.title}
            </p>
            <p className="text-xs text-text-3 leading-relaxed">{step.desc}</p>
            {i === current && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link href={step.href} className="inline-block text-xs font-semibold text-primary hover:underline">
                  {step.cta} →
                </Link>
                {step.alt && (
                  <Link href={step.alt.href} className="inline-block text-xs text-text-3 hover:text-primary hover:underline">
                    {step.alt.label}
                  </Link>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
