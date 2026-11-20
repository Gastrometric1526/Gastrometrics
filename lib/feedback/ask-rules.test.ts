import { describe, it, expect } from "vitest"
import translations from "../i18n/translations"
import { QUESTIONS, emptyAskState, nextQuestion, ratingDue, recordAsk, recordMoment, ratingBand, referralInviteDue, ASK_COOLDOWN_MS, REFERRAL_INVITE_ACTIVE_SECONDS, REFERRAL_INVITE_RETRY_MS, type AskContext } from "./ask-rules"
import { parseReviewMessage, buildReviewMessage, reviewerDisplayName, scoreToStars } from "../reviews"
import { summarizeSurveyAnswers } from "./survey-summary"

const DAY = 86_400_000
const now = new Date("2026-10-21T15:00:00Z").getTime()
// Las pruebas de antes de docs/342 parten con la pregunta abierta ya respondida.
const seenOpen = () => recordAsk(emptyAskState(), "open_feedback", "answered", now - 30 * DAY)

const ctx = (over: Partial<AskContext> = {}): AskContext => ({
  now,
  accountCreatedAt: new Date(now - 10 * DAY).toISOString(),
  activeDays: 1,
  recipeCount: 1,
  planExpiringSoon: false,
  onboardingDone: true,
  ...over,
})

describe("cuándo pedir la calificación (docs/173)", () => {
  it("en un momento de valor, no solo por tiempo", () => {
    expect(ratingDue(emptyAskState(), ctx())).toBe(false)
    expect(ratingDue(recordMoment(emptyAskState(), "first_pdf", now), ctx())).toBe(true)
    expect(ratingDue(emptyAskState(), ctx({ activeDays: 7 }))).toBe(true)
    expect(ratingDue(emptyAskState(), ctx({ recipeCount: 3 }))).toBe(true)
  })

  it("respondida no vuelve; cerrada se ofrece una vez más a los 30 días", () => {
    const base = recordMoment(emptyAskState(), "first_priced_recipe", now)
    expect(ratingDue(recordAsk(base, "rating", "answered", now - 60 * DAY), ctx())).toBe(false)
    const dismissed = recordAsk(base, "rating", "dismissed", now - 31 * DAY)
    expect(ratingDue(dismissed, ctx())).toBe(true)
    expect(ratingDue(recordAsk(dismissed, "rating", "dismissed", now - 31 * DAY), ctx())).toBe(false) // ya se mostró 2 veces
  })

  it("como mucho una pregunta cada 5 días", () => {
    const s = recordAsk(recordMoment(emptyAskState(), "first_pdf", now), "pain", "answered", now - ASK_COOLDOWN_MS + DAY)
    expect(ratingDue(s, ctx())).toBe(false)
    expect(nextQuestion(s, ctx({ planExpiringSoon: true }))).toBeNull()
  })
})

describe("preguntas cortas", () => {
  it("la de mayor prioridad primero", () => {
    const s = recordMoment(recordMoment(seenOpen(), "first_ingredient", now), "first_ocr", now)
    expect(nextQuestion(s, ctx())?.key).toBe("ocr_accuracy")
    expect(nextQuestion(s, ctx({ planExpiringSoon: true }))?.key).toBe("improve")
  })

  it("cada una con su condición", () => {
    expect(nextQuestion(seenOpen(), ctx({ recipeCount: 0 }))?.key).toBe("blocker")
    expect(nextQuestion(seenOpen(), ctx({ accountCreatedAt: new Date(now - DAY).toISOString(), recipeCount: 0 }))?.key).toBe("pain")
    expect(nextQuestion(seenOpen(), ctx({ recipeCount: 6 }))?.key).toBe("team")
    expect(nextQuestion(seenOpen(), ctx({ activeDays: 14 }))?.key).toBe("testimonial")
    expect(nextQuestion(seenOpen(), ctx())).toBeNull()
  })

  it("las de docs/230: una por momento de valor y dos generales al final", () => {
    const one = (m: Parameters<typeof recordMoment>[1]) => nextQuestion(recordMoment(seenOpen(), m, now), ctx())?.key
    expect(one("first_priced_recipe")).toBe("price_reaction")
    expect(one("first_pdf")).toBe("pdf_use")
    expect(one("cascade_recalc")).toBe("price_changes")
    expect(one("first_inventory_count")).toBe("inventory_freq")
    expect(one("first_purchase_order")).toBe("order_channel")
    expect(one("first_sales_import")).toBe("pos_system")
    expect(one("first_menu")).toBe("menu_purpose")
    expect(nextQuestion(seenOpen(), ctx({ activeDays: 2 }))?.key).toBe("found_us")
    expect(nextQuestion(seenOpen(), ctx({ activeDays: 3 }))?.key).toBe("previous_tool")
    // el plan original va antes que las nuevas
    expect(nextQuestion(recordMoment(seenOpen(), "first_pdf", now), ctx({ activeDays: 14 }))?.key).toBe("pdf_use")
    expect(nextQuestion(seenOpen(), ctx({ activeDays: 14 }))?.key).toBe("testimonial")
  })

  it("cada pregunta tiene título y opciones traducidos en los 6 idiomas", () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      const dict = translations[lang] as Record<string, string>
      for (const q of QUESTIONS) {
        expect(dict[`q_${q.key}_title`], `${lang} q_${q.key}_title`).toBeTruthy()
        for (const o of q.options ?? []) expect(dict[`q_${q.key}_opt_${o}`], `${lang} q_${q.key}_opt_${o}`).toBeTruthy()
      }
    }
  })

  it("respondida no se repite", () => {
    const s = recordAsk(seenOpen(), "team", "answered", now - 30 * DAY)
    expect(nextQuestion(s, ctx({ recipeCount: 6 }))).toBeNull()
  })

  it("seguimiento según la nota", () => {
    expect(ratingBand(6)).toBe("low")
    expect(ratingBand(7)).toBe("mid")
    expect(ratingBand(8)).toBe("mid")
    expect(ratingBand(9)).toBe("high")
  })
})

