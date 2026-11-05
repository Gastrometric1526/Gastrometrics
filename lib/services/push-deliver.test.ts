import { describe, expect, it, vi } from "vitest"

const sendNotification = vi.fn()
vi.mock("web-push", () => ({ default: { sendNotification: (...args: unknown[]) => sendNotification(...args), generateVAPIDKeys: vi.fn() } }))
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdminClient: vi.fn() }))

import { deliver, type PushConfig } from "./admin-push"

const device = (endpoint: string) => ({ subscription: { endpoint, keys: { p256dh: "p", auth: "a" } }, label: "", addedAt: "" })
const config: PushConfig = { publicKey: "pub", privateKey: "priv", subscriptions: [] }

describe("envío de avisos a los aparatos (docs/240, docs/241)", () => {
  it("cuenta los entregados y marca los que ya no existen; un error pasajero no borra el aparato", async () => {
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === "gone") throw Object.assign(new Error("gone"), { statusCode: 410 })
      if (sub.endpoint === "down") throw Object.assign(new Error("down"), { statusCode: 503 })
    })
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await deliver(config, [device("ok"), device("gone"), device("down")], { title: "T", body: "B", url: "/mi-plan" })
    spy.mockRestore()
    expect(result).toEqual({ sent: 1, gone: ["gone"] })
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string)).toEqual({ title: "T", body: "B", url: "/mi-plan" })
  })

  it("recorta los textos largos", async () => {
    sendNotification.mockReset()
    sendNotification.mockResolvedValue(undefined)
    await deliver(config, [device("ok")], { title: "T", body: "x".repeat(500) })
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string).body).toHaveLength(180)
  })
})
