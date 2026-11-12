import { describe, expect, it } from "vitest"
import { DELETION_GRACE_DAYS, deletionDeadline, normalizeRecoveryRequest } from "./account-recovery"

describe("recuperar una cuenta (docs/285)", () => {
  it("pide nombre y contacto a quien no recuerda o perdió su correo", () => {
    expect(normalizeRecoveryRequest({ kind: "forgot_email", contact: "a@b.com" })).toEqual({ ok: false, error: "missing_name" })
    expect(normalizeRecoveryRequest({ kind: "lost_email", fullName: "Ana" })).toEqual({ ok: false, error: "missing_contact" })
    expect(normalizeRecoveryRequest({ kind: "robar", fullName: "Ana", contact: "x" })).toEqual({ ok: false, error: "invalid_kind" })
    const ok = normalizeRecoveryRequest({ kind: "lost_email", fullName: "  Ana   Pérez ", contact: " +504 9999 ", possibleEmails: "ana@viejo.com", businessName: "", details: "x".repeat(2000) })
    expect(ok.ok && ok.row).toMatchObject({ kind: "lost_email", full_name: "Ana Pérez", contact: "+504 9999", business_name: null, possible_emails: "ana@viejo.com" })
    expect(ok.ok && ok.row.details?.length).toBe(1000)
  })

  it("restaurar contenido usa el correo de la sesión como contacto y pide qué se borró", () => {
    expect(normalizeRecoveryRequest({ kind: "restore_content" }, { email: "ana@x.com" })).toEqual({ ok: false, error: "missing_details" })
    const ok = normalizeRecoveryRequest({ kind: "restore_content", details: "todas mis recetas" }, { email: "ana@x.com" })
    expect(ok.ok && ok.row.contact).toBe("ana@x.com")
  })

  it("calcula el día del borrado y los días que quedan", () => {
    const requested = "2026-11-01T12:00:00.000Z"
    const d = deletionDeadline(requested, Date.parse("2026-11-12T12:00:00.000Z"))!
    expect(d.purgeAt).toBe(new Date(Date.parse(requested) + DELETION_GRACE_DAYS * 86_400_000).toISOString())
    expect(d.daysLeft).toBe(19)
    expect(deletionDeadline(null)).toBeNull()
    expect(deletionDeadline("no-es-fecha")).toBeNull()
    expect(deletionDeadline(requested, Date.parse("2027-01-01T00:00:00.000Z"))!.daysLeft).toBe(0)
  })
})
