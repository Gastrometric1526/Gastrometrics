// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

const updateUser = vi.fn(async () => ({ error: null }))
const updateBusiness = vi.fn(async () => true)
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => ({ auth: { updateUser } }) }))
vi.mock("@/lib/storage/businesses", () => ({ updateBusiness: (...a: unknown[]) => updateBusiness(...(a as [])) }))

import { syncThemeFromAccount } from "./theme-sync"
import type { Business } from "@/types/business"

const biz = (id: string, themeColor?: string) => ({ id, name: id, themeColor }) as unknown as Business

describe("el color viaja con la cuenta (docs/309)", () => {
  beforeEach(() => {
    localStorage.clear()
    updateUser.mockClear()
    updateBusiness.mockClear()
  })

  it("en un aparato nuevo, lo de la cuenta se copia al navegador (persona, negocio y modo)", () => {
    const r = syncThemeFromAccount({ theme_color: "oliva", display_mode: "dark" }, [biz("b1", "terracota"), biz("b2", "user")])
    expect(localStorage.getItem("main_color_theme")).toBe("oliva")
    expect(localStorage.getItem("business_b1_color_theme")).toBe("terracota")
    expect(localStorage.getItem("business_b2_color_theme")).toBe("user")
    expect(r.displayMode).toBe("dark")
    expect(r.changed).toBe(true)
    expect(updateUser).not.toHaveBeenCalled()
  })
  it("lo de la cuenta manda sobre un valor viejo del navegador", () => {
    localStorage.setItem("main_color_theme", "rosa")
    syncThemeFromAccount({ theme_color: "azul-marino" }, [])
    expect(localStorage.getItem("main_color_theme")).toBe("azul-marino")
  })
  it("si la cuenta todavía no tiene color, se sube el que eligió antes en este navegador", () => {
    localStorage.setItem("main_color_theme", "verde-albahaca")
    localStorage.setItem("business_b1_color_theme", "vino-borgona")
    syncThemeFromAccount({}, [biz("b1")])
    expect(updateUser).toHaveBeenCalledWith({ data: { theme_color: "verde-albahaca" } })
    expect(updateBusiness).toHaveBeenCalledWith("b1", { themeColor: "vino-borgona" })
  })
})
