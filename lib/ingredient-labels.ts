import type { LanguageCode } from "@/lib/i18n/translations"
import { categories, units, type Category, type Unit, type Presentation } from "@/types/ingredient"
import { yieldUnits, type YieldUnit } from "@/types/recipe"

/**
 * Mismo patrón no invasivo que lib/classification-labels.ts: las categorías, unidades y
 * presentaciones de ingrediente (types/ingredient.ts) se guardan en Español fijo — son
 * el VALOR canónico que usa merma, PDFs, filtros, etc. — y NUNCA se traducen. Este
 * archivo solo controla la ETIQUETA que ve el usuario, por idioma. Español no necesita
 * tabla propia: el valor guardado YA es la etiqueta en Español.
 */

const CATEGORY_LABELS: Partial<Record<LanguageCode, Record<Category, string>>> = {
  en: {
    ACEITES: "Oils",
    ALCOHOL: "Alcohol",
    AVES: "Poultry",
    BEBIDAS: "Beverages",
    CAFÉ: "Coffee",
    CERDO: "Pork",
    CHOCOLATE: "Chocolate",
    GAME: "Game",
    DESECHABLES: "Disposables",
    DULCE: "Sweets",
    EMBUTIDO: "Cured Meats",
    ESENCIA: "Extracts",
    ESPECIAS: "Spices",
    FIDEOS: "Noodles / Pasta",
    FLORES: "Edible Flowers",
    FRUTA: "Fruit",
    GRANOS: "Grains",
    GRASAS: "Fats",
    GUARNICIÓN: "Garnish / Sides",
    HARINA: "Flour",
    HIERBAS: "Herbs",
    HUEVO: "Eggs",
    "LÁCTEOS Y DERIVADOS": "Dairy and Derivatives",
    LEVADURA: "Yeast",
    MARISCOS: "Shellfish",
    MASA: "Dough",
    MOLECULAR: "Molecular",
    NUECES: "Nuts",
    OTROS: "Other",
    PESCADO: "Fish",
    REPOSTERÍA: "Pastry",
    RES: "Beef",
    SAL: "Salt",
    "SECOS Y ABARROTES": "Dry Goods",
    SIROPES: "Syrups",
    "Sub Receta / produccion (Mise en place)": "Sub-recipe",
    VEGETAL: "Vegetables",
  },
  da: {
    ACEITES: "Olier",
    ALCOHOL: "Alkohol",
    AVES: "Fjerkræ",
    BEBIDAS: "Drikkevarer",
    CAFÉ: "Kaffe",
    CERDO: "Svinekød",
    CHOCOLATE: "Chokolade",
    GAME: "Vildt",
    DESECHABLES: "Engangsartikler",
    DULCE: "Slik",
    EMBUTIDO: "Pålæg / pølser",
    ESENCIA: "Essenser",
    ESPECIAS: "Krydderier",
    FIDEOS: "Nudler",
    FLORES: "Spiselige blomster",
    FRUTA: "Frugt",
    GRANOS: "Korn",
    GRASAS: "Fedtstoffer",
    GUARNICIÓN: "Tilbehør",
    HARINA: "Mel",
    HIERBAS: "Krydderurter",
    HUEVO: "Æg",
    "LÁCTEOS Y DERIVADOS": "Mejeriprodukter",
    LEVADURA: "Gær",
    MARISCOS: "Skaldyr",
    MASA: "Dej",
    MOLECULAR: "Molekylær",
    NUECES: "Nødder",
    OTROS: "Andet",
    PESCADO: "Fisk",
    REPOSTERÍA: "Bagværk",
    RES: "Oksekød",
    SAL: "Salt",
    "SECOS Y ABARROTES": "Tørvarer",
    SIROPES: "Sirupper",
    "Sub Receta / produccion (Mise en place)": "Underopskrift",
    VEGETAL: "Grøntsager",
  },
  fr: {
    ACEITES: "Huiles",
    ALCOHOL: "Alcool",
    AVES: "Volaille",
    BEBIDAS: "Boissons",
    CAFÉ: "Café",
    CERDO: "Porc",
    CHOCOLATE: "Chocolat",
    GAME: "Gibier",
    DESECHABLES: "Jetables",
    DULCE: "Sucreries",
    EMBUTIDO: "Charcuterie",
    ESENCIA: "Essences",
    ESPECIAS: "Épices",
    FIDEOS: "Pâtes",
    FLORES: "Fleurs comestibles",
    FRUTA: "Fruits",
    GRANOS: "Céréales",
    GRASAS: "Graisses",
    GUARNICIÓN: "Garnitures",
    HARINA: "Farine",
    HIERBAS: "Herbes",
    HUEVO: "Œufs",
    "LÁCTEOS Y DERIVADOS": "Produits laitiers",
    LEVADURA: "Levure",
    MARISCOS: "Fruits de mer",
    MASA: "Pâte",
    MOLECULAR: "Moléculaire",
    NUECES: "Noix",
    OTROS: "Autres",
    PESCADO: "Poisson",
    REPOSTERÍA: "Pâtisserie",
    RES: "Bœuf",
    SAL: "Sel",
    "SECOS Y ABARROTES": "Épicerie sèche",
    SIROPES: "Sirops",
    "Sub Receta / produccion (Mise en place)": "Sous-recette",
    VEGETAL: "Légumes",
  },
  pt: {
    ACEITES: "Óleos",
    ALCOHOL: "Álcool",
    AVES: "Aves",
    BEBIDAS: "Bebidas",
    CAFÉ: "Café",
    CERDO: "Carne de porco",
    CHOCOLATE: "Chocolate",
    GAME: "Caça",
    DESECHABLES: "Descartáveis",
    DULCE: "Doces",
    EMBUTIDO: "Embutidos",
    ESENCIA: "Essências",
    ESPECIAS: "Especiarias",
    FIDEOS: "Massas",
    FLORES: "Flores comestíveis",
    FRUTA: "Frutas",
    GRANOS: "Grãos",
    GRASAS: "Gorduras",
    GUARNICIÓN: "Guarnições",
    HARINA: "Farinha",
    HIERBAS: "Ervas",
    HUEVO: "Ovos",
    "LÁCTEOS Y DERIVADOS": "Laticínios",
    LEVADURA: "Fermento",
    MARISCOS: "Frutos do mar",
    MASA: "Massa (crua)",
    MOLECULAR: "Molecular",
    NUECES: "Nozes",
    OTROS: "Outros",
    PESCADO: "Peixe",
    REPOSTERÍA: "Confeitaria",
    RES: "Carne bovina",
    SAL: "Sal",
    "SECOS Y ABARROTES": "Mercearia seca",
    SIROPES: "Xaropes",
    "Sub Receta / produccion (Mise en place)": "Sub-receita",
    VEGETAL: "Vegetais",
  },
  zh: {
    ACEITES: "油类",
    ALCOHOL: "酒类",
    AVES: "禽类",
    BEBIDAS: "饮料",
    CAFÉ: "咖啡",
    CERDO: "猪肉",
    CHOCOLATE: "巧克力",
    GAME: "野味",
    DESECHABLES: "一次性用品",
    DULCE: "甜食",
    EMBUTIDO: "熟食香肠",
    ESENCIA: "香精",
    ESPECIAS: "香料",
    FIDEOS: "面条",
    FLORES: "食用花卉",
    FRUTA: "水果",
    GRANOS: "谷物",
    GRASAS: "脂肪",
    GUARNICIÓN: "配菜",
    HARINA: "面粉",
    HIERBAS: "香草",
    HUEVO: "蛋类",
    "LÁCTEOS Y DERIVADOS": "乳制品",
    LEVADURA: "酵母",
    MARISCOS: "海鲜",
    MASA: "面团",
    MOLECULAR: "分子料理",
    NUECES: "坚果",
    OTROS: "其他",
    PESCADO: "鱼类",
    REPOSTERÍA: "糕点",
    RES: "牛肉",
    SAL: "盐",
    "SECOS Y ABARROTES": "干货杂货",
    SIROPES: "糖浆",
    "Sub Receta / produccion (Mise en place)": "子配方",
    VEGETAL: "蔬菜",
  },
}

