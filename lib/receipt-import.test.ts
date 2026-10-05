import { describe, expect, it } from "vitest"
import { parseReceiptText } from "./receipt-import"

/**
 * Texto EXACTO que devolvió el OCR (modelos de la app) al leer fotos de tickets reales de
 * Wikimedia Commons (docs/151): supermercado en Italia y Polonia, Alemania y una crepería
 * en Francia. Incluye los errores reales del OCR ("1.99 8" por "1.99 B", "1 %1,99").
 */
const OCR: Record<string, string> = {
 "r01_italia": "DOCUMENTO  COMMERCIALE\ndi vendita o prestazione\n\nDESCRIZ IONE                         IVA        Prezzo(€)\nvr?\nACQUA 5.ANGELO NATUR      22,00%         1,37\nMILK PRO PORRIDGE AV      10,00%         1,65\nMILK PRO PORRIDGE AV      10,00%         1,65\nLINDT TAVOLETTA LATT      10,00%         2.05\nCRIK CROK STILE FATT € 10,00%         2,85\n0,5484kg Xx E 2,79/kK0\nMELE GRANNY SMITH [C       4,00%         1,53\n\nTOTALE CONPLESSIVO\n1 cui IVA\n\nPagamento elettronico\n\nImporto pagato\n\n",
 "r02_polonia": "Sklep 5163 ul. Grabarska 2, 50-079 Wroctau\nJeronimo Martins Polska S.A.\nul. Zniwna 5, 62-025 Kostrzyn\nNIP 779-10-11-327\n\n2020-01-09 13:18                                  427351\nPARAGON FISKALNY\nChlebPszen-Zyt550g       C                 1 %1,99 1,99C\nSer z.%iat. 150g        C                 1 %3,29 3,29C\nPoledu kos 100g        (                 1 x4,99 4,99C\nRabat                                           -2,00\n\n2,99C\nSPRZEDAZ OPODATKOWANA C                             8,2]\nPTU C 5,00 #                                        0,39\nSUMA PTU                                             0,39\n00098 #Kasa 2 Kasjer nr 5               2020-01 09  13:18\n\n1AB67BBB57E00223E2006F 5A314C03216172E61C\nA=\" (CH 1701363955\n\nNr sus, 5667\nKarta Visa Debit 05 1                           8,27 PLN\nNr transakcji:                                     5667\nNumer:                                   5163200109566702\nUdzielono tacznie rabatou:                          2,00\n\nDZIEKUJEHY | ZAPRASZAMY PONOWNIE\nBOO 000004585\n",
 "r06_alemania": "Kreiller Str.\n81673 Minchen\nUID Nr.: DE\n\nEUR\nOBAZDA                            2,99 B\nAPRIKOSE                   1.99 8\nSONNENBLUMENGEL                  149 B\n",
 "r07_francia": "TABLE. 42\n1 COUV.     DIRECTION\nGAL FOURAS                       sal\nHOEGAARDEN 25CL                 4.30\nCREPE MIEL CITRON               s.sû\nHT       TUA       BIC\nTUA 20Z Liqu      3.58      0.72      4.30\nTUA 10/ sol i     13.36      1.34     14.70\nTOTAL     19.00\n\nTANTE LUCIE\n38 QUAI DUPERRE\n17000 - LA ROCHELLE (France)\nTel : 05.46.41.24.18\nSIRET 538 514 316\n\nSAMEDI 09-03-2018 14:44:00\n\nCle 20-Serv.:\n\nNom :\n\n20-CAISSE\n\nCODE WIFI : QUAIDUPERRE17\n\nSociete :\nInviteés) :\n\n1-NOTE 010103/1\nPRIX NETS en EURO - MERCI DE VOTRE VISITE\n\nTHÔLE . 14\n1 COUV.     CEDRIC\nHOEGRARDEN 25CL                 4.30\nGAL FOURAS                     9.20\n(CREFL CHOCO. POIRE              44\nHT       TUR       TTC\nTUA 207 Liqu      Dé:      0.72      4.30\nTUA 10/7 sol i     19,79      137     15,4)\nTOTAL     19.40\n\nTANTE LUCIE\n38 QUAI DUPERRE\n17000 - LA ROCHELLE (France)\nTel : 05.46.41.24.18\nSIRET 538 514 316\n\nDIMANCHE 10-03-2019 13:34:28\n\nCle 2-Serv. :\n\nNom :\n\n2-CAISSE\n\nCODE WIFI : QUAIDUPERRE17\n\nSociete :\nInvite(s) :\n\n1-NOTE 010089/1\nPRIX NETS en EURO - MERCI DE VOTRE VISITE\n"
}

