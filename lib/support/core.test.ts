import { describe, expect, it } from "vitest"
import { isAcceptedAttachment, queuePosition, sanitizeAttachments, searchHelp, type HelpEntry } from "./core"

describe("chat de soporte (docs/204)", () => {
  it("fila por orden de llegada: cuenta solo las que esperan desde antes", () => {
    const convs = [
      { id: "a", status: "waiting", waiting_since: "2026-10-26T10:00:00Z" },
      { id: "b", status: "answered", waiting_since: "2026-10-26T10:05:00Z" },
      { id: "c", status: "waiting", waiting_since: "2026-10-26T10:10:00Z" },
      { id: "d", status: "waiting", waiting_since: "2026-10-26T10:20:00Z" },
      { id: "e", status: "closed", waiting_since: "2026-10-26T09:00:00Z" },
    ]
    expect(queuePosition(convs, "a")).toBe(0)
    expect(queuePosition(convs, "d")).toBe(2)
    expect(queuePosition(convs, "b")).toBeNull()
  })

  const index: HelpEntry[] = [
    { chapterId: "ficha", chapter: "Recetas y Ficha Técnica", section: "Precio de venta", text: "El precio sugerido usa Food Cost % y se redondea hacia arriba." },
    { chapterId: "ingredientes", chapter: "Ingredientes", section: "Merma", text: "Activa la merma global o personalizada para cada ingrediente." },
    { chapterId: "inventario", chapter: "Inventario", section: "Conteo", text: "Registra tu conteo con foto, PDF o Excel." },
  ]

  it("busca en el manual sin acentos y prioriza el capítulo de la categoría", () => {
    expect(searchHelp(index, "¿Cómo calculo el PRECIO de venta?")[0].section).toBe("Precio de venta")
    expect(searchHelp(index, "merma del pollo", "ingredientes")[0].chapterId).toBe("ingredientes")
    expect(searchHelp(index, "zzz qqq")).toHaveLength(0)
  })

  it("solo acepta los formatos de la app y hasta 3 MB", () => {
    expect(isAcceptedAttachment({ name: "ticket.jpg", type: "image/jpeg", size: 1000 })).toBe(true)
    expect(isAcceptedAttachment({ name: "lista.xlsx", type: "", size: 1000 })).toBe(true)
    expect(isAcceptedAttachment({ name: "virus.exe", type: "application/x-msdownload", size: 1000 })).toBe(false)
    expect(isAcceptedAttachment({ name: "grande.pdf", type: "application/pdf", size: 5 * 1024 * 1024 })).toBe(false)
    const clean = sanitizeAttachments([{ name: "a.png", type: "image/png", data: "data:image/png;base64,AAAA" }, { name: "x.exe", type: "x", data: "data:x;base64,AAAA" }, "basura"])
    expect(clean.map((a) => a.name)).toEqual(["a.png"])
    // Un nombre permitido no basta: el contenido tampoco puede ser HTML.
    expect(sanitizeAttachments([{ name: "foto.png", type: "image/png", data: "data:text/html;base64,PHNjcmlwdD4=" }])).toHaveLength(0)
    expect(sanitizeAttachments([{ name: "libro.xlsm", type: "", data: "data:application/octet-stream;base64,AAAA" }])).toHaveLength(1)
  })
})