const UNIT_LABELS: Partial<Record<LanguageCode, Record<Unit, string>>> = {
  en: {
    gramos: "Grams",
    kilogramos: "Kilograms",
    mililitros: "Milliliters",
    litros: "Liters",
    onzas: "Ounces",
    "onzas líquidas": "Fluid Ounces",
    libras: "Pounds",
    galones: "Gallons",
    unidad: "Unit",
  },
  da: {
    gramos: "Gram",
    kilogramos: "Kilogram",
    mililitros: "Milliliter",
    litros: "Liter",
    onzas: "Ounce",
    "onzas líquidas": "Væskeunser",
    libras: "Pund",
    galones: "Gallon",
    unidad: "Enhed",
  },
  fr: {
    gramos: "Grammes",
    kilogramos: "Kilogrammes",
    mililitros: "Millilitres",
    litros: "Litres",
    onzas: "Onces",
    "onzas líquidas": "Onces liquides",
    libras: "Livres",
    galones: "Gallons",
    unidad: "Unité",
  },
  pt: {
    gramos: "Gramas",
    kilogramos: "Quilogramas",
    mililitros: "Mililitros",
    litros: "Litros",
    onzas: "Onças",
    "onzas líquidas": "Onças líquidas",
    libras: "Libras",
    galones: "Galões",
    unidad: "Unidade",
  },
  zh: {
    gramos: "克",
    kilogramos: "千克",
    mililitros: "毫升",
    litros: "升",
    onzas: "盎司",
    "onzas líquidas": "液量盎司",
    libras: "磅",
    galones: "加仑",
    unidad: "单位",
  },
}

