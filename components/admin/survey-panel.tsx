"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { useLanguage } from "@/contexts/language-context"
import { MessageCircleQuestion, ListChecks } from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/date-format"
import { QUESTIONS } from "@/lib/feedback/ask-rules"
import type { QuestionSummary, SurveyAnswerRow } from "@/lib/feedback/survey-summary"
import type { TranslationKey } from "@/lib/i18n/translations"
import { useAdminTick } from "@/components/admin/live"
import { AccountLink } from "@/components/admin/account-link"

type AnswerRow = SurveyAnswerRow & { email: string | null }

/**
 * /admin → Buzón → Encuestas (pedido del dueño, docs/213): lo que responde la gente a las
 * preguntas cortas de la app (docs/173). Arriba el resumen por pregunta (antes en Reseñas) y
 * abajo cada respuesta, con quién, cuándo y qué respondió, filtrable por pregunta.
 */
export function SurveyPanel() {
  const { t } = useLanguage()
  const [summary, setSummary] = useState<QuestionSummary[] | null>(null)
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<string>("all")

  // En vivo (docs/192).
  const tick = useAdminTick()
  useEffect(() => {
    fetch("/api/admin/survey-answers")
      .then((res) => res.json())
      .then((json) => {
        setSummary(Array.isArray(json.summary) ? json.summary : [])
        setAnswers(Array.isArray(json.answers) ? json.answers : [])
        setTotal(typeof json.total === "number" ? json.total : 0)
      })
      .catch(() => setSummary([]))
  }, [tick])

  const optionLabel = (question: string, option: string) => t(`q_${question}_opt_${option}` as TranslationKey)
  const questionTitle = (question: string) => t(`q_${question}_title` as TranslationKey)
  const answerText = (a: AnswerRow) => {
    const kind = QUESTIONS.find((q) => q.key === a.question)?.kind
    if (!a.answer) return null
    if (kind === "choice") return optionLabel(a.question, a.answer)
    if (kind === "scale") return t("admin_survey_scale_value").replace("{n}", a.answer)
    return a.answer
  }

  const answered = (summary ?? []).filter((q) => q.total > 0)
  const shown = filter === "all" ? answers : answers.filter((a) => a.question === filter)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="h-5 w-5 text-primary" />
            {t("admin_survey_title")}
          </CardTitle>
          <CardDescription>{t("admin_survey_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary === null ? (
            <Skeleton className="h-24 w-full" />
          ) : answered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin_survey_empty")}</p>
          ) : (
            answered.map((q) => (
              <div key={q.question} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{questionTitle(q.question)}</p>
                  <span className="text-xs text-muted-foreground">{t("admin_survey_answers").replace("{n}", String(q.total))}</span>
                </div>
                {Object.keys(q.counts).length > 0 && (
                  <ul className="space-y-1">
                    {Object.entries(q.counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([opt, n]) => (
                        <li key={opt} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-2 text-sm">
                          <span className="truncate">{optionLabel(q.question, opt)}</span>
                          <span className="h-2 rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(n / q.total) * 100}%` }} />
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">{n}</span>
                        </li>
                      ))}
                  </ul>
                )}
                {q.average !== null && <p className="text-sm text-foreground">{t("admin_survey_average").replace("{avg}", String(q.average))}</p>}
                {q.texts.length > 0 && (
                  <ul className="space-y-1 border-l border-border pl-3">
                    {q.texts.map((x, i) => (
                      <li key={i} className="text-sm text-foreground">
                        “{x.text}” <span className="text-xs text-muted-foreground">— <AccountLink userId={x.userId}>{x.userName}</AccountLink> · {formatDate(x.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {t("admin_survey_all_title")}
            </CardTitle>
            <CardDescription>
              {t("admin_survey_all_desc").replace("{shown}", String(answers.length)).replace("{total}", String(total))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
                {t("admin_survey_filter_all")}
              </Button>
              {answered.map((q) => (
                <Button key={q.question} size="sm" variant={filter === q.question ? "default" : "outline"} onClick={() => setFilter(q.question)}>
                  {questionTitle(q.question)} ({q.total})
                </Button>
              ))}
            </div>
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin_survey_col_date")}</TableHead>
                    <TableHead>{t("admin_survey_col_person")}</TableHead>
                    <TableHead>{t("admin_survey_col_question")}</TableHead>
                    <TableHead>{t("admin_survey_col_answer")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((a, i) => (
                    <TableRow key={`${a.userId}-${a.at}-${i}`}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.at)}</TableCell>
                      <TableCell>
                        <AccountLink userId={a.userId} email={a.email} className="block text-foreground">{a.userName || a.email || "—"}</AccountLink>
                        {a.email && a.email !== a.userName && <div className="text-xs text-muted-foreground">{a.email}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{questionTitle(a.question)}</TableCell>
                      <TableCell className="max-w-md">
                        {answerText(a) && <div className="text-foreground">{answerText(a)}</div>}
                        {a.detail && <div className="text-sm text-foreground whitespace-pre-wrap">“{a.detail}”</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
