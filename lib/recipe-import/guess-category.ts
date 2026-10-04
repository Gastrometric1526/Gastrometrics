/**
 * Categoría sugerida para un ingrediente creado desde la importación (docs/146), a partir
 * de palabras clave del nombre en los idiomas de la app. Es solo una sugerencia: el
 * diálogo deja cambiarla antes de crear el ingrediente. Puro.
 */

import type { Category } from "@/types/ingredient"
import { stripAccents } from "./parse-recipe"

const RULES: [Category, string[]][] = [
  ["AVES", ["pollo", "pechuga", "muslo", "pavo", "chicken", "turkey", "frango", "poulet", "kylling", "鸡"]],
  ["RES", ["res", "carne molida", "lomo", "beef", "steak", "boeuf", "oksekod", "牛"]],
  ["CERDO", ["cerdo", "tocino", "chuleta", "pork", "bacon", "porco", "porc", "svin", "猪"]],
  ["PESCADO", ["pescado", "tilapia", "salmon", "atun", "fish", "tuna", "peixe", "poisson", "fisk", "鱼"]],
  ["MARISCOS", ["camaron", "langosta", "pulpo", "calamar", "shrimp", "prawn", "camarao", "crevette", "rejer", "虾"]],
  ["HUEVO", ["huevo", "egg", "ovo", "oeuf", "aeg", "蛋"]],
  ["LÁCTEOS Y DERIVADOS", ["leche", "queso", "crema", "mantequilla", "yogur", "milk", "cheese", "cream", "butter", "leite", "queijo", "lait", "fromage", "beurre", "maelk", "ost", "奶", "芝士"]],
  ["ACEITES", ["aceite", "oil", "oleo", "huile", "olie", "油"]],
  ["HARINA", ["harina", "flour", "farinha", "farine", "mel", "面粉"]],
  ["SAL", ["sal", "salt", "sel", "盐"]],
  ["ESPECIAS", ["pimienta", "comino", "canela", "oregano", "paprika", "pepper", "cumin", "cinnamon", "pimenta", "poivre", "peber", "胡椒"]],
  ["HIERBAS", ["cilantro", "perejil", "albahaca", "romero", "tomillo", "parsley", "basil", "herb", "salsa verde", "coentro", "persil", "basilic", "persille", "香菜"]],
  ["FRUTA", ["limon", "naranja", "manzana", "fresa", "pina", "mango", "lemon", "lime", "orange", "apple", "banana", "laranja", "citron", "pomme", "citron", "柠檬", "苹果"]],
  ["VEGETAL", ["tomate", "cebolla", "ajo", "papa", "zanahoria", "chile", "pimiento", "lechuga", "tomato", "onion", "garlic", "potato", "carrot", "cebola", "alho", "oignon", "ail", "log", "hvidlog", "番茄", "洋葱", "蒜"]],
  ["GRANOS", ["arroz", "frijol", "lenteja", "maiz", "rice", "bean", "lentil", "corn", "feijao", "riz", "haricot", "ris", "bonne", "米", "豆"]],
  ["FIDEOS", ["pasta", "fideo", "espagueti", "spaghetti", "noodle", "macarrao", "nouille", "面条"]],
  ["REPOSTERÍA", ["azucar", "chocolate", "vainilla", "polvo de hornear", "sugar", "vanilla", "baking", "acucar", "sucre", "sukker", "糖"]],
  ["LEVADURA", ["levadura", "yeast", "fermento", "levure", "gaer", "酵母"]],
  ["NUECES", ["nuez", "almendra", "mani", "nut", "almond", "peanut", "noz", "amendoa", "noix", "amande", "nodder", "坚果"]],
  ["BEBIDAS", ["agua", "jugo", "soda", "water", "juice", "suco", "eau", "jus", "vand", "水"]],
  ["DESTILADOS", ["ron", "vodka", "tequila", "whisky", "gin", "rum", "rhum"]],
  ["VINOS", ["vino", "wine", "vinho", "vin", "葡萄酒"]],
]

export function guessCategory(name: string): Category {
  const plain = ` ${stripAccents(name.toLowerCase())} `
  for (const [category, words] of RULES) {
    if (words.some((w) => (/[一-鿿]/.test(w) ? plain.includes(w) : plain.includes(` ${w} `) || plain.includes(` ${w}s `) || plain.includes(` ${w}es `)))) {
      return category
    }
  }
  return "OTROS"
}
