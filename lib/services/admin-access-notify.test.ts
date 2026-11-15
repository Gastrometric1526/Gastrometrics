import { describe, expect, it } from "vitest"
import { describeAdminAccess } from "./admin-access-notify"
import { nameFromMetadata, pickName } from "@/lib/admin/admin-names"

const at = new Date("2026-11-15T18:00:00Z")

describe("avisos de acceso a /admin (docs/318)", () => {
  it("acceso nuevo: nombre y correo, quién lo dio y cuándo", () => {
    const out = describeAdminAccess({ kind: "granted", email: "ana@correo.com", by: "dueno@correo.com" }, "Ana López", at)
    expect(out.subject).toBe("Acceso nuevo al panel: Ana López")
    expect(out.rows[0]).toEqual(["Persona", "Ana López (ana@correo.com)"])
    expect(out.rows[1]).toEqual(["Lo hizo", "dueno@correo.com"])
    expect(out.rows.at(-1)?.[0]).toBe("Cuándo (hora de Honduras)")
  })

  it("sin nombre, el correo; primera entrada dice cómo entró", () => {
    const out = describeAdminAccess({ kind: "first_login", email: "ana@correo.com", method: "con el enlace al correo" }, null, at)
    expect(out.subject).toBe("Primera entrada al panel: ana@correo.com")
    expect(out.rows).toContainEqual(["Cómo entró", "con el enlace al correo"])
  })

  it("código de emergencia: siempre avisa, con la IP y la cuenta abierta (o ninguna)", () => {
    const out = describeAdminAccess({ kind: "code", email: null, ip: "1.2.3.4" }, null, at)
    expect(out.subject).toBe("Entraron al panel con el código de emergencia")
    expect(out.rows[0]).toEqual(["Cuenta abierta en ese aparato", "ninguna"])
    expect(out.rows).toContainEqual(["IP", "1.2.3.4"])
  })

  it("el nombre sale del perfil o de Google, nunca vacío", () => {
    expect(nameFromMetadata({ user_metadata: { full_name: " Ana López " } })).toBe("Ana López")
    expect(nameFromMetadata({ user_metadata: { name: "Ana" } })).toBe("Ana")
    expect(nameFromMetadata({ user_metadata: {} })).toBeNull()
    expect(pickName("", "  ", "Ana")).toBe("Ana")
    expect(pickName(null, undefined)).toBeNull()
  })
})
