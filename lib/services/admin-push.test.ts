import { describe, expect, it } from "vitest"
import { withSubscription, withoutEndpoints } from "./admin-push"
import { surveyPushText } from "@/lib/feedback/survey-push"

const sub = (endpoint: string, label = "") => ({ subscription: { endpoint, keys: { p256dh: "p", auth: "a" } }, label, addedAt: "" })

describe("aparatos que reciben avisos de /admin (docs/240)", () => {
  it("el mismo aparato no se repite y los que ya no existen se quitan", () => {
    const list = withSubscription([sub("a", "viejo"), sub("b")], sub("a", "nuevo"))
    expect(list.map((s) => [s.subscription.endpoint, s.label])).toEqual([["b", ""], ["a", "nuevo"]])
    expect(withoutEndpoints(list, ["a"]).map((s) => s.subscription.endpoint)).toEqual(["b"])
  })
})

describe("texto del aviso de una encuesta", () => {
  it("muestra la pregunta y la opción en español, con quién respondió", () => {
    expect(surveyPushText({ question: "inventory_freq", answer: "weekly", detail: "", userName: "Ana" })).toEqual({
      title: "¿Cada cuánto cuentas tu inventario?",
      body: "Ana: Cada semana",
    })
  })
  it("escala, «Otro» con texto y respuesta libre", () => {
    expect(surveyPushText({ question: "ocr_accuracy", answer: "4", detail: "", userName: "Ana" }).body).toBe("Ana: 4 de 5")
    expect(surveyPushText({ question: "pain", answer: "other", detail: "Los proveedores", userName: "" }).body).toBe("Una cuenta: Otro · Los proveedores")
    expect(surveyPushText({ question: "improve", answer: "", detail: "Más reportes", userName: "Ana" }).body).toBe("Ana: Más reportes")
  })
})
