import { describe, it, expect } from "vitest"
import { parseRecipeText, parseIngredientLine } from "./parse-recipe"

const ing = (line: string) => parseIngredientLine(line)!

describe("líneas de ingrediente (docs/145)", () => {
  it("1–2. cantidad primero con 'de'", () => {
    expect(ing("200 g de harina")).toMatchObject({ name: "harina", quantity: 200, dimension: "mass", baseAmount: 200 })
    expect(ing("2 tazas de leche")).toMatchObject({ name: "leche", quantity: 2, dimension: "volume", baseAmount: 480 })
  })
  it("3. nombre primero con dos puntos", () => {
    expect(ing("Harina: 200 g")).toMatchObject({ name: "Harina", quantity: 200, dimension: "mass" })
  })
  it("4. nombre primero con guion o puntos", () => {
    expect(ing("Azúcar - 150 g")).toMatchObject({ name: "Azúcar", quantity: 150 })
    expect(ing("Mantequilla ........ 100 g")).toMatchObject({ name: "Mantequilla", quantity: 100 })
  })
  it("5. cantidad al final", () => {
    expect(ing("Harina 500 g")).toMatchObject({ name: "Harina", quantity: 500, baseAmount: 500 })
    expect(ing("Huevos 3")).toMatchObject({ name: "Huevos", quantity: 3, dimension: "count" })
  })
  it("6. unidad pegada", () => {
    expect(ing("250ml de crema")).toMatchObject({ name: "crema", quantity: 250, dimension: "volume" })
    expect(ing("1kg pollo")).toMatchObject({ name: "pollo", baseAmount: 1000 })
  })
  it("7. fracciones", () => {
    expect(ing("1/2 taza de azúcar").baseAmount).toBe(120)
    expect(ing("1 1/2 tazas de harina").quantity).toBe(1.5)
    expect(ing("½ kg de carne").baseAmount).toBe(500)
    expect(ing("¾ taza de agua").quantity).toBe(0.75)
  })
  it("8. decimales con coma o punto", () => {
    expect(ing("0,5 kg de arroz").baseAmount).toBe(500)
    expect(ing("1.5 l de caldo").baseAmount).toBe(1500)
  })
  it("9. rangos: se toma el mayor", () => {
    expect(ing("2-3 dientes de ajo")).toMatchObject({ name: "ajo", quantity: 3, dimension: "count" })
    expect(ing("2 a 3 cebollas").quantity).toBe(3)
  })
  it("10. números en palabras", () => {
    expect(ing("una taza de leche")).toMatchObject({ quantity: 1, baseAmount: 240 })
    expect(ing("dos huevos")).toMatchObject({ name: "huevos", quantity: 2 })
    expect(ing("media cebolla")).toMatchObject({ name: "cebolla", quantity: 0.5 })
    expect(ing("one cup sugar")).toMatchObject({ name: "sugar", baseAmount: 240 })
  })
  it("11. al gusto / c/n / pizca", () => {
    expect(ing("Sal al gusto")).toMatchObject({ name: "Sal", quantity: 0 })
    expect(ing("Pimienta c/n").quantity).toBe(0)
    expect(ing("Salt to taste")).toMatchObject({ name: "Salt", quantity: 0 })
  })
  it("12. paréntesis como nota", () => {
    expect(ing("1 lata (400 g) de tomate")).toMatchObject({ name: "tomate", quantity: 1, dimension: "count", note: "400 g" })
  })
  it("13. tabla con | o tabulación", () => {
    expect(ing("Harina | 200 | g")).toMatchObject({ name: "Harina", quantity: 200, dimension: "mass" })
    expect(ing("Leche\t1\tl")).toMatchObject({ name: "Leche", baseAmount: 1000 })
  })
  it("14. CSV", () => {
    expect(ing("Harina,200,g")).toMatchObject({ name: "Harina", quantity: 200, dimension: "mass" })
    expect(ing("Azúcar;150;g")).toMatchObject({ name: "Azúcar", quantity: 150 })
  })
  it("15. viñetas", () => {
    expect(ing("- 2 huevos").name).toBe("huevos")
    expect(ing("• 100 g de queso").name).toBe("queso")
    expect(ing("* 1 cda de aceite")).toMatchObject({ name: "aceite", baseAmount: 15 })
  })
  it("19. abreviaturas e idiomas", () => {
    expect(ing("2 cdta de sal").baseAmount).toBe(10)
    expect(ing("2 tbsp olive oil")).toMatchObject({ name: "olive oil", baseAmount: 30 })
    expect(ing("8 oz cream cheese").dimension).toBe("mass")
    expect(ing("1 lb ground beef").baseAmount).toBeCloseTo(453.6, 0)
    expect(ing("200 ml de lait")).toMatchObject({ name: "lait", baseAmount: 200 })
    expect(ing("2 colheres de sopa de manteiga")).toMatchObject({ name: "manteiga", baseAmount: 30 })
    expect(ing("面粉 200克")).toMatchObject({ quantity: 200, dimension: "mass" })
    expect(ing("3 und de tomate")).toMatchObject({ name: "tomate", dimension: "count" })
  })
})

