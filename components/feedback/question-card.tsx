"use client"

/**
 * Pregunta corta (docs/173): tarjeta pequeña abajo a la derecha, no una ventana que tapa
 * la pantalla. Siempre con «Ahora no». Una sola pregunta; al responder, «¡Gracias!» y se va.
 */

import { useState } from "react"
import { MessageCircleQuestion, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { useLanguage } from "@/contexts/language-context"
import type { QuestionDef } from "@/lib/feedback/ask-rules"
import type { TranslationKey } from "@/lib/i18n/translations"

export function QuestionCard({ question, onFinish }: { question: QuestionDef; onFinish: (status: "answered" | "dismissed") => void }) {
  const { t } = useLanguage()
  const [answer, setAnswer] = useState<string>("")
  const [detail, setDetail] = useState("")
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const k = (suffix: string) => `q_${question.key}_${suffix}` as TranslationKey

  const canSend = question.kind === "text" ? detail.trim() !== "" : answer !== ""

  const send = async () => {
    setSending(true)
    try {
      const res = await fetch("/api/feedback/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.key, answer, detail, consent }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
      setTimeout(() => onFinish("answered"), 1800)
    } catch {
      setSending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-label={t(k("title"))}
      data-feedback-card
      className="fixed bottom-[calc(7.75rem+env(safe-area-inset-bottom))] right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg md:bottom-20"
    >
      {done ? (
        <p className="text-sm font-medium text-foreground">{t("feedback_thanks")}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("feedback_card_eyebrow")}</p>
              <p className="text-sm font-medium text-foreground">{t(k("title"))}</p>
            </div>
            <button type="button" aria-label={t("feedback_not_now")} onClick={() => onFinish("dismissed")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {question.kind === "choice" && (
            <div className="flex flex-wrap gap-1.5">
              {question.options!.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={answer === opt}
                  onClick={() => setAnswer(opt)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    answer === opt ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"
                  }`}
                >
                  {t(k(`opt_${opt}`))}
                </button>
              ))}
              {answer === "other" && (
                <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={t("feedback_other_placeholder")} className="mt-1 h-8 text-sm" />
              )}
            </div>
          )}

          {question.kind === "scale" && (
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={answer === String(n)}
                    onClick={() => setAnswer(String(n))}
                    className={`h-8 rounded-md border text-sm font-semibold ${answer === String(n) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>{t(k("low"))}</span>
                <span>{t(k("high"))}</span>
              </div>
            </div>
          )}

          {question.kind === "text" && (
            <div className="space-y-2">
              <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder={t("feedback_text_placeholder")} />
              {question.askConsent && (
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Checkbox checked={consent} disabled={detail.trim() === ""} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                  <span>{t("quick_rating_consent")}</span>
                </label>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onFinish("dismissed")}>
              {t("feedback_not_now")}
            </Button>
            <Button size="sm" onClick={send} disabled={!canSend || sending}>
              {t("feedback_send")}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