const byName = (rows: ReturnType<typeof parseReceiptText>) => Object.fromEntries(rows.map((r) => [r.name, r]))

describe("tickets reales", () => {
  it("Italia: productos con IVA en columna, duplicado y producto pesado", () => {
    const rows = parseReceiptText(OCR.r01_italia, { currency: "EUR" })
    const m = byName(rows)
    expect(rows.map((r) => r.name)).toEqual(["Acqua 5.angelo Natur", "Milk Pro Porridge Av", "Lindt Tavoletta Latt", "Crik Crok Stile Fatt", "Mele Granny Smith"])
    expect(m["Acqua 5.angelo Natur"].price).toBe(1.37)
    expect(m["Lindt Tavoletta Latt"].price).toBe(2.05)
    expect(m["Mele Granny Smith"]).toMatchObject({ unit: "kilogramos", content: 0.5484, price: 1.53 })
  })
  it("Polonia: cantidad × precio, tamaño en el nombre, sin descuentos ni impuestos", () => {
    const rows = parseReceiptText(OCR.r02_polonia, { currency: "EUR" })
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ price: 1.99, unit: "gramos", content: 550 })
    expect(rows[1]).toMatchObject({ price: 3.29, unit: "gramos", content: 150 })
    expect(rows[2]).toMatchObject({ price: 4.99, unit: "gramos", content: 100 })
  })
  it("Alemania: letra de impuesto leída como número", () => {
    const rows = parseReceiptText(OCR.r06_alemania, { currency: "EUR" })
    expect(rows.map((r) => [r.name, r.price])).toEqual([["Obazda", 2.99], ["Aprikose", 1.99]])
  })
  it("Francia: ignora TVA, total, teléfono y SIRET", () => {
    const rows = parseReceiptText(OCR.r07_francia, { currency: "EUR" })
    const names = rows.map((r) => r.name)
    expect(names).toContain("Hoegaarden 25cl")
    expect(byName(rows)["Hoegaarden 25cl"]).toMatchObject({ price: 4.3, unit: "mililitros", content: 250 })
    expect(names.some((n) => /tel|siret|total|tua/i.test(n))).toBe(false)
  })
})

describe("formatos comunes", () => {
  it("Mercadona: producto pesado con el precio en la línea siguiente", () => {
    const rows = parseReceiptText(["PLATANO", "0,738 kg 1,99 €/kg 1,47", "LECHE ENTERA 1L 0,95", "TOTAL (€) 2,42"].join(String.fromCharCode(10)), { currency: "EUR" })
    expect(rows).toEqual([
      expect.objectContaining({ name: "Platano", unit: "kilogramos", content: 0.738, price: 1.47 }),
      expect.objectContaining({ name: "Leche Entera 1l", unit: "litros", content: 1, price: 0.95 }),
    ])
  })
  it("Costa Rica: colones con punto de miles", () => {
    const rows = parseReceiptText(["ARROZ TIO PELON 2KG   2.450,00", "SUBTOTAL 2.450,00"].join(String.fromCharCode(10)), { currency: "CRC" })
    expect(rows).toEqual([expect.objectContaining({ name: "Arroz Tio Pelon 2kg", unit: "kilogramos", content: 2, price: 2450 })])
  })
})

describe("texto del OCR en el navegador (ticket de Italia)", () => {
  it("la línea de peso sin '/kg' no se toma como producto", () => {
    const text = ["CRIK CROK STILE FATI- € 10,00%        2,05", "0,5484kg Xx Els 2,7900", "MELE GRANNY SMITH [C      4,00%        1,53"].join(String.fromCharCode(10))
    const rows = parseReceiptText(text, { currency: "EUR" })
    expect(rows.map((r) => r.name)).toEqual(["Crik Crok Stile Fati", "Mele Granny Smith"])
    expect(rows[1]).toMatchObject({ unit: "kilogramos", content: 0.5484, price: 1.53 })
  })
})
