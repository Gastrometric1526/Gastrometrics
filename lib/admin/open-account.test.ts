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
