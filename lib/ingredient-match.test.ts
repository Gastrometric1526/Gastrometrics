import { describe, expect, it } from "vitest"
import type { Ingredient } from "@/types/ingredient"
import { detectReceiptSupplier, matchImportRow, matchKey, nameSimilarity, supplierKey, withReceiptAlias } from "./ingredient-match"

const ing = (id: string, name: string, supplier: string, extra: Partial<Ingredient> = {}): Ingredient =>
  ({
    id,
    name,
    supplier,
    category: "VEGETALES",
    unit: "kilogramos",
    pricing: { purchasePrice: 1, netContent: 1, pricePerUnit: 1, lastUpdated: "" },
    metadata: { createdAt: "", updatedAt: "", version: 1 },
    ...extra,
  }) as Ingredient

const DEFAULTS = ["Proveedor General", "General Supplier"]
const sk = (s: string) => supplierKey(s, DEFAULTS)

describe("coincidencias de ticket (docs/222)", () => {
  const tomates = [ing("a", "Tomate", "Mercado Central"), ing("b", "Tomate", "La Colonia"), ing("c", "Tomate Cherry", "La Colonia")]

  it("normaliza nombres de ticket", () => {
    expect(matchKey("TOMATE KG 1.25")).toBe("tomate")
    expect(matchKey("Jalapeño x 500 g")).toBe("jalapeno")
    expect(sk("Proveedor General")).toBe("")
    expect(sk("  La Colonia ")).toBe("la colonia")
    expect(nameSimilarity("TOM ROMA", "Tomate Roma")).toBe(1)
  })

  it("con el proveedor del ticket solo toca el tomate de ese proveedor", () => {
    const r = matchImportRow("TOMATE KG", tomates, { supplier: sk("Mercado Central"), defaults: DEFAULTS })
    expect(r.status).toBe("exact")
    expect(r.match?.id).toBe("a")
  })

  it("sin proveedor y con varios tomates no decide: hay que elegir", () => {
    const r = matchImportRow("Tomate", tomates, { defaults: DEFAULTS })
    expect(r.status).toBe("choose")
    expect(r.match).toBeNull()
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("mismo nombre pero de otro proveedor: no toca ninguno", () => {
    const r = matchImportRow("Tomate", tomates, { supplier: sk("Walmart"), defaults: DEFAULTS })
    expect(r.status).toBe("other-supplier")
    expect(r.match).toBeNull()
  })

  it("un solo ingrediente con ese nombre y sin proveedor propio sí coincide", () => {
    const r = matchImportRow("CEBOLLA", [ing("x", "Cebolla", "Proveedor General")], { supplier: sk("Walmart"), defaults: DEFAULTS })
    expect(r.status).toBe("exact")
    expect(r.match?.id).toBe("x")
  })

  it("un nombre parecido solo se propone", () => {
    const r = matchImportRow("TOM CHERRY 500G", tomates, { supplier: sk("La Colonia"), defaults: DEFAULTS })
    expect(r.status).toBe("suggest")
    expect(r.match).toBeNull()
    expect(r.candidates[0].id).toBe("c")
    expect(matchImportRow("Detergente", tomates).status).toBe("none")
  })

  it("lo confirmado se recuerda solo para ese proveedor", () => {
    const withAlias = tomates.map((t) => (t.id === "b" ? withReceiptAlias(t, "TOM ROMA KG", sk("La Colonia")) : t))
    const same = matchImportRow("TOM. ROMA KG", withAlias, { supplier: sk("La Colonia"), defaults: DEFAULTS })
    expect(same.status).toBe("alias")
    expect(same.match?.id).toBe("b")
    const other = matchImportRow("TOM ROMA KG", withAlias, { supplier: sk("Mercado Central"), defaults: DEFAULTS })
    expect(other.match).toBeNull()
    // No se duplica el alias ni se guarda el propio nombre.
    const b = withAlias.find((t) => t.id === "b")!
    expect(withReceiptAlias(b, "TOM ROMA", sk("La Colonia"))).toBe(b)
    expect(withReceiptAlias(b, "TOMATE", sk("La Colonia"))).toBe(b)
  })

  it("lee el proveedor del encabezado del ticket", () => {
    const text = "SUPERMERCADOS LA COLONIA\nRTN 08019999\nTel 2222-3333\nTOMATE KG 25.00"
    expect(detectReceiptSupplier(text, ["Mercado Central", "La Colonia"])).toBe("La Colonia")
    expect(detectReceiptSupplier("Distribuidora El Sol\nFactura 0001\n", [])).toBe("Distribuidora El Sol")
    expect(detectReceiptSupplier("12345\n", [])).toBe("")
  })
})

describe("nombres repetidos en los selectores (docs/222)", () => {
  it("solo los repetidos muestran proveedor y nota", async () => {
    const { repeatedNames, distinguishLabel } = await import("./ingredient-match")
    const list = [ing("a", "Tomate", "Mercado"), ing("b", "tomate ", "Colonia", { notes: "Roma" }), ing("c", "Cebolla", "Mercado")]
    const rep = repeatedNames(list)
    expect(distinguishLabel(list[0], rep)).toBe("Mercado")
    expect(distinguishLabel(list[1], rep)).toBe("Colonia · Roma")
    expect(distinguishLabel(list[2], rep)).toBe("")
  })
})
