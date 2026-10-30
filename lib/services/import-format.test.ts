import { describe, expect, it } from "vitest"
import { importFormat, notificationHref, type ActivityLogEntry } from "./activity-log"

describe("registro de importaciones y notificaciones (docs/208)", () => {
  it("reconoce el formato de cada importación", () => {
    expect(importFormat({ name: "Lista Precios.XLSX" })).toBe("excel")
    expect(importFormat({ name: "recetario.xlsm" })).toBe("excel")
    expect(importFormat({ name: "ventas.csv" })).toBe("csv")
    expect(importFormat({ name: "ficha.pdf" })).toBe("pdf")
    expect(importFormat({ name: "ticket.jpg", type: "image/jpeg" })).toBe("foto")
    expect(importFormat({ name: "IMG_1.heic" })).toBe("foto")
    expect(importFormat(null)).toBe("texto")
  })

  it("las notificaciones de precio abren la receta; las viejas, Mis Recetas; el plan, Mi Plan", () => {
    const base = { id: 1, userId: "u", userName: "Chef", module: "recetas", entityLabel: "Pasta", isNotification: true, createdAt: "" } as unknown as ActivityLogEntry
    expect(notificationHref({ ...base, action: "price_raised", businessId: null, metadata: { recipeId: "r1" } })).toBe("/ficha-tecnica/r1?business=main&mode=view")
    expect(notificationHref({ ...base, action: "margin_up", businessId: "b2", metadata: {} })).toBe("/mis-recetas?business=b2")
    expect(notificationHref({ ...base, action: "plan_changed", businessId: null, metadata: {} })).toBe("/mi-plan")
    expect(notificationHref({ ...base, action: "created", businessId: null, metadata: {} })).toBeNull()
  })
})
