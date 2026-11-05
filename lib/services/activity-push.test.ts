import { describe, expect, it } from "vitest"
import { activityPushText, isOwnerEmail, isPushActivity } from "./activity-push"

describe("avisos de actividad", () => {
  it("solo avisa las acciones de la lista", () => {
    expect(isPushActivity("recetas", "created")).toBe(true)
    expect(isPushActivity("ingredientes", "imported")).toBe(true)
    expect(isPushActivity("ingredientes", "created")).toBe(false)
    expect(isPushActivity("recetas", "updated")).toBe(false)
    expect(isPushActivity("constructor", "x")).toBe(false)
  })

  it("dice si pasó en un negocio o en el dashboard personal", () => {
    const base = { module: "recetas", action: "created", who: "Ana" }
    expect(activityPushText({ ...base, businessName: "La Terraza" }).body).toBe("Ana · La Terraza")
    expect(activityPushText(base).body).toBe("Ana · Dashboard personal")
  })

  it("incluye la cantidad de una importación", () => {
    const text = activityPushText({ module: "ingredientes", action: "imported", who: "Ana", count: 120 })
    expect(text).toEqual({ title: "Ingredientes importados", body: "Ana · Dashboard personal · 120 elementos" })
  })

  it("el ingreso a la app no lleva lugar", () => {
    expect(activityPushText({ module: "app", action: "opened", who: "Ana" })).toEqual({ title: "Entró a la app", body: "Ana" })
  })

  it("reconoce al dueño sin importar mayúsculas", () => {
    expect(isOwnerEmail("Dueno@Correo.com", "otro@correo.com, dueno@correo.com")).toBe(true)
    expect(isOwnerEmail("ana@correo.com", "dueno@correo.com")).toBe(false)
    expect(isOwnerEmail("ana@correo.com", undefined)).toBe(false)
  })
})
