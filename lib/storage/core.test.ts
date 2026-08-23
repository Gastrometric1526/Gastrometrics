import { describe, it, expect, beforeEach } from "vitest"
import { getFromStorage, saveToStorage, removeFromStorage, clearReadCache, STORAGE_KEYS } from "./core"

// Cubre el bug real corregido en esta sesión: datos de un negocio no-"main" se
// filtraban hacia/desde las llaves globales compartidas (gastrometrics_${key} / ${key}),
// haciendo que un negocio nuevo heredara por accidente el inventario (o cualquier otro
// dato) de "main" u otro negocio. Ver comentarios en lib/storage/core.ts.
describe("lib/storage/core: aislamiento de datos por negocio", () => {
  beforeEach(() => {
    localStorage.clear()
    clearReadCache()
  })

  it("un negocio que no es 'main' no ve los datos de 'main' cuando no tiene datos propios", () => {
    saveToStorage(STORAGE_KEYS.INVENTORY, [{ id: "1", name: "Harina" }], "main")

    const result = getFromStorage(STORAGE_KEYS.INVENTORY, "biz-nuevo")

    expect(result).toBeNull()
  })

  it("un negocio que no es 'main' lee sus propios datos, no los de otro negocio", () => {
    saveToStorage(STORAGE_KEYS.INVENTORY, [{ id: "1", name: "Harina" }], "main")
    saveToStorage(STORAGE_KEYS.INVENTORY, [{ id: "2", name: "Azucar" }], "biz-a")

    const resultA = getFromStorage<{ id: string; name: string }[]>(STORAGE_KEYS.INVENTORY, "biz-a")
    const resultMain = getFromStorage<{ id: string; name: string }[]>(STORAGE_KEYS.INVENTORY, "main")

    expect(resultA).toEqual([{ id: "2", name: "Azucar" }])
    expect(resultMain).toEqual([{ id: "1", name: "Harina" }])
  })

  it("dos negocios no 'main' no se pisan entre si", () => {
    saveToStorage(STORAGE_KEYS.INGREDIENTS, [{ id: "x" }], "biz-a")
    saveToStorage(STORAGE_KEYS.INGREDIENTS, [{ id: "y" }], "biz-b")

    expect(getFromStorage(STORAGE_KEYS.INGREDIENTS, "biz-a")).toEqual([{ id: "x" }])
    expect(getFromStorage(STORAGE_KEYS.INGREDIENTS, "biz-b")).toEqual([{ id: "y" }])
  })

  it("'main' y ausencia de businessId son equivalentes (workspace legado)", () => {
    saveToStorage(STORAGE_KEYS.RECIPES, [{ id: "r1" }])

    expect(getFromStorage(STORAGE_KEYS.RECIPES, "main")).toEqual([{ id: "r1" }])
    expect(getFromStorage(STORAGE_KEYS.RECIPES)).toEqual([{ id: "r1" }])
  })

  it("guardar para 'main' escribe en las 4 llaves globales/legado", () => {
    saveToStorage(STORAGE_KEYS.MENUS, [{ id: "m1" }], "main")

    expect(localStorage.getItem("menus_main")).not.toBeNull()
    expect(localStorage.getItem("business_main_menus")).not.toBeNull()
    expect(localStorage.getItem("gastrometrics_menus")).not.toBeNull()
    expect(localStorage.getItem("menus")).not.toBeNull()
  })

  it("guardar para un negocio real solo escribe en sus 2 llaves propias, nunca en las globales", () => {
    saveToStorage(STORAGE_KEYS.MENUS, [{ id: "m1" }], "biz-a")

    expect(localStorage.getItem("menus_biz-a")).not.toBeNull()
    expect(localStorage.getItem("business_biz-a_menus")).not.toBeNull()
    expect(localStorage.getItem("gastrometrics_menus")).toBeNull()
    expect(localStorage.getItem("menus")).toBeNull()
  })

  it("eliminar datos de un negocio no toca los datos de otro negocio ni de 'main'", () => {
    saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, [{ id: "po-main" }], "main")
    saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, [{ id: "po-a" }], "biz-a")

    removeFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, "biz-a")

    expect(getFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, "biz-a")).toBeNull()
    expect(getFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, "main")).toEqual([{ id: "po-main" }])
  })

  it("eliminar datos de 'main' no dispara la limpieza de otro negocio", () => {
    saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, [{ id: "po-main" }], "main")
    saveToStorage(STORAGE_KEYS.PURCHASE_ORDERS, [{ id: "po-a" }], "biz-a")

    removeFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, "main")

    expect(getFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, "main")).toBeNull()
    expect(getFromStorage(STORAGE_KEYS.PURCHASE_ORDERS, "biz-a")).toEqual([{ id: "po-a" }])
  })

  it("un arreglo vacio guardado se trata como 'sin datos propios' y no bloquea futuras escrituras", () => {
    saveToStorage(STORAGE_KEYS.INVENTORY, [], "biz-a")

    expect(getFromStorage(STORAGE_KEYS.INVENTORY, "biz-a")).toBeNull()
  })
})
