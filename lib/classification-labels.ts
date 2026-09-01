import type { Classification } from "@/types/recipe"
import type { LanguageCode } from "@/lib/i18n/translations"

// Las clasificaciones en types/recipe.ts guardan el término francés de brigada de cocina
// entre paréntesis como parte del VALOR canónico (ej. "Línea caliente (Cuisine chaude)") —
// eso no se puede tocar sin romper recetas ya guardadas y la comparación con
// SUBRECIPE_CLASSIFICATION. Este archivo solo controla qué se MUESTRA al usuario: el nombre
// limpio en su idioma, sin el paréntesis en francés.

const ES_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Línea caliente",
  "Línea fría (Garde-manger / Cuisine froide)": "Línea fría",
  "Salsas y fondos (Saucier)": "Salsas y fondos",
  "Pescados (Poissonnier)": "Pescados",
  "Carnes y asados (Rôtisseur)": "Carnes y asados",
  "Parrilla (Grillardin)": "Parrilla",
  "Frituras (Friturier)": "Frituras",
  "Vegetales y guarniciones (Entremetier)": "Vegetales y guarniciones",
  "Panadería (Boulangerie)": "Panadería",
  "Bollería (Viennoiserie)": "Bollería",
  "Pastelería (Pâtisserie)": "Pastelería",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chocolatería / Confitería",
  "Heladería (Glacerie)": "Heladería",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcutería y curados",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentación y conservas",
  // Simplificado a pedido del dueño del proyecto — antes decía "Sub Receta / Producción".
  // El VALOR canónico guardado en cada receta no cambia (ver comentario de cabecera).
  "Sub Receta / produccion (Mise en place)": "Sub Receta",
  "I+D (R&D)": "I+D",
}

const EN_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Hot Line",
  "Línea fría (Garde-manger / Cuisine froide)": "Cold Line",
  "Salsas y fondos (Saucier)": "Sauces and Stocks",
  "Pescados (Poissonnier)": "Fish",
  "Carnes y asados (Rôtisseur)": "Meats and Roasts",
  "Parrilla (Grillardin)": "Grill",
  "Frituras (Friturier)": "Fried Foods",
  "Vegetales y guarniciones (Entremetier)": "Vegetables and Sides",
  "Panadería (Boulangerie)": "Bakery",
  "Bollería (Viennoiserie)": "Viennoiserie",
  "Pastelería (Pâtisserie)": "Pastry",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chocolate and Confectionery",
  "Heladería (Glacerie)": "Ice Cream",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcuterie and Cured Goods",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentation and Preserves",
  "Sub Receta / produccion (Mise en place)": "Sub-recipe",
  "I+D (R&D)": "R&D",
}

const DA_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Varm linje",
  "Línea fría (Garde-manger / Cuisine froide)": "Kold linje",
  "Salsas y fondos (Saucier)": "Saucer og fonde",
  "Pescados (Poissonnier)": "Fisk",
  "Carnes y asados (Rôtisseur)": "Kød og stegt",
  "Parrilla (Grillardin)": "Grill",
  "Frituras (Friturier)": "Friturestegt",
  "Vegetales y guarniciones (Entremetier)": "Grøntsager og tilbehør",
  "Panadería (Boulangerie)": "Bageri",
  "Bollería (Viennoiserie)": "Wienerbrød",
  "Pastelería (Pâtisserie)": "Konditori",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chokolade og konfekture",
  "Heladería (Glacerie)": "Is",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcuteri og saltet kød",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentering og konserves",
  "Sub Receta / produccion (Mise en place)": "Underopskrift",
  "I+D (R&D)": "F&U",
}

const FR_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Ligne chaude",
  "Línea fría (Garde-manger / Cuisine froide)": "Ligne froide",
  "Salsas y fondos (Saucier)": "Sauces et fonds",
  "Pescados (Poissonnier)": "Poissons",
  "Carnes y asados (Rôtisseur)": "Viandes et rôtis",
  "Parrilla (Grillardin)": "Grillades",
  "Frituras (Friturier)": "Fritures",
  "Vegetales y guarniciones (Entremetier)": "Légumes et garnitures",
  "Panadería (Boulangerie)": "Boulangerie",
  "Bollería (Viennoiserie)": "Viennoiserie",
  "Pastelería (Pâtisserie)": "Pâtisserie",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chocolaterie / Confiserie",
  "Heladería (Glacerie)": "Glacerie",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcuterie et salaisons",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentation et conserves",
  "Sub Receta / produccion (Mise en place)": "Sous-recette",
  "I+D (R&D)": "R&D",
}

const PT_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "Linha quente",
  "Línea fría (Garde-manger / Cuisine froide)": "Linha fria",
  "Salsas y fondos (Saucier)": "Molhos e fundos",
  "Pescados (Poissonnier)": "Peixes",
  "Carnes y asados (Rôtisseur)": "Carnes e assados",
  "Parrilla (Grillardin)": "Grelha",
  "Frituras (Friturier)": "Frituras",
  "Vegetales y guarniciones (Entremetier)": "Vegetais e acompanhamentos",
  "Panadería (Boulangerie)": "Padaria",
  "Bollería (Viennoiserie)": "Viennoiserie",
  "Pastelería (Pâtisserie)": "Confeitaria",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "Chocolate e doces",
  "Heladería (Glacerie)": "Sorveteria",
  "Charcutería y curados (Charcuterie/Salaison)": "Charcutaria e curados",
  "Fermentación y conservas (Fermentation/Conserverie)": "Fermentação e conservas",
  "Sub Receta / produccion (Mise en place)": "Sub-receita",
  "I+D (R&D)": "P&D",
}

const ZH_LABELS: Record<Classification, string> = {
  "Línea caliente (Cuisine chaude)": "热厨房",
  "Línea fría (Garde-manger / Cuisine froide)": "冷厨房",
  "Salsas y fondos (Saucier)": "酱汁与高汤",
  "Pescados (Poissonnier)": "鱼类",
  "Carnes y asados (Rôtisseur)": "肉类烧烤",
  "Parrilla (Grillardin)": "烤架",
  "Frituras (Friturier)": "油炸食品",
  "Vegetales y guarniciones (Entremetier)": "蔬菜配菜",
  "Panadería (Boulangerie)": "面包房",
  "Bollería (Viennoiserie)": "维也纳酥点",
  "Pastelería (Pâtisserie)": "甜点房",
  "Chocolatería/Confitería (Chocolaterie/Confiserie)": "巧克力/糖果",
  "Heladería (Glacerie)": "冰淇淋",
  "Charcutería y curados (Charcuterie/Salaison)": "熟食与腌制品",
  "Fermentación y conservas (Fermentation/Conserverie)": "发酵与腌渍",
  "Sub Receta / produccion (Mise en place)": "子配方",
  "I+D (R&D)": "研发",
}

const LABELS_BY_LANGUAGE: Record<LanguageCode, Record<Classification, string>> = {
  es: ES_LABELS,
  en: EN_LABELS,
  da: DA_LABELS,
  fr: FR_LABELS,
  pt: PT_LABELS,
  zh: ZH_LABELS,
}

export function getClassificationLabel(classification: Classification, language: LanguageCode): string {
  return LABELS_BY_LANGUAGE[language]?.[classification] ?? ES_LABELS[classification] ?? classification
}
