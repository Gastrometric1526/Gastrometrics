import type { MenuTypeOption } from "@/lib/types/menus"
import type { LanguageCode } from "@/lib/i18n/translations"

/**
 * Mismo patrón no invasivo que lib/classification-labels.ts: el tipo de menú
 * (lib/types/menus.ts, menuTypes) se guarda en Español fijo — es el VALOR canónico
 * que usa `Menu.menuType` — y NUNCA se traduce. Este archivo solo controla la
 * ETIQUETA que ve el usuario, por idioma. Español no necesita tabla propia: el
 * valor guardado YA es la etiqueta en Español.
 */

const EN_LABELS: Record<MenuTypeOption, string> = {
  Almuerzo: "Lunch",
  Cena: "Dinner",
  Brunch: "Brunch",
  Buffet: "Buffet",
  Degustación: "Tasting",
  Catering: "Catering",
  "Evento especial": "Special Event",
  Otro: "Other",
}

const DA_LABELS: Record<MenuTypeOption, string> = {
  Almuerzo: "Frokost",
  Cena: "Middag",
  Brunch: "Brunch",
  Buffet: "Buffet",
  Degustación: "Smagsmenu",
  Catering: "Catering",
  "Evento especial": "Særligt arrangement",
  Otro: "Andet",
}

const FR_LABELS: Record<MenuTypeOption, string> = {
  Almuerzo: "Déjeuner",
  Cena: "Dîner",
  Brunch: "Brunch",
  Buffet: "Buffet",
  Degustación: "Dégustation",
  Catering: "Traiteur",
  "Evento especial": "Événement spécial",
  Otro: "Autre",
}

const PT_LABELS: Record<MenuTypeOption, string> = {
  Almuerzo: "Almoço",
  Cena: "Jantar",
  Brunch: "Brunch",
  Buffet: "Buffet",
  Degustación: "Degustação",
  Catering: "Catering",
  "Evento especial": "Evento especial",
  Otro: "Outro",
}

const ZH_LABELS: Record<MenuTypeOption, string> = {
  Almuerzo: "午餐",
  Cena: "晚餐",
  Brunch: "早午餐",
  Buffet: "自助餐",
  Degustación: "品鉴菜单",
  Catering: "餐饮外送",
  "Evento especial": "特别活动",
  Otro: "其他",
}

const LABELS_BY_LANGUAGE: Partial<Record<LanguageCode, Record<MenuTypeOption, string>>> = {
  en: EN_LABELS,
  da: DA_LABELS,
  fr: FR_LABELS,
  pt: PT_LABELS,
  zh: ZH_LABELS,
}

export function getMenuTypeLabel(type: string, language: LanguageCode): string {
  if (language === "es") return type
  return LABELS_BY_LANGUAGE[language]?.[type as MenuTypeOption] ?? type
}
