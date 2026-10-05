import { describe, expect, it } from "vitest"
import { parseRecipeText } from "./parse-recipe"

/**
 * Material REAL de internet (docs/151), no inventado:
 *  - texto que pdf.js extrae de dos recetarios en PDF: "Formato de costeo estándar"
 *    (catedraalimentacioninstitucional.wordpress.com, pág. 14) y "Ficha técnica de preparo"
 *    de la Secretaría de Educación de São Paulo (pág. 6);
 *  - texto que devolvió el OCR de la app con fichas de receta de Wikimedia Commons
 *    ("Lemon sponge cake recipe card", "Spicy Gingerbread", "Pedernales River Chili").
 */
const REAL: Record<string, string> = {
 "pizza_pdf_es": "COSTEO ESTANDAR [PASO A PASO]\nPIZZA HAWAIANA\nClasificación: Plato Fuerte Precio de Venta:\nReceta: Estándar Costo Unitario:\nOrigen: Alemania % Costo:\nRendimiento: 0.927% % Utilidad:\nN° de Porciones: 4 Utilidad de\nservicios:\nTemperatura de\nservicio:\nCaliente Utilidad de\nganancias:\nCosto Total: $195.65\nCOSTO TOTAL $195.65\n16.-COSTO UNITARIO: Es elCosto Total entre el N° de Porciones\nIngredientes Cantidad Unidad Porción\nó\nMedida\nCosto\nUnitario\nRendimiento Importe\n*Puré tomate 0.500 Lt $45.00 1.00 (100%) $22.50\nHarina 0.500 Kg $ 11.00 1.00 (100%) $5.50\nPiña almíbar 0.370 1 Lata $ 22.00 0.37(37.7%) $18.3\nLevadura 0.040 Kg $40.00 1.00 (100%) $1.60\nQueso\nmozzarella\n0.555 Kg $180.00 1.00 (100%) $99.9\nJamón 0.300 Kg $120.00 1.00 (100%) $36.00\nAceite 0.030 Lt $25.00 1.00 (100%) $0.75\nPimienta 0.015 Kg $380.00 1.00 (100%) $5.70\nSal 0.010 Kg $10.00 1.00 (100%) $0.10\nHuevo 0.180 18 Pza. $26.50 0.90 (90%) $5.3\nCOSTO UNITARIO= ∑IMPORTES/N° PORCIONES\nCOSTO UNITARIO48.9=195.65/4\n",
 "arroz_pdf_pt": "5\nFicha Técnica de Preparo\nARROZ MIX – PARBOILIZADO/POLIDO\nSECRETARIA DA EDUCAÇÃO DO ESTADO DE SÃO PAULO\nPROGRAMA NACIONAL DE ALIMENTAÇÃO ESCOLAR – PNAE\nFICHA TÉCNICA DE PREPARO\nETAPA DE ENSINO: FUNDAMENTAL, MÉDIO E EJA\nTIPO DE ATENDIMENTO: REGULAR/PARCEIAL E INTEGRAL:\nFAIXA ETÁRIA: TODAS – 6 A 60 ANOS:\nNome da preparação: Arroz MIX – Parboilizado/polido\nComposição nutricional\nIngrediente Quantidade\n(g/ml)\nMedida\nCaseira\nPB\n(g)\nPL\n(g) FC Energia\nKcal\nCHO\n(g)\nPTN\n(g)\nLPD\n(g)\nCa\n(mg)\nFe\n(mg)\nMg\n(mg)\nVit C\n(mg)\nVit A\n(mcg)\nZn\n(mg)\nFibra\n(g)\nArroz mix 5000 1 pacote 5000 5000 1,00 17889,5 3938,0 357,9 16,8 220,72 33,89 1500,0 0 0 60,0 80,0\nÁgua quente 12000 12 litros 12000 12000 1,00 0 0 0 0 0 0 0 0 0 0 0\nÓleo 100 ½ caneca 100 100 1,00 884,0 0 0 100,0 0 0 0 0 0 0 0\nCebola\npicada 200\n2\nunidades\ngrande\n376 200 1,88 78,84 17,7 3,4 0,16 28,00 0,41 24,0 9,33 0 0,4 4,4\nAlho picado 25 1 colher\nde sopa 27 25 1,08 28,2 6,0 1,8 0,1 3,39 0,61 5,3 0 0 0,2 1,1\nSal 25 1 colher\nsopa 25 25 1,00 0 0 0 0 0 0 0 0 0 0 0\nTotal 18880,6 3961,7 363,1 117,0 252,11 34,49 1529,3 9,33 0 60,6 85,5\nPorção (100g) 157,3 33,0 3,0 1,0 2,1 0,3 12,7 0,1 0,0 0,5 0,7\nModo de preparo:\n1. Ferva a água\n2. Em uma panela, refogar no óleo a cebola e o alho.\n3. Adicione o arroz mix na panela e a água quente.\n4. Acrescente o sal.\n5. Deixe secar a água.\nRendimento: 12kg Peso da porção (g) Fund I e II:\n50g (120g cozido)\nPeso da porção (g) EM e EJA:\n63g (140g cozido)\nTempo de preparo:\n40 minutos\nMedida caseira Fund I e II:\n1 escumadeira média\nMedida caseira EM e EJA:\n1 escumadeira cheia\nFoto:\n",
 "lemon_sponge_ocr": "LEMON SPONGE CAKE\n\n2 t butter\n\n1 ¢ sugar\n\n3 eggs - seperated\n\n1/4 c¢ flour\n\nPinch salt\n\nRind of 1 lemon\n\n5 T fresh lemon juice\n1% c mix                     x\n\nCream butter and sugar, add 3 egg yolks, flour,\nsalt, lemon rind and juice, and 1/2 c milk,\n\nBeat whites until peaks form add milk and\nfold into batter. Put in well greased 13-2 qt\nbaking dish - place in shallow water and bake\n350° oven for 30-40 mins,\n",
 "gingerbread_ocr": "CY GINGERBREAD     (Shirley G)\n2 eggs                    t baking powder\n\n3/4 c brown sugar       2 t soda\n\n3/4 ¢c molasses          2 t ginger\n\n3/4 ¢ melted shortening 1% t cinnemon\n\n2% c flour             4 t nutmeg\n\n% t cloves              1c boiling water\n\nAdd beaten eggs to sugar, molasses and shorten-\ning. Add dry ingredients. Add hot water.\nBake in moderate oven,\n\n",
 "chili_ocr": "Pedernales Bivern (hile\n\nA favorite recipe of\nVice President and Mrs. Lyndon B. Johnson\n\n4 Ibs. chili meat            6 tsps. chili powder\n\n1 large onion               —more if needed\n\n2 cloves garlic               2 cans Ro-tel tomatoes\n1 tsp, ground oregano         Salt to taste\n\n1 tsp. comino seed             2 cups of hot water\n\nPut chili meat, onions and garlic in large heavy\nboiler or skillet, Sear until light colored. Add oregano,\ncomino, chili powder, tomatoes and hot water, Bring\nto a boil, lower heat and simmer about one hour, As fat\ncooks out—skim.\n\nNOCHE SPECIALS\n\nCut tortillas into quarters and fry in deep hot fat\nuntil brown and crisp on both sides. Drain ond put\nabout one teospoon of grated cheese and a slice of\njalapeno pepper on cach quarter. Place in hot oven until\nwell heated and cheese begins to melt. Serve at once.\n\n"
}

