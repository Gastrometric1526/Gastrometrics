import { describe, expect, it } from "vitest"
import { isAcceptedAttachment, messageReceipts, queuePosition, sanitizeAttachments, searchHelp, SUPPORT_DELIVERED_EVENT, SUPPORT_SEEN_EVENT, type HelpEntry } from "./core"

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

  it("también Word, OpenDocument y RTF, pero nunca HTML ni SVG (docs/345)", () => {
    expect(isAcceptedAttachment({ name: "receta.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1000 })).toBe(true)
    expect(isAcceptedAttachment({ name: "lista.ods", type: "", size: 1000 })).toBe(true)
    expect(isAcceptedAttachment({ name: "nota.rtf", type: "application/rtf", size: 1000 })).toBe(true)
    expect(isAcceptedAttachment({ name: "pagina.html", type: "text/html", size: 1000 })).toBe(false)
    expect(isAcceptedAttachment({ name: "logo.svg", type: "image/svg+xml", size: 1000 })).toBe(false)
    expect(sanitizeAttachments([{ name: "receta.docx", type: "", data: "data:application/octet-stream;base64,AAAA" }])).toHaveLength(1)
  })
})

describe("messageReceipts (docs/334)", () => {
  const msgs = [
    { id: "u1", sender: "user", created_at: "2026-11-19T10:00:00Z" },
    { id: "a1", sender: "admin", created_at: "2026-11-19T10:05:00Z" },
    { id: "u2", sender: "user", created_at: "2026-11-19T10:10:00Z" },
    { id: "a2", sender: "admin", created_at: "2026-11-19T11:00:00Z" },
    { id: "a3", sender: "admin", created_at: "2026-11-19T11:01:00Z" },
  ]
  it("sin marcas: vistas según user_unread, el resto enviadas", () => {
    const r = messageReceipts(msgs, 2, [])
    expect(r.a1.state).toBe("seen")
    expect(r.a2.state).toBe("sent")
    expect(r.a3.state).toBe("sent")
    expect(r.u1).toBeUndefined()
  })
  it("recibida cuando la app la cargó después de mandarla", () => {
    const r = messageReceipts(msgs, 2, [{ event_name: SUPPORT_DELIVERED_EVENT, created_at: "2026-11-19T11:00:30Z" }])
    expect(r.a2).toEqual({ state: "delivered", deliveredAt: "2026-11-19T11:00:30Z" })
    expect(r.a3.state).toBe("sent")
  })
  it("vista con su hora; vista cuenta como recibida", () => {
    const marks = [{ event_name: SUPPORT_SEEN_EVENT, created_at: "2026-11-19T12:00:00Z" }]
    const r = messageReceipts(msgs, 0, marks)
    expect(r.a3).toEqual({ state: "seen", deliveredAt: "2026-11-19T12:00:00Z", seenAt: "2026-11-19T12:00:00Z" })
    expect(r.a1.state).toBe("seen")
  })
  it("user_unread mayor que las respuestas no rompe", () => {
    expect(messageReceipts(msgs, 9, []).a1.state).toBe("sent")
  })
})

describe("cierre por inactividad y conversación por correo (docs/349)", () => {
  const now = new Date("2026-11-23T12:00:00Z").getTime()
  it("cierra solo las respondidas por el equipo sin respuesta de la persona en 24 horas", async () => {
    const { shouldAutoClose } = await import("./core")
    expect(shouldAutoClose({ status: "answered", last_message_at: "2026-11-22T11:59:00Z" }, now)).toBe(true)
    expect(shouldAutoClose({ status: "answered", last_message_at: "2026-11-22T13:00:00Z" }, now)).toBe(false)
    expect(shouldAutoClose({ status: "waiting", last_message_at: "2026-11-01T00:00:00Z" }, now)).toBe(false)
    expect(shouldAutoClose({ status: "closed", last_message_at: "2026-11-01T00:00:00Z" }, now)).toBe(false)
  })
  it("arma la conversación con quién habló, la traducción del equipo y los adjuntos, escapada", async () => {
    const { transcriptHtml } = await import("./core")
    const html = transcriptHtml(
      [
        { sender: "user", body: "Hola <b>", created_at: "2026-11-22T10:00:00Z" },
        { sender: "admin", body: "Hello", translation: { text: "Hola, ¿en qué te ayudo?" }, attachments: [{ name: "guia.pdf" }], created_at: "2026-11-22T10:05:00Z" },
      ],
      { you: "Tú", team: "Soporte", bot: "Asistente", attachments: "adjuntos" },
      (iso) => iso.slice(11, 16),
    )
    expect(html).toContain("<strong>Tú</strong>")
    expect(html).toContain("Hola &lt;b&gt;")
    expect(html).toContain("Hola, ¿en qué te ayudo?")
    expect(html).toContain("1 adjuntos: guia.pdf")
    expect(html).not.toContain("<b>")
  })
})

describe("el cierre automático no escribe a casos viejos (docs/353)", () => {
  it("avisa solo si el último mensaje es de hace 4 días o menos", async () => {
    const { autoCloseNotifies } = await import("./core")
    const now = new Date("2026-11-24T12:00:00Z").getTime()
    expect(autoCloseNotifies("2026-11-23T10:00:00Z", now)).toBe(true)
    expect(autoCloseNotifies("2026-10-01T10:00:00Z", now)).toBe(false)
  })
})