describe("reseñas", () => {
  it("lee y arma el mensaje", () => {
    expect(parseReviewMessage("[9/10][publicable] Me ahorra horas")).toEqual({ score: 9, publishable: true, testimonial: false, comment: "Me ahorra horas" })
    expect(parseReviewMessage("[10/10] —")).toEqual({ score: 10, publishable: false, testimonial: false, comment: "" })
    expect(parseReviewMessage("[testimonio][publicable] Todo en un lugar").testimonial).toBe(true)
    expect(buildReviewMessage({ score: 8, publishable: true, comment: "Bien" })).toBe("[8/10][publicable] Bien")
    expect(buildReviewMessage({ testimonial: true, publishable: false, comment: "" })).toBe("[testimonio] —")
  })

  it("nombre corto y estrellas", () => {
    expect(reviewerDisplayName("Daniel Romero Rivera")).toBe("Daniel R.")
    expect(reviewerDisplayName("Ana")).toBe("Ana")
    expect(scoreToStars(9)).toBe(4.5)
  })
})


describe("resumen de respuestas", () => {
  it("cuenta opciones, promedia escalas y junta textos", () => {
    const rows = [
      { userId: "a", userName: "A", question: "team", answer: "solo", detail: null, at: "2026-10-20" },
      { userId: "b", userName: "B", question: "team", answer: "solo", detail: null, at: "2026-10-21" },
      { userId: "c", userName: "C", question: "ocr_accuracy", answer: "4", detail: null, at: "2026-10-21" },
      { userId: "d", userName: "D", question: "ocr_accuracy", answer: "5", detail: null, at: "2026-10-21" },
      { userId: "e", userName: "E", question: "improve", answer: null, detail: "Más reportes", at: "2026-10-21" },
    ]
    const s = summarizeSurveyAnswers(rows)
    expect(s.find((x) => x.question === "team")?.counts).toEqual({ solo: 2 })
    expect(s.find((x) => x.question === "ocr_accuracy")?.average).toBe(4.5)
    expect(s.find((x) => x.question === "improve")?.texts[0].text).toBe("Más reportes")
  })
})

