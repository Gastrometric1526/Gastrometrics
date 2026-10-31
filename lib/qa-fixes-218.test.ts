import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: () => ({}) }))

import translations from "@/lib/i18n/translations"
import { formatActivityEntry, type ActivityLogEntry } from "@/lib/services/activity-log"
import { themeStorageKey } from "@/lib/theme-colors"
import { isModuleVisit } from "@/lib/module-reveal"
import { getUnitLabelFor } from "@/lib/ingredient-labels"

const t = (key: string) => (translations.es as Record<string, string>)[key] ?? key
const entry = (o: Partial<ActivityLogEntry>): ActivityLogEntry => ({
  id: 1, businessId: null, userId: "u", userName: "Daniel", module: "estadisticas", action: "imported",
  entityLabel: null, metadata: null, isNotification: false, createdAt: "2026-10-31T00:00:00Z", ...o,
})

describe("correcciones de la revisión en la cuenta real (docs/218)", () => {
  it("Actividad describe bien cada importación y las ventas salen en Ventas", () => {
    expect(formatActivityEntry(entry({ module: "recetas", entityLabel: "Arroz rojo", metadata: { count: 1 } }), t)).toBe("Daniel importó la receta Arroz rojo")
    expect(formatActivityEntry(entry({ module: "ingredientes", metadata: { count: 8 } }), t)).toBe("Daniel importó 8 ingredientes")
    expect(formatActivityEntry(entry({ metadata: { source: "invoice" } }), t)).toBe("Daniel guardó una factura en Ventas")
    expect(formatActivityEntry(entry({ metadata: { count: 6 } }), t)).toBe("Daniel registró ventas (6 líneas) en Ventas")
    expect(formatActivityEntry(entry({ metadata: { count: 1 } }), t)).toBe("Daniel registró ventas (1 línea) en Ventas")
    expect(formatActivityEntry(entry({ action: "updated", metadata: { count: 6 } }), t)).toBe("Daniel actualizó un registro de ventas en Ventas")
    expect(formatActivityEntry(entry({ module: "inventario", entityLabel: "conteo.jpg", metadata: { count: 1 } }), t)).toBe("Daniel importó 1 fila en Inventario")
    expect(formatActivityEntry(entry({ action: "entered" }), t)).toBe("Daniel entró a Reportes")
  })

  it("el espacio principal usa su propio color, también en /business/main", () => {
    expect(themeStorageKey("main")).toBe("main_color_theme")
    expect(themeStorageKey(null)).toBe("main_color_theme")
    expect(themeStorageKey("b1")).toBe("business_b1_color_theme")
  })

  it("Órdenes de compra deja de ser «Nuevo» al abrirla", () => {
    expect(isModuleVisit("/business/main/ordenes-compra", "/menu-y-compras")).toBe(true)
    expect(isModuleVisit("/menu-y-compras", "/menu-y-compras")).toBe(true)
    expect(isModuleVisit("/menus", "/menu-y-compras")).toBe(false)
  })

  it("1 kilogramo y 1 litro en singular", () => {
    expect(getUnitLabelFor("kilogramos", "es", 1)).toBe("kilogramo")
    expect(getUnitLabelFor("litros", "es", 1)).toBe("litro")
    expect(getUnitLabelFor("kilogramos", "es", 2)).toBe("kilogramos")
  })
})