// Unidad de Rendimiento de receta (types/recipe.ts#yieldUnits) — solo "porciones"
// necesita traducción real; el resto (g/kg/ml/L/oz/lb/un) son símbolos ya neutros en
// cualquier idioma, así que no tienen entrada aquí y getYieldUnitLabel los deja tal cual.
const YIELD_UNIT_LABELS: Partial<Record<LanguageCode, Partial<Record<YieldUnit, string>>>> = {
  en: { porciones: "servings" },
  da: { porciones: "portioner" },
  fr: { porciones: "portions" },
  pt: { porciones: "porções" },
  zh: { porciones: "份" },
}

const PRESENTATION_LABELS: Partial<Record<LanguageCode, Record<Presentation, string>>> = {
  en: {
    Lata: "Can",
    Botella: "Bottle",
    Frasco: "Jar",
    Caja: "Box",
    Bolsa: "Bag",
    Bote: "Tub",
    Paquete: "Package",
    "Envase plástico": "Plastic Container",
    Saco: "Sack",
    Tarrina: "Tub / Punnet",
    "Tetra Pak": "Tetra Pak",
    Ampolla: "Ampoule",
    Sobre: "Sachet",
    Granel: "Bulk",
  },
  da: {
    Lata: "Dåse",
    Botella: "Flaske",
    Frasco: "Glas",
    Caja: "Kasse",
    Bolsa: "Pose",
    Bote: "Bøtte",
    Paquete: "Pakke",
    "Envase plástico": "Plastbeholder",
    Saco: "Sæk",
    Tarrina: "Bakke",
    "Tetra Pak": "Tetra Pak",
    Ampolla: "Ampul",
    Sobre: "Brev",
    Granel: "Løsvægt",
  },
  fr: {
    Lata: "Boîte de conserve",
    Botella: "Bouteille",
    Frasco: "Bocal",
    Caja: "Boîte",
    Bolsa: "Sac",
    Bote: "Pot",
    Paquete: "Paquet",
    "Envase plástico": "Contenant plastique",
    Saco: "Grand sac",
    Tarrina: "Barquette",
    "Tetra Pak": "Tetra Pak",
    Ampolla: "Ampoule",
    Sobre: "Sachet",
    Granel: "Vrac",
  },
  pt: {
    Lata: "Lata",
    Botella: "Garrafa",
    Frasco: "Frasco",
    Caja: "Caixa",
    Bolsa: "Saco",
    Bote: "Pote",
    Paquete: "Pacote",
    "Envase plástico": "Recipiente plástico",
    Saco: "Saco grande",
    Tarrina: "Tarrina",
    "Tetra Pak": "Tetra Pak",
    Ampolla: "Ampola",
    Sobre: "Sachê",
    Granel: "A granel",
  },
  zh: {
    Lata: "罐头",
    Botella: "瓶",
    Frasco: "玻璃瓶",
    Caja: "箱",
    Bolsa: "袋",
    Bote: "桶",
    Paquete: "包",
    "Envase plástico": "塑料容器",
    Saco: "麻袋",
    Tarrina: "小盒",
    "Tetra Pak": "利乐包",
    Ampolla: "安瓿",
    Sobre: "小袋",
    Granel: "散装",
  },
}

// Claves = el texto crudo que devuelve lib/merma-categories.ts#getMermaLevel (canónico
// en Español, usado también como key de estilos de color en la UI).
const MERMA_LEVEL_LABELS: Partial<Record<LanguageCode, Record<string, string>>> = {
  en: { Ninguna: "None", Baja: "Low", Media: "Medium", Alta: "High", "Muy Alta": "Very High" },
  da: { Ninguna: "Ingen", Baja: "Lav", Media: "Middel", Alta: "Høj", "Muy Alta": "Meget høj" },
  fr: { Ninguna: "Aucune", Baja: "Faible", Media: "Moyenne", Alta: "Élevée", "Muy Alta": "Très élevée" },
  pt: { Ninguna: "Nenhuma", Baja: "Baixa", Media: "Média", Alta: "Alta", "Muy Alta": "Muito alta" },
  zh: { Ninguna: "无", Baja: "低", Media: "中", Alta: "高", "Muy Alta": "非常高" },
}