describe("opinión a lo largo de los meses (docs/265)", () => {
  it("la calificación respondida no se vuelve a pedir, ni pasados meses", async () => {
    const base = recordMoment(seenOpen(), "first_priced_recipe", now)
    expect(ratingDue(recordAsk(base, "rating", "answered", now - 200 * DAY), ctx())).toBe(false)
  })

  it("invita a la reseña pública cuando ya respondió varias y no queda ninguna, igual para todos", async () => {
    const { reviewInviteDue } = await import("./ask-rules")
    let s = seenOpen()
    const old = now - 30 * DAY
    for (const key of ["pain", "menu_size", "price_source", "team", "previous_tool", "found_us", "testimonial"] as const) s = recordAsk(s, key, "answered", old)
    // Sin preguntas pendientes que apliquen (contexto sin momentos ni condiciones nuevas).
    const c = ctx({ activeDays: 30, recipeCount: 6, accountCreatedAt: new Date(now - 60 * DAY).toISOString() })
    expect(reviewInviteDue(s, c)).toBe(true)
    // No depende de la nota: con una calificación baja también se invita (docs/173).
    expect(reviewInviteDue(recordAsk(s, "rating", "answered", old), c)).toBe(true)
    // Respetando la pausa de 5 días.
    expect(reviewInviteDue({ ...s, lastAskAt: now - DAY }, c)).toBe(false)
    // Cerrada: otra vez a los 60 días, como mucho 2 veces.
    const once = recordAsk(s, "review", "dismissed", now - 61 * DAY)
    expect(reviewInviteDue(once, c)).toBe(true)
    const twice = recordAsk(once, "review", "dismissed", now - 61 * DAY)
    expect(reviewInviteDue(twice, c)).toBe(false)
  })

  it("no invita antes de 5 respuestas", async () => {
    const { reviewInviteDue } = await import("./ask-rules")
    const s = recordAsk(seenOpen(), "pain", "answered", now - 30 * DAY)
    expect(reviewInviteDue(s, ctx({ activeDays: 30 }))).toBe(false)
  })
})

describe("invitación a invitar a un colega (docs/337)", () => {
  const hours3 = REFERRAL_INVITE_ACTIVE_SECONDS
  it("sale a las 3 horas de uso real, no antes", () => {
    expect(referralInviteDue(emptyAskState(), ctx({ activeSeconds: hours3 - 60 }))).toBe(false)
    expect(referralInviteDue(emptyAskState(), ctx({ activeSeconds: hours3 }))).toBe(true)
    expect(referralInviteDue(emptyAskState(), ctx({ activeSeconds: null }))).toBe(false)
  })
  it("respeta la pausa de 5 días con las preguntas", () => {
    const asked = recordAsk(emptyAskState(), "found_us", "answered", now - 60_000)
    expect(referralInviteDue(asked, ctx({ activeSeconds: hours3 }))).toBe(false)
  })
  it("«Ahora no» vuelve a los 30 días, como mucho 3 veces; «Invitar» la termina", () => {
    let s = recordAsk(emptyAskState(), "referral", "dismissed", now)
    expect(referralInviteDue(s, ctx({ now: now + REFERRAL_INVITE_RETRY_MS - 1, activeSeconds: hours3 }))).toBe(false)
    expect(referralInviteDue(s, ctx({ now: now + REFERRAL_INVITE_RETRY_MS, activeSeconds: hours3 }))).toBe(true)
    s = recordAsk(recordAsk(s, "referral", "dismissed", now), "referral", "dismissed", now)
    expect(referralInviteDue(s, ctx({ now: now + 10 * REFERRAL_INVITE_RETRY_MS, activeSeconds: hours3 }))).toBe(false)
    const went = recordAsk(emptyAskState(), "referral", "answered", now)
    expect(referralInviteDue(went, ctx({ now: now + 10 * REFERRAL_INVITE_RETRY_MS, activeSeconds: hours3 }))).toBe(false)
  })
})

describe("pregunta abierta para todas las cuentas (docs/342)", () => {
  it("es la primera que sale a una cuenta que ya usó la app, con campo de texto y ayuda propia", () => {
    const q = nextQuestion(emptyAskState(), ctx({ activeDays: 3 }))
    expect(q?.key).toBe("open_feedback")
    expect(q?.kind).toBe("text")
    expect(translations.es.q_open_feedback_placeholder).toBeTruthy()
  })
  it("también a una cuenta antigua en un aparato nuevo; no el primer día de una cuenta nueva", () => {
    expect(nextQuestion(emptyAskState(), ctx({ activeDays: 1, accountCreatedAt: new Date(now - 30 * DAY).toISOString() }))?.key).toBe("open_feedback")
    expect(nextQuestion(emptyAskState(), ctx({ activeDays: 1, accountCreatedAt: new Date(now - DAY / 2).toISOString() }))?.key).not.toBe("open_feedback")
  })
  it("respeta la pausa de 5 días y no se repite si ya respondió", () => {
    const answered = recordAsk(emptyAskState(), "open_feedback", "answered", now - 6 * DAY)
    expect(nextQuestion(answered, ctx({ activeDays: 3 }))?.key).not.toBe("open_feedback")
    const recent = recordAsk(emptyAskState(), "found_us", "answered", now - DAY)
    expect(nextQuestion(recent, ctx({ activeDays: 3 }))).toBeNull()
  })
})
