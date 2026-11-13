import { describe, expect, it } from "vitest"
import { canManageAccess, canRemove, canSignIn, isPermanentAdmin, normalizeAdminEmail, PERMANENT_ADMIN_EMAIL, sortMembers, type AdminMember } from "@/lib/admin/members"

const m = (email: string, role: AdminMember["role"], status: AdminMember["status"]) => ({ email, role, status })
const owner = m("dueno@correo.com", "owner", "active")
const partner = m("socia@correo.com", "admin", "pending")

describe("personas con acceso a /admin (docs/282)", () => {
  it("normaliza correos y rechaza los que no son correo", () => {
    expect(normalizeAdminEmail("  Socia@Correo.COM ")).toBe("socia@correo.com")
    expect(normalizeAdminEmail("sin-arroba")).toBeNull()
    expect(normalizeAdminEmail("a@b")).toBeNull()
    expect(normalizeAdminEmail(42)).toBeNull()
    expect(normalizeAdminEmail(`${"a".repeat(250)}@x.com`)).toBeNull()
  })

  it("un acceso guardado sin enviar todavía no deja entrar; invitado y activo sí", () => {
    expect(canSignIn(m("x@y.com", "admin", "pending"))).toBe(false)
    expect(canSignIn(m("x@y.com", "admin", "invited"))).toBe(true)
    expect(canSignIn(m("x@y.com", "admin", "active"))).toBe(true)
    expect(canSignIn(null)).toBe(false)
  })

  it("solo el dueño o el código de emergencia dan o quitan acceso", () => {
    const members = [owner, m("socia@correo.com", "admin", "active")]
    expect(canManageAccess({ kind: "account", email: "Dueno@correo.com" }, members)).toBe(true)
    expect(canManageAccess({ kind: "account", email: "socia@correo.com" }, members)).toBe(false)
    expect(canManageAccess({ kind: "code" }, members)).toBe(true)
    expect(canManageAccess(null, members)).toBe(false)
  })

  it("nunca se quita el acceso propio ni el del último dueño", () => {
    const members = [owner, partner]
    expect(canRemove("socia@correo.com", { kind: "account", email: owner.email }, members)).toEqual({ ok: true })
    expect(canRemove(owner.email, { kind: "account", email: owner.email }, members)).toEqual({ ok: false, reason: "self" })
    expect(canRemove(owner.email, { kind: "code" }, members)).toEqual({ ok: false, reason: "last_owner" })
    expect(canRemove("nadie@correo.com", { kind: "code" }, members)).toEqual({ ok: false, reason: "missing" })
  })

  // docs/290: la cuenta del negocio es dueña para siempre.
  it("la cuenta permanente nunca se quita, siempre administra y va primera", () => {
    const perm = m(PERMANENT_ADMIN_EMAIL, "owner", "active")
    const members = [owner, perm, partner]
    expect(isPermanentAdmin(PERMANENT_ADMIN_EMAIL.toUpperCase())).toBe(true)
    expect(isPermanentAdmin(owner.email)).toBe(false)
    // Ni el otro dueño, ni el código de emergencia, aunque haya dos dueños.
    expect(canRemove(PERMANENT_ADMIN_EMAIL, { kind: "account", email: owner.email }, members)).toEqual({ ok: false, reason: "permanent" })
    expect(canRemove(PERMANENT_ADMIN_EMAIL, { kind: "code" }, members)).toEqual({ ok: false, reason: "permanent" })
    // El otro dueño sí se puede quitar, porque queda la permanente.
    expect(canRemove(owner.email, { kind: "account", email: PERMANENT_ADMIN_EMAIL }, members)).toEqual({ ok: true })
    // Administra aunque la tabla no la tenga todavía.
    expect(canManageAccess({ kind: "account", email: PERMANENT_ADMIN_EMAIL }, [owner])).toBe(true)
    expect(sortMembers(members)[0].email).toBe(PERMANENT_ADMIN_EMAIL)
  })

  it("la lista muestra primero al dueño y después por estado", () => {
    const sorted = sortMembers([m("b@x.com", "admin", "pending"), m("a@x.com", "admin", "active"), owner, m("c@x.com", "admin", "invited")])
    expect(sorted.map((x) => x.email)).toEqual([owner.email, "a@x.com", "c@x.com", "b@x.com"])
  })
})
