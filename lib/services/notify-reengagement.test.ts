import { describe, expect, it } from "vitest"
import { chooseReengagement, renderReengagementEmail, type AccountFacts } from "./notify-reengagement"

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const NOW = new Date("2026-09-28T14:00:00Z").getTime()

function facts(overrides: Partial<AccountFacts> = {}): AccountFacts {
  return {
    now: NOW,
    lastActiveAt: NOW - 5 * DAY,
    lastModule: null,
    draft: null,
    lastInventoryAt: null,
    lastInventoryBusinessId: null,
    hasRecentSales: false,
    firstRecentSaleAt: null,
    lastReportsVisitAt: null,
    recipeCount: 0,
    staleIngredientCount: 0,
    sentHistory: [],
    lastActivationEmailAt: null,
    ...overrides,
  }
}

describe("chooseReengagement", () => {
  it("no manda nada a una cuenta activa hace menos de 3 días", () => {
    expect(chooseReengagement(facts({ lastActiveAt: NOW - 1 * DAY, lastInventoryAt: NOW - 20 * DAY }))).toBeNull()
  })

  it("receta sin terminar gana aunque la cuenta haya estado activa hace horas", () => {
    const d = chooseReengagement(
      facts({
        lastActiveAt: NOW - 3 * HOUR,
        draft: { recipeName: "Ceviche", updatedAt: NOW - 3 * HOUR, businessKey: "biz-1" },
        lastInventoryAt: NOW - 30 * DAY,
      }),
    )
    expect(d?.type).toBe("unfinished_recipe")
    expect(d?.actionPath).toBe("/ficha-tecnica?business=biz-1")
    expect(d?.vars.recipe).toBe("Ceviche")
  })

  it("no recuerda un borrador recién tocado (< 2 h) ni uno vencido (> 24 h)", () => {
    const fresh = facts({ lastActiveAt: NOW - 1 * HOUR, draft: { recipeName: "X", updatedAt: NOW - 1 * HOUR, businessKey: "main" } })
    expect(chooseReengagement(fresh)).toBeNull()
    const expired = facts({ lastActiveAt: NOW - 30 * HOUR, draft: { recipeName: "X", updatedAt: NOW - 30 * HOUR, businessKey: "main" } })
    expect(chooseReengagement(expired)).toBeNull()
  })

  it("prioriza el tipo que corresponde al último módulo usado", () => {
    const base = { lastInventoryAt: NOW - 10 * DAY, recipeCount: 3, staleIngredientCount: 5 }
    expect(chooseReengagement(facts({ ...base, lastModule: "ingredientes" }))?.type).toBe("update_prices")
    expect(chooseReengagement(facts({ ...base, lastModule: "inventario" }))?.type).toBe("inventory_count")
    expect(chooseReengagement(facts({ ...base, lastModule: null }))?.type).toBe("inventory_count")
  })

  it("reportes: solo con ventas recientes y sin visitar Estadísticas hace 7+ días", () => {
    const d = chooseReengagement(
      facts({ hasRecentSales: true, firstRecentSaleAt: NOW - 20 * DAY, lastReportsVisitAt: NOW - 8 * DAY }),
    )
    expect(d?.type).toBe("review_reports")
    expect(d?.vars.days).toBe(8)
    expect(chooseReengagement(facts({ hasRecentSales: true, lastReportsVisitAt: NOW - 4 * DAY, firstRecentSaleAt: NOW - 4 * DAY }))).toBeNull()
  })

  it("te extrañamos solo a partir de 14 días, y nunca después de 90", () => {
    expect(chooseReengagement(facts({ lastActiveAt: NOW - 10 * DAY }))).toBeNull()
    expect(chooseReengagement(facts({ lastActiveAt: NOW - 15 * DAY, recipeCount: 4 }))?.type).toBe("we_miss_you")
    expect(chooseReengagement(facts({ lastActiveAt: NOW - 95 * DAY }))).toBeNull()
  })

  it("respeta el enfriamiento global de 4 días y el de 21 días por tipo", () => {
    const base = { lastActiveAt: NOW - 20 * DAY, lastInventoryAt: NOW - 20 * DAY, recipeCount: 2 }
    expect(chooseReengagement(facts({ ...base, sentHistory: [{ type: "we_miss_you", sentAt: NOW - 2 * DAY }] }))).toBeNull()
    // inventario ya se mandó hace 10 días → cae al siguiente que aplique
    const d = chooseReengagement(facts({ ...base, sentHistory: [{ type: "inventory_count", sentAt: NOW - 10 * DAY }] }))
    expect(d?.type).toBe("we_miss_you")
  })

  it("no se junta con un correo de activación de las últimas 48 h", () => {
    expect(chooseReengagement(facts({ lastActiveAt: NOW - 20 * DAY, lastActivationEmailAt: NOW - 20 * HOUR }))).toBeNull()
  })
})

describe("renderReengagementEmail", () => {
  it("escapa el nombre de la receta y del usuario dentro del HTML", () => {
    const { html, subject } = renderReengagementEmail({
      type: "unfinished_recipe",
      language: "es",
      vars: { name: "<b>Ana</b>", recipe: "Pan <script>" },
      actionUrl: "https://example.com",
      unsubscribeUrl: "https://example.com/u",
    })
    expect(html).not.toContain("<script>")
    expect(html).toContain("Pan &lt;script&gt;")
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;")
    expect(subject).toContain("Pan <script>")
    expect(html).not.toMatch(/\{\{\w+\}\}/)
  })

  it("renderiza los 5 tipos en los 6 idiomas sin variables sin reemplazar", () => {
    for (const lang of ["es", "en", "da", "fr", "pt", "zh"]) {
      for (const type of ["unfinished_recipe", "inventory_count", "review_reports", "update_prices", "we_miss_you"] as const) {
        const { html } = renderReengagementEmail({
          type,
          language: lang,
          vars: { name: "Ana", recipe: "Sopa", days: 5, count: 3 },
          actionUrl: "https://example.com",
          unsubscribeUrl: "https://example.com/u",
        })
        expect(html).not.toMatch(/\{\{?\w+\}\}?/)
      }
    }
  })
})
