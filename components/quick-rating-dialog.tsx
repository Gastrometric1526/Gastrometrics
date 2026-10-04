"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/auth-context"
import { useLanguage } from "@/contexts/language-context"
import { TRUSTPILOT_URL } from "@/lib/site-links"
import { countOwnRecipesAllBusinesses } from "@/lib/storage/recipes"

/**
 * Pregunta rápida de satisfacción dentro de la app (docs/145) — antes la única forma de
 * opinar era la encuesta por correo a las 4 horas de uso, y el 75 % de las cuentas no
 * llega a 2 horas: cero opiniones. Ahora se pregunta en el Dashboard en cuanto la persona
 * tiene 3 recetas o usó la app 3 días distintos, lo que pase primero.
 *
 * "¿Qué tan probable es que recomiendes Gastrometrics?" (0–10) + comentario opcional.
 * Se guarda como feedback "experiencia" (`[9/10] comentario`), así aparece en /admin →
 * Reseñas y le llega el correo de aviso al dueño. Con 9 o 10 se invita a dejar la reseña
 * pública en Trustpilot. Se muestra una vez; si la cierra sin responder, se vuelve a
 * ofrecer una sola vez más a los 30 días.
 */

const DAY_MS = 24 * 60 * 60 * 1000
const MIN_RECIPES = 3
const MIN_ACTIVE_DAYS = 3

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento bloqueado: no se pregunta */
  }
}

export function QuickRatingDialog() {
  const { user, userProfile } = useAuth()
  const { t, language } = useLanguage()
  const [open, setOpen] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const stateKey = user ? `gm_quick_rating:${user.id}` : ""

  useEffect(() => {
    if (!user) return
    const daysKey = `gm_active_days:${user.id}`
    const today = new Date().toISOString().slice(0, 10)
    const days = readJson<string[]>(daysKey, [])
    if (!days.includes(today)) writeJson(daysKey, [...days, today].slice(-30))

    const state = readJson<{ status?: "answered" | "dismissed"; at?: number; dismissals?: number }>(stateKey, {})
    if (state.status === "answered") return
    if (state.status === "dismissed" && ((state.dismissals ?? 1) >= 2 || Date.now() - (state.at ?? 0) < 30 * DAY_MS)) return

    let cancelled = false
    const timer = setTimeout(async () => {
      const activeDays = readJson<string[]>(daysKey, []).length
      if (activeDays >= MIN_ACTIVE_DAYS) return setOpen(true)
      // Recetas de todos los negocios, no solo del Dashboard principal.
      const recipeCount = await countOwnRecipesAllBusinesses(user.id).catch(() => null)
      if (!cancelled && (recipeCount ?? 0) >= MIN_RECIPES) setOpen(true)
    }, 4000) // después de que el Dashboard (y sus otros avisos) ya se mostraron
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [user, stateKey])

  const close = (answered: boolean) => {
    if (!answered && !sent) {
      const prev = readJson<{ dismissals?: number }>(stateKey, {})
      writeJson(stateKey, { status: "dismissed", at: Date.now(), dismissals: (prev.dismissals ?? 0) + 1 })
    }
    setOpen(false)
  }

  const submit = async () => {
    if (score === null) return
    setSending(true)
    try {
      await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "experiencia",
          message: `[${score}/10] ${comment.trim() || "—"}`,
          userName: userProfile?.fullName || "",
          userEmail: user?.email || "",
          page: "/dashboard (encuesta rápida)",
          language,
        }),
      })
      writeJson(stateKey, { status: "answered", at: Date.now() })
      setSent(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close(sent)}>
      <DialogContent className="sm:max-w-lg">
        {!sent ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("quick_rating_title")}</DialogTitle>
              <DialogDescription>{t("quick_rating_desc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label={t("quick_rating_title")}>
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={score === n}
                    onClick={() => setScore(n)}
                    className={`h-9 rounded-md border text-sm font-semibold transition-colors ${
                      score === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("quick_rating_low")}</span>
                <span>{t("quick_rating_high")}</span>
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("quick_rating_comment_placeholder")}
                rows={3}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => close(false)}>
                {t("quick_rating_later")}
              </Button>
              <Button onClick={submit} disabled={score === null || sending}>
                {t("quick_rating_send")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t("quick_rating_thanks_title")}</DialogTitle>
              <DialogDescription>
                {score !== null && score >= 9 ? t("quick_rating_thanks_promoter") : t("quick_rating_thanks_desc")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              {score !== null && score >= 9 && (
                <Button variant="outline" asChild>
                  <a href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
                    {t("quick_rating_trustpilot")}
                  </a>
                </Button>
              )}
              <Button onClick={() => close(true)}>{t("quick_rating_close")}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
