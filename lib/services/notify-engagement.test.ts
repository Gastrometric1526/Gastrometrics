import { describe, it, expect } from "vitest"
import {
  chooseEngagement,
  renderEngagementEmail,
  pickEngagementVariant,
  recipeTargetFoodCost,
  marginIssueFor,
  type EngagementFacts,
  type EngagementDecision,
} from "./notify-engagement"
import { ENGAGEMENT_TYPES, ENGAGEMENT_COPY, ENGAGEMENT_SHARED } from "@/lib/i18n/engagement-email-copy"
import { ACTIVATION_VARIANTS } from "@/lib/i18n/activation-email-variants"
import { activationVariantFor } from "./notify-activation"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.UTC(2026, 9, 6, 15) // martes 6 oct 2026

function facts(over: Partial<EngagementFacts> = {}): EngagementFacts {
  return {
    now: NOW,
    accountCreatedAt: NOW - 60 * DAY,
    lastActiveAt: NOW - 2 * DAY,
    isMonday: false,
    planSlug: "foodie",
    recipeCount: 0,
    recipeCreatedTimes: [],
    avgFoodCostPct: null,
    marginIssues: [],
    lowStock: [],
    inventoryValue: 0,
    currencySymbol: "L",
    firstMenuAt: null,
    firstCountAt: null,
    usedModules: new Set(),
    pendingInvites: [],
    emptyBusinesses: [],
    history: [],
    otherSentTimes: [],
    ...over,
  }
}

const low = [{ name: "Harina", current: 2, min: 10, unit: "kg" }]

describe("chooseEngagement (docs/144)", () => {
  it("sin datos reales no manda nada", () => {
    expect(chooseEngagement(facts(), "es")).toBeNull()
  })

  it("stock bajo: lista los productos y respeta su pausa de 3 días", () => {
    const d = chooseEngagement(facts({ lowStock: low }), "es")!
    expect(d.type).toBe("low_stock")
    expect(d.items?.[0]).toContain("Harina")
    expect(chooseEngagement(facts({ lowStock: low, history: [{ type: "low_stock", ref: "low", sentAt: NOW - 2 * DAY }] }), "es")).toBeNull()
  })

  it("nunca dos correos en menos de 20 h, aunque sea urgente", () => {
    expect(chooseEngagement(facts({ lowStock: low, otherSentTimes: [NOW - 5 * 60 * 60 * 1000] }), "es")).toBeNull()
  })

  it("resumen semanal solo los lunes y con recetas; puede salir dentro de la pausa global", () => {
    const base = { recipeCount: 3, recipeCreatedTimes: [NOW - 90 * DAY, NOW - 80 * DAY, NOW - 70 * DAY], avgFoodCostPct: 31.25 }
    expect(chooseEngagement(facts(base), "es")).toBeNull()
    const d = chooseEngagement(facts({ ...base, isMonday: true, otherSentTimes: [NOW - 2 * DAY] }), "es")!
    expect(d.type).toBe("weekly_summary")
    expect(d.weekly?.foodCost).toBe("31.3 %")
  })

  it("margen, logros, invitación, negocio vacío y función sin usar respetan la pausa global de 4 días", () => {
    const issues = [{ name: "Lomo", actualPct: 45, targetPct: 30, belowCost: false }]
    expect(chooseEngagement(facts({ marginIssues: issues, otherSentTimes: [NOW - 2 * DAY] }), "es")).toBeNull()
    expect(chooseEngagement(facts({ marginIssues: issues }), "es")?.type).toBe("margin_alert")
  })

  it("logro: solo si es reciente, el mayor primero, y marca los anteriores", () => {
    const times = Array.from({ length: 26 }, (_, i) => NOW - (40 - i) * DAY) // la 25.ª hace 16 días
    const d = chooseEngagement(facts({ recipeCount: 26, recipeCreatedTimes: times }), "es")!
    expect(d.type).toBe("milestone")
    expect(d.ref).toBe("recipes_25")
    expect(d.markRefs).toContain("recipes_10")
    expect(d.vars.milestone).toBe(ENGAGEMENT_SHARED.es.milestones.recipes_25)
    // Logro viejo (la 10.ª hace 31 días): no se celebra tarde.
    const old = Array.from({ length: 10 }, (_, i) => NOW - (45 - i) * DAY)
    expect(chooseEngagement(facts({ recipeCount: 10, recipeCreatedTimes: old }), "es")).toBeNull()
  })

  it("invitación sin aceptar entre 3 y 30 días, una vez por persona", () => {
    const inv = { id: "t1", label: "María (maria@x.com)", invitedAt: NOW - 5 * DAY }
    const d = chooseEngagement(facts({ pendingInvites: [inv] }), "es")!
    expect(d).toMatchObject({ type: "invite_pending", ref: "t1", vars: { days: "5" } })
    expect(chooseEngagement(facts({ pendingInvites: [inv], history: [{ type: "invite_pending", ref: "t1", sentAt: NOW - 30 * DAY }] }), "es")).toBeNull()
    expect(chooseEngagement(facts({ pendingInvites: [{ ...inv, invitedAt: NOW - DAY }] }), "es")).toBeNull()
  })

  it("negocio vacío entre 5 y 60 días", () => {
    const d = chooseEngagement(facts({ emptyBusinesses: [{ id: "b1", name: "Tacos & Co", createdAt: NOW - 7 * DAY }] }), "es")!
    expect(d.type).toBe("empty_business")
    expect(d.vars.business).toBe("Tacos &amp; Co")
    expect(d.actionPath).toBe("/business/b1")
  })

  it("función sin usar: solo planes pagos, la primera función del plan que nunca se abrió", () => {
    expect(chooseEngagement(facts({ planSlug: "foodie" }), "es")).toBeNull()
    const d = chooseEngagement(facts({ planSlug: "chef-de-partie", usedModules: new Set(["inventario"]) }), "es")!
    expect(d).toMatchObject({ type: "unused_feature", ref: "menus", vars: { feature: "Menús", plan: "Chef de Partie" } })
    // Cuenta nueva (< 14 días): todavía no.
    expect(chooseEngagement(facts({ planSlug: "chef-de-partie", accountCreatedAt: NOW - 5 * DAY }), "es")).toBeNull()
  })

  it("cuentas inactivas más de 120 días no reciben nada", () => {
    expect(chooseEngagement(facts({ lowStock: low, lastActiveAt: NOW - 130 * DAY }), "es")).toBeNull()
  })
})