describe("texto leído por OCR (docs/146)", () => {
  it("la foto real del importador: viñeta leída como 'e', líneas en blanco entre ingredientes", () => {
    // Texto exacto que devolvió el OCR en la prueba en vivo con una foto girada y fondo.
    const r = parseRecipeText(
      [
        "Arroz con pollo",
        "",
        "Rinde: 6 porciones",
        "",
        "Ingredientes",
        "e 800 g de pechuga de pollo",
        "",
        "2 tazas de arroz",
        "",
        "1 cebolla picada",
        "",
        "3 dientes de ajo",
        "",
        "1/2 taza de salsa de tomate",
        "2 cdas de aceite",
        "",
        "Sal al gusto",
        "",
        "Preparación",
        "",
        "1. Dorar el pollo en el aceite y reservar.",
        "",
        "2. Sofreír la cebolla y el ajo.",
        "",
        "3. Agregar el arroz, la salsa y 4 tazas de agua.",
        "4. Cocinar tapado 20 minutos.",
      ].join("\n"),
    )
    expect(r.name).toBe("Arroz con pollo")
    expect(r.servings).toBe(6)
    expect(r.ingredients.map((i) => i.name)).toEqual(["pechuga de pollo", "arroz", "cebolla picada", "ajo", "salsa de tomate", "aceite", "Sal"])
    expect(r.ingredients[0].baseAmount).toBe(800)
    expect(r.procedure).toHaveLength(4)
    // Una palabra normal que empieza con "e" no se toca
    expect(parseIngredientLine("espinaca 200 g")!.name).toBe("espinaca")
  })
})

describe("receta completa (docs/145)", () => {
  it("1/16/18/21. título, encabezados, pasos numerados, rendimiento y notas", () => {
    const r = parseRecipeText(`Pollo a la plancha
Rinde: 4 porciones

Ingredientes:
- 800 g de pechuga de pollo
- 2 cdas de aceite de oliva
- Sal al gusto

Preparación:
1. Sazonar el pollo.
2. Calentar la plancha y cocinar 6 minutos por lado.

Notas:
Servir con limón.`)
    expect(r.name).toBe("Pollo a la plancha")
    expect(r.servings).toBe(4)
    expect(r.ingredients.map((i) => i.name)).toEqual(["pechuga de pollo", "aceite de oliva", "Sal"])
    expect(r.procedure).toEqual(["Sazonar el pollo.", "Calentar la plancha y cocinar 6 minutos por lado."])
    expect(r.notes).toEqual(["Servir con limón."])
  })

  it("17. sub-secciones de ingredientes", () => {
    const r = parseRecipeText(`Lasaña
Ingredientes
Para la salsa:
500 g de tomate
Para el relleno:
300 g de carne molida
Preparación
Armar en capas y hornear.`)
    expect(r.ingredients).toHaveLength(2)
    expect(r.ingredients[0].section).toBe("Para la salsa")
    expect(r.ingredients[1].section).toBe("Para el relleno")
  })

  it("19. receta en inglés con 'Serves', 'Directions' y 'Step 1:'", () => {
    const r = parseRecipeText(`Recipe: Pancakes
Serves 6
Ingredients
1 1/2 cups flour
2 eggs
1 cup milk
Directions
Step 1: Mix everything.
Step 2: Cook on a hot griddle.`)
    expect(r.name).toBe("Pancakes")
    expect(r.servings).toBe(6)
    expect(r.ingredients).toHaveLength(3)
    expect(r.procedure[0]).toBe("Mix everything.")
  })

  it("20. sin encabezados: cantidades → ingredientes, frases largas → pasos", () => {
    const r = parseRecipeText(`Arroz blanco
2 tazas de arroz
4 tazas de agua
1 cdta de sal
Lavar el arroz y ponerlo a hervir con el agua y la sal a fuego medio.
Tapar y cocinar 18 minutos hasta que se seque.`)
    expect(r.name).toBe("Arroz blanco")
    expect(r.ingredients).toHaveLength(3)
    expect(r.procedure).toHaveLength(2)
  })

  it("19. portugués y francés", () => {
    const pt = parseRecipeText(`Bolo simples
Rende: 12 porções
Ingredientes
3 ovos
2 xícaras de farinha
Modo de preparo
Bata tudo e asse por 40 minutos.`)
    expect(pt.servings).toBe(12)
    expect(pt.ingredients).toHaveLength(2)
    expect(pt.procedure).toHaveLength(1)
    const fr = parseRecipeText(`Crêpes
Ingrédients
250 g de farine
4 œufs
Préparation
Mélanger et laisser reposer.`)
    expect(fr.ingredients[0]).toMatchObject({ name: "farine", baseAmount: 250 })
    expect(fr.procedure).toEqual(["Mélanger et laisser reposer."])
  })

  it("ingredientes en la misma línea del encabezado", () => {
    const r = parseRecipeText(`Limonada
Ingredientes: 1 l de agua, 4 limones, 100 g de azúcar
Preparación: Mezclar todo con hielo.`)
    expect(r.ingredients.map((i) => i.name)).toEqual(["agua", "limones", "azúcar"])
    expect(r.procedure).toEqual(["Mezclar todo con hielo."])
  })
})
