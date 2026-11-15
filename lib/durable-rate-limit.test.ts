import { beforeEach, describe, expect, it, vi } from "vitest"

// docs/312: el límite que se guarda en la base cae a la memoria si la base no responde
// (o si la migración 0042 no se corrió), y nunca deja pasar sin límite.
const rpc = vi.fn()
// Como el cliente real: `rpc` usa `this`, así que falla si se llama suelto (bug que esta prueba atrapa).
const client = {
  marker: "cliente",
  rpc(this: { marker?: string }, ...args: unknown[]) {
    if (this?.marker !== "cliente") throw new Error("rpc llamado sin el cliente")
    return rpc(...args)
  },
}
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: () => client }))

import { durableLockedFor, durableRecordFailure, hashLimitKey } from "./durable-rate-limit"

const LIMIT = { maxAttempts: 3, windowMs: 60_000, lockoutMs: 120_000 }

describe("durable-rate-limit", () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it("sin la base (error), bloquea con la memoria tras superar el máximo", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } })
    const key = `test-fallback-${Math.random()}`
    expect(await durableRecordFailure(key, LIMIT)).toBe(0)
    expect(await durableRecordFailure(key, LIMIT)).toBe(0)
    expect(await durableRecordFailure(key, LIMIT)).toBe(0)
    expect(await durableRecordFailure(key, LIMIT)).toBeGreaterThan(0)
    expect(await durableLockedFor(key, LIMIT)).toBeGreaterThan(0)
  })

  it("si la base dice bloqueado, manda aunque la memoria (otra instancia) esté en cero", async () => {
    rpc.mockResolvedValue({ data: 90, error: null })
    const key = `test-db-${Math.random()}`
    expect(await durableLockedFor(key, LIMIT)).toBe(90)
  })

  it("si la base lanza una excepción, no rompe la entrada", async () => {
    rpc.mockImplementation(() => {
      throw new Error("offline")
    })
    expect(await durableLockedFor(`test-throw-${Math.random()}`, LIMIT)).toBe(0)
  })

  it("guarda la llave como hash, sin correos en claro", async () => {
    rpc.mockResolvedValue({ data: 0, error: null })
    await durableRecordFailure("admin-password:persona@ejemplo.com", LIMIT)
    const args = rpc.mock.calls[0][1] as { p_key: string }
    expect(args.p_key).toBe(hashLimitKey("admin-password:persona@ejemplo.com"))
    expect(args.p_key).not.toContain("@")
    expect(args.p_key).toMatch(/^[0-9a-f]{64}$/)
  })
})