describe("margen de una receta (docs/144)", () => {
  it("con los rubros por defecto la meta es ~48.8 % (no avisa de platos bien costeados)", () => {
    expect(recipeTargetFoodCost({ method: null, target: null, ps: null, mk: null, op: null, lb: null, isv: null, cm: null })).toBeCloseTo(48.78, 1)
    const row = { owner_id: "o", business_id: null, name: "Pollo", created_at: "", is_sub_recipe: false, unit_price: 45, cost: 20, method: null, target: null, ps: null, mk: null, op: null, lb: null, isv: null, cm: null }
    expect(marginIssueFor(row)).toBeNull() // 44 % < 48.8 + 5
    expect(marginIssueFor({ ...row, cost: 30 })).toMatchObject({ belowCost: false }) // 66 %
    expect(marginIssueFor({ ...row, cost: 50 })).toMatchObject({ belowCost: true })
    expect(marginIssueFor({ ...row, method: "food_cost", target: 30, cost: 15 })).toBeNull() // 33 %: dentro de meta + 5
    expect(marginIssueFor({ ...row, method: "food_cost", target: 30, cost: 20 })).toMatchObject({ targetPct: 30 }) // 44 %
    expect(marginIssueFor({ ...row, is_sub_recipe: true, cost: 50 })).toBeNull() // sub-recetas no se venden
  })
})

describe("textos de los correos de valor (docs/144)", () => {
  const sample = (type: (typeof ENGAGEMENT_TYPES)[number]): EngagementDecision => ({
    type,
    ref: "",
    vars: { count: "3", feature: "Inventario", plan: "Sous Chef", milestone: "10 recetas", invitee: "Ana", days: "5", business: "Tacos" },
    items: type === "low_stock" || type === "margin_alert" ? ["<strong>Harina</strong>"] : undefined,
    weekly: type === "weekly_summary" ? { recipes: "3", foodCost: "30 %", inventory: "L 10.00", lowStock: "1", margin: "0" } : undefined,
    actionPath: "/dashboard",
  })

  it("7 tipos × 6 idiomas × 3 versiones distintas, sin variables sin reemplazar", () => {
    for (const lang of ["es", "en", "da", "fr", "pt", "zh"] as const) {
      for (const type of ENGAGEMENT_TYPES) {
        const subjects = new Set<string>()
        for (const variant of [0, 1, 2]) {
          const { subject, html } = renderEngagementEmail({ decision: sample(type), language: lang, name: "Ana", actionUrl: "https://x", unsubscribeUrl: "#", variant })
          expect(subject + html).not.toMatch(/\{(count|feature|plan|milestone|invitee|days|business|name)\}/)
          subjects.add(subject)
        }
        expect(subjects.size).toBe(3)
      }
    }
  })

  it("el español usa tú", () => {
    expect(JSON.stringify(ENGAGEMENT_COPY.es) + JSON.stringify(ACTIVATION_VARIANTS.es)).not.toMatch(/\b(podés|tenés|querés|entrá|revisá|mirá|seguí|cargá|armá)\b/)
  })

  it("la rotación no repite hasta pasar por las tres", () => {
    const seen = [0, 1, 2].map((n) => pickEngagementVariant("acc", "low_stock", n))
    expect(new Set(seen).size).toBe(3)
  })

  it("activación: cuentas distintas reciben textos distintos, en su idioma", () => {
    const picks = new Set(Array.from({ length: 30 }, (_, i) => activationVariantFor(`acc-${i}`, "first_recipe_reminder", "en")?.subject ?? "base"))
    expect(picks.size).toBe(3)
    for (const lang of ["es", "en", "da", "fr", "pt", "zh"] as const) {
      for (const type of ["first_recipe_reminder", "day7_margin_checkin", "first_sale_reinforcement", "four_hour_experience"] as const) {
        expect(ACTIVATION_VARIANTS[lang][type]).toHaveLength(2)
      }
    }
  })
})
