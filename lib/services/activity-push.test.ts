import { describe, expect, it } from "vitest"
import { activityPushText, isOwnerEmail, isPushActivity, pushLimit } from "./activity-push"

describe("avisos de actividad", () => {
  it("solo avisa las acciones de la lista", () => {
    expect(isPushActivity("recetas", "created")).toBe(true)
    expect(isPushActivity("ingredientes", "imported")).toBe(true)
    // Desde docs/295 casi todo avisa: crear, editar, borrar, importar, exportar, OCR.
    for (const [m, a] of [["ingredientes", "created"], ["recetas", "updated"], ["recetas", "deleted"], ["recetas", "migrated"], ["ocr", "read"], ["pdf", "exported"], ["ingredientes", "exported"], ["respaldo", "downloaded"], ["cuenta", "wiped"], ["menus", "deleted"], ["salon", "charged"], ["inventario", "created"], ["ordenes_compra", "created"]])
      expect(isPushActivity(m, a)).toBe(true)
    // docs/319: entrar a un módulo avisa (una vez al día); entrar a la app no avisa aparte.
    for (const [m, a] of [["recetas", "entered"], ["mep", "entered"], ["salon", "entered"], ["dashboard", "entered"]])
      expect(isPushActivity(m, a)).toBe(true)
    expect(isPushActivity("app", "opened")).toBe(false)
    // Lo que no es de la persona, o ya avisa por su cuenta, no.
    expect(isPushActivity("recetas", "nudge_shown")).toBe(false)
    expect(isPushActivity("negocios", "created")).toBe(false)
    expect(isPushActivity("equipo", "invited")).toBe(false)
    expect(isPushActivity("constructor", "x")).toBe(false)
    expect(isPushActivity("constructor", "entered")).toBe(false)
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

  it("el cuadre de caja y el cobro en el salón dicen lo que pasó", () => {
    expect(activityPushText({ module: "estadisticas", action: "updated", who: "Ana", kind: "cash_up" }).title).toBe("Hizo el cuadre de caja")
    expect(activityPushText({ module: "estadisticas", action: "deleted", who: "Ana", kind: "cash_up" }).title).toBe("Quitó un cuadre de caja")
    expect(activityPushText({ module: "estadisticas", action: "updated", who: "Ana" }).title).toBe("Ventas corregidas")
    expect(activityPushText({ module: "salon", action: "charged", who: "Ana", label: "$24.50", businessName: "La Terraza" })).toEqual({ title: "Cobró una cuenta en el salón", body: "Ana · $24.50 · La Terraza" })
  })

  it("reconoce al dueño sin importar mayúsculas", () => {
    expect(isOwnerEmail("Dueno@Correo.com", "otro@correo.com, dueno@correo.com")).toBe(true)
    expect(isOwnerEmail("ana@correo.com", "dueno@correo.com")).toBe(false)
    expect(isOwnerEmail("ana@correo.com", undefined)).toBe(false)
  })

  it("dice qué fue: nombre, tipo de OCR y de PDF, módulo al que entró", () => {
    expect(activityPushText({ module: "mep", action: "entered", who: "Ana", businessName: "La Terraza" })).toEqual({ title: "Entró a MEP", body: "Ana · La Terraza" })
    expect(activityPushText({ module: "recetas", action: "created", who: "Ana", label: "Lomo saltado", businessName: "La Terraza" })).toEqual({ title: "Receta creada", body: "Ana · Lomo saltado · La Terraza" })
    expect(activityPushText({ module: "ocr", action: "read", who: "Ana", kind: "receipt" })).toEqual({ title: "Leyó una factura con OCR", body: "Ana" })
    expect(activityPushText({ module: "pdf", action: "exported", who: "Ana", kind: "menu", label: "Carta de verano" }).title).toBe("Exportó un PDF: Menú")
  })

  it("lo que se repite tiene un tope más bajo que lo importante", () => {
    expect(pushLimit("mep", "entered")).toEqual({ max: 1, minutes: 24 * 60 })
    expect(pushLimit("recetas", "updated").max).toBeLessThan(pushLimit("recetas", "imported").max)
    expect(pushLimit("cuenta", "wiped").max).toBeGreaterThanOrEqual(5)
  })
})