const find = (r: ReturnType<typeof parseRecipeText>, name: string) => r.ingredients.find((i) => i.name === name)

describe("fichas técnicas reales en PDF", () => {
  it("costeo estándar (español): tabla con cantidad, unidad y costo unitario", () => {
    const r = parseRecipeText(REAL.pizza_pdf_es)
    expect(r.name).toBe("PIZZA HAWAIANA")
    expect(r.servings).toBe(4)
    expect(r.ingredients.map((i) => i.name)).toEqual([
      "Puré tomate", "Harina", "Piña almíbar", "Levadura", "Queso mozzarella", "Jamón", "Aceite", "Pimienta", "Sal", "Huevo",
    ])
    expect(find(r, "Harina")).toMatchObject({ quantity: 0.5, baseAmount: 500, unitCost: 11 })
    expect(find(r, "Queso mozzarella")).toMatchObject({ baseAmount: 555, unitCost: 180 }) // nombre partido en 2 líneas
    expect(find(r, "Puré tomate")).toMatchObject({ baseAmount: 500, dimension: "volume", unitCost: 45 })
  })
  it("ficha de preparo (portugués): columnas nutricionales, gramos por el encabezado y pasos", () => {
    const r = parseRecipeText(REAL.arroz_pdf_pt)
    expect(r.name).toBe("Arroz MIX – Parboilizado/polido")
    expect(find(r, "Arroz mix")).toMatchObject({ quantity: 5000, dimension: "mass" })
    expect(find(r, "Óleo")).toMatchObject({ quantity: 100 }) // "100 ½ caneca" no es 100.5
    expect(find(r, "Alho picado")).toMatchObject({ quantity: 25 })
    expect(r.procedure.slice(0, 5)).toEqual([
      "Ferva a água",
      "Em uma panela, refogar no óleo a cebola e o alho.",
      "Adicione o arroz mix na panela e a água quente.",
      "Acrescente o sal.",
      "Deixe secar a água.",
    ])
  })
})

describe("fichas de receta reales leídas con el OCR", () => {
  it("abreviaturas de EE. UU. (c, t, T) y la \"c\" leída como \"¢\"", () => {
    const r = parseRecipeText(REAL.lemon_sponge_ocr)
    expect(find(r, "butter")).toMatchObject({ quantity: 2, baseAmount: 10 }) // 2 t
    expect(find(r, "sugar")).toMatchObject({ baseAmount: 240 }) // 1 ¢ = 1 taza
    expect(find(r, "fresh lemon juice")).toMatchObject({ baseAmount: 75 }) // 5 T
    expect(find(r, "mix x")?.quantity).toBe(1.5) // "1%" = 1½
  })
  it("ficha a dos columnas", () => {
    const r = parseRecipeText(REAL.gingerbread_ocr)
    const names = r.ingredients.map((i) => i.name)
    expect(names).toEqual(expect.arrayContaining(["eggs", "brown sugar", "soda", "molasses", "ginger", "flour", "nutmeg", "cloves", "boiling water"]))
    expect(find(r, "flour")?.quantity).toBe(2.5)
  })
  it("tarjeta impresa con dos columnas y pasos", () => {
    const r = parseRecipeText(REAL.chili_ocr)
    expect(r.ingredients.length).toBeGreaterThanOrEqual(7)
    expect(r.procedure.length).toBeGreaterThan(2)
  })
})
