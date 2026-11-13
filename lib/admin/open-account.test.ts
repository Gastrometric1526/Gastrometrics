import { describe, expect, it, vi } from "vitest"
import { OPEN_ACCOUNT_EVENT, accountLookupQuery, openAdminAccount, takePendingAccount } from "./open-account"

describe("openAdminAccount (docs/214)", () => {
  it("deja la cuenta pendiente una sola vez y avisa con el evento", () => {
    const heard = vi.fn()
    window.addEventListener(OPEN_ACCOUNT_EVENT, heard)
    openAdminAccount({ email: " ana@x.test " })
    expect(heard).toHaveBeenCalledTimes(1)
    expect(takePendingAccount()).toEqual({ userId: null, email: "ana@x.test" })
    expect(takePendingAccount()).toBeNull()
    window.removeEventListener(OPEN_ACCOUNT_EVENT, heard)
  })

  it("sin correo ni id no hace nada", () => {
    openAdminAccount({ email: null, userId: null })
    expect(takePendingAccount()).toBeNull()
  })

  it("busca por id si lo hay, si no por correo exacto, en todas las cuentas", () => {
    expect(accountLookupQuery({ userId: "u1", email: "a@x.test" })).toBe("confirmed=all&userId=u1")
    expect(accountLookupQuery({ email: "a@x.test" })).toBe("confirmed=all&email=a%40x.test")
  })
})

describe("enlace de las notificaciones a la ficha de la persona (docs/294)", () => {
  it("lleva el id de la cuenta y la parte de respaldo", async () => {
    const { adminAccountUrl, accountFromSearch } = await import("./open-account")
    expect(adminAccountUrl({ userId: "u-1" })).toBe("/admin?tab=cuentas&sub=lista&account=u-1")
    expect(adminAccountUrl({ userId: "u-1" }, { tab: "buzon", sub: "chat" })).toBe("/admin?tab=buzon&sub=chat&account=u-1")
    expect(adminAccountUrl({ email: " Ana@X.test " }, { tab: "buzon" })).toBe("/admin?tab=buzon&accountEmail=ana%40x.test")
    expect(accountFromSearch("?tab=buzon&account=u-1")).toEqual({ userId: "u-1", email: null })
    expect(accountFromSearch("?accountEmail=ana%40x.test")).toEqual({ userId: null, email: "ana@x.test" })
    expect(accountFromSearch("?tab=buzon")).toBeNull()
  })

  it("si la cuenta no está, queda la parte de respaldo una sola vez; y se quita de la dirección", async () => {
    const { openAdminAccountFromLink, takeAccountFallback, withoutAccountParams } = await import("./open-account")
    openAdminAccountFromLink({ userId: "u-1" }, { tab: "buzon", sub: "chat" })
    expect(takePendingAccount()).toEqual({ userId: "u-1", email: null })
    expect(takeAccountFallback()).toEqual({ tab: "buzon", sub: "chat" })
    expect(takeAccountFallback()).toBeNull()
    expect(withoutAccountParams("?tab=cuentas&sub=lista&account=u-1&accountEmail=a")).toBe("tab=cuentas&sub=lista")
  })
})
