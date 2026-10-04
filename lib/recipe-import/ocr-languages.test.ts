import { describe, expect, it } from "vitest"
import { parseRecipeText } from "./parse-recipe"
import { findBestMatch } from "./match-ingredients"
import { detectRecipeLanguage } from "./ocr"
import type { Ingredient } from "@/types/ingredient"

/**
 * Texto EXACTO que devolvió el OCR (tesseract.js + modelos best_int de public/ocr) al leer
 * una foto de receta en cada uno de los 6 idiomas (docs/148), con sus errores reales:
 * viñetas leídas como "_" o "=“", pasos con número mal leído ("5.", "»."), caracteres
 * chinos parecidos (洋葡 por 洋葱). Cada receta debe dar 7 ingredientes, 6 porciones y 3 pasos.
 */
const OCR_TEXT: Record<string, string> = {
  "spa": "Arroz con pollo\nPorciones: 6\n\nIngredientes\n\n- 800 g de pechuga de pollo\n- 2 tazas de arroz\n\n- 1 cebolla picada\n\n- 3 dientes de ajo\n\n- 1/2 taza de aceite de oliva\n\n- 2 cdas de sal\n- 1 litro de caldo de pollo\n\nPreparación\n\n1. Sofreír la cebolla y el ajo en el aceite.\n\n2. Agregar el pollo y dorar por 10 minutos.\n\n3. Añadir el arroz y el caldo, cocinar 20 minutos.",
  "eng": "Chicken and Rice\n\nServes 6\n\nIngredients\n\n- 800 g chicken breast\n- 2 cups rice\n\n- 1 onion, chopped\n\n- 3 garlic cloves\n\n-1/2 cup olive oil\n- 2 tbsp salt\n\n_ 1 liter chicken stock\n\nMethod\n\n1. Fry the onion and garlic in the oil.\n\n5. Add the chicken and brown for 10 minutes.\n3. Add the rice and stock, cook for 20 minutes.",
  "dan": "Kylling med ris\n\nPortioner: 6\n\nIngredienser\n\n- 800 g kyllingebryst\n- 2dl ris\n\n- 1 løg, hakket\n\n- 3 fed hvidløg\n\n- 1 dl olivenolie\n\n- 2 spsk salt\n\n- 1 liter hønsefond\n\nFremgangsmåde\n1. Svits løg og hvidløg i olien.\n». Tilsæt kyllingen og brun den i 10 minutter.\n\n3. Tilsæt ris og fond, og kog i 20 minutter.",
  "fra": "Poulet au riz\nPour 6 personnes\n\nIngrédients\n\n- 800 g de blanc de poulet\n\n- 2 tasses de riz\n\n- 1 oignon haché\n\n- 3 gousses d'ail\n\n- 1/2 tasse d'huile d'olive\n\n- 2 c. à soupe de sel\n\n- 1 litre de bouillon de volaille\n\nPréparation\n1. Faire revenir l'oignon et l'ail dans l'huile.\n2. Ajouter le poulet et dorer 10 minutes.\n\n3. Ajouter le riz et le bouillon, cuire 20 minutes.",
  "por": "Arroz com frango\nRendimento: 6 porções\n\nIngredientes\n\n- 800 g de peito de frango\n\n- 2 xícaras de arroz\n\n- 1 cebola picada\n\n- 3 dentes de alho\n\n- 1/2 xícara de azeite de oliva\n- 2 colheres de sopa de sal\n\n- 1 litro de caldo de frango\n\nModo de preparo\n\n1. Refogue a cebola e o alho no azeite.\n2. Junte o frango e doure por 10 minutos.\n3. Acrescente o arroz e o caldo, cozinhe por 20 minutos.",
  "chi_sim": "鸡肉饭\n份数: 6\n\n配料\n\n- 鸡胸肉 800 克\n-大米2 杯\n\n=“洋葡1个\n-大蒜 3 瓣\n\n- 橄槛油 100 毫升\n-盐 2汤匙\n- 鸡汤 1升\n\n做法\n\n1. 用油炒香洋葱和大蒜。\n\n2. 加入鸡肉前 10 分钟。\n\n3. 加入大米和鸡汤，煮 20 分钟。"
}

describe("texto real del OCR en los 6 idiomas", () => {
  it.each(Object.keys(OCR_TEXT))("%s", (lang) => {
    const r = parseRecipeText(OCR_TEXT[lang])
    expect(r.name).toBeTruthy()
    expect(r.servings).toBe(6)
    expect(r.procedure).toHaveLength(3)
    expect(r.ingredients).toHaveLength(7)
    const first = r.ingredients[0]
    expect(first.quantity).toBe(800)
    expect(first.baseAmount).toBe(800) // gramos
    expect(r.ingredients.every((i) => i.name && !/^[-_=“”»]/.test(i.name))).toBe(true)
  })

  it("convierte las unidades propias de cada idioma", () => {
    const fr = parseRecipeText(OCR_TEXT.fra).ingredients
    expect(fr.find((i) => i.name === "sel")?.baseAmount).toBe(30) // 2 c. à soupe
    expect(fr.find((i) => i.name.startsWith("huile"))?.baseAmount).toBe(120) // ½ tasse, sin "d'"
    const zh = parseRecipeText(OCR_TEXT.chi_sim).ingredients
    expect(zh.find((i) => i.name === "大米")?.baseAmount).toBe(480) // 2 杯, sin espacio en el OCR
    expect(zh.find((i) => i.name === "大蒜")?.dimension).toBe("count") // 3 瓣
    const da = parseRecipeText(OCR_TEXT.dan).ingredients
    expect(da.find((i) => i.name === "hvidløg")?.quantity).toBe(3) // 3 fed
  })
})

describe("emparejar con la base en danés y chino", () => {
  const ing = (name: string) => ({ id: name, name }) as unknown as Ingredient
  it("danés: ø/æ no rompen la palabra", () => {
    expect(findBestMatch("løg", [ing("Løg"), ing("Hvidløg")], "da")?.name).toBe("Løg")
    expect(findBestMatch("hvidløg", [ing("Løg"), ing("Hvidløg")], "da")?.name).toBe("Hvidløg")
  })
  it("chino: exacto y núcleo al final", () => {
    expect(findBestMatch("大米", [ing("大米"), ing("米粉")], "zh")?.name).toBe("大米")
    expect(findBestMatch("洋葱", [ing("红洋葱")], "zh")?.name).toBe("红洋葱")
    expect(findBestMatch("鸡汤", [ing("鸡胸肉")], "zh")).toBeNull()
  })
})

describe("detectar el idioma del texto leído", () => {
  it.each(Object.keys(OCR_TEXT))("%s", (lang) => {
    expect(detectRecipeLanguage(OCR_TEXT[lang])).toBe(lang)
  })
  it("sin señales claras no adivina", () => {
    expect(detectRecipeLanguage("Pollo 800 g")).toBeNull()
  })
})