export function getCategoryLabel(category: string, language: LanguageCode): string {
  if (language === "es") return category
  return CATEGORY_LABELS[language]?.[category as Category] ?? category
}

export function getUnitLabel(unit: string, language: LanguageCode): string {
  if (language === "es") return unit
  return UNIT_LABELS[language]?.[unit as Unit] ?? unit
}

export function getYieldUnitLabel(unit: string, language: LanguageCode): string {
  if (language === "es") return unit
  return YIELD_UNIT_LABELS[language]?.[unit as YieldUnit] ?? unit
}

export function getPresentationLabel(presentation: string, language: LanguageCode): string {
  if (language === "es") return presentation
  return PRESENTATION_LABELS[language]?.[presentation as Presentation] ?? presentation
}

export function getMermaLevelLabel(level: string, language: LanguageCode): string {
  if (language === "es") return level
  return MERMA_LEVEL_LABELS[language]?.[level] ?? level
}

/**
 * Reconoce categoría/unidad al importar un Excel/CSV (Ingredientes, `app/ingredientes/
 * page.tsx`) escrito en cualquiera de los 6 idiomas seleccionables de la app, o con
 * abreviaturas comunes — no solo el valor canónico en Español. Nunca se usa para
 * mostrar nada al usuario, solo para EMPAREJAR texto libre contra el valor canónico
 * antes de guardarlo (que siempre queda en Español, igual que hoy).
 */
const stripAccentsUpper = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim()

// Abreviaturas/sinónimos comunes que no son, en sí, la etiqueta traducida de ningún
// idioma (ej. "kg", "fl oz") — se suman a las tablas de arriba para el reconocimiento.
const UNIT_ALIASES: Record<Unit, string[]> = {
  gramos: ["g", "gr", "gram", "gramo", "gramme", "gramm"],
  kilogramos: ["kg", "kilo", "kilogramo", "kilogramme"],
  mililitros: ["ml", "mililitro", "millilitre", "millilitro"],
  litros: ["l", "lt", "litro", "liter", "litre"],
  onzas: ["oz", "onza", "ounce"],
  "onzas líquidas": ["fl oz", "floz", "onza liquida", "fluid ounce", "once liquide"],
  libras: ["lb", "lbs", "libra", "pound"],
  galones: ["gal", "galon", "gallon"],
  unidad: ["u", "ud", "pza", "pieza", "unit", "stk", "enhed", "piece", "unidade"],
}

let unitReverseMap: Map<string, Unit> | null = null
function buildUnitReverseMap(): Map<string, Unit> {
  if (unitReverseMap) return unitReverseMap
  const map = new Map<string, Unit>()
  const add = (key: string, unit: Unit) => {
    const normalized = stripAccentsUpper(key)
    if (normalized) map.set(normalized, unit)
  }
  units.forEach((unit) => {
    add(unit, unit)
    UNIT_ALIASES[unit]?.forEach((alias) => add(alias, unit))
  })
  Object.keys(UNIT_LABELS).forEach((lang) => {
    const table = UNIT_LABELS[lang as LanguageCode]
    if (!table) return
    ;(Object.keys(table) as Unit[]).forEach((unit) => add(table[unit], unit))
  })
  unitReverseMap = map
  return map
}

export function matchUnitLabel(rawText: string): Unit | null {
  if (!rawText) return null
  return buildUnitReverseMap().get(stripAccentsUpper(rawText)) ?? null
}

let categoryReverseMap: Map<string, Category> | null = null
function buildCategoryReverseMap(): Map<string, Category> {
  if (categoryReverseMap) return categoryReverseMap
  const map = new Map<string, Category>()
  const add = (key: string, cat: Category) => {
    const normalized = stripAccentsUpper(key)
    if (normalized) map.set(normalized, cat)
  }
  categories.forEach((cat) => add(cat, cat))
  Object.keys(CATEGORY_LABELS).forEach((lang) => {
    const table = CATEGORY_LABELS[lang as LanguageCode]
    if (!table) return
    ;(Object.keys(table) as Category[]).forEach((cat) => add(table[cat], cat))
  })
  categoryReverseMap = map
  return map
}

export function matchCategoryLabel(rawText: string): Category | null {
  if (!rawText) return null
  return buildCategoryReverseMap().get(stripAccentsUpper(rawText)) ?? null
}
