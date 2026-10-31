/**
 * Pasos de cada etapa del tutorial guiado (docs/221). El orden y lo que desbloquea cada etapa
 * viven en lib/journey.ts; aquí, qué se resalta, qué se explica y cómo se avanza:
 * - "next": con «Siguiente» (si tiene `ready`, el botón se habilita cuando se cumple);
 * - "click": cuando la persona toca lo resaltado (o, si tiene `ready`, en cuanto se cumple);
 * - "auto": en cuanto se cumple `ready` (p. ej. la primera línea de la ficha ya tiene costo).
 * Si lo resaltado desaparece (se cerró el diálogo), vuelve al último paso que sí se puede
 * mostrar; un paso `optional` cuyo elemento no existe se salta.
 */

import type { TranslationKey } from "@/lib/i18n/translations"

export type JourneyLive = {
  ficha: { linesWithIngredient: number; costedLines: number; yieldAmount: number; hasName: boolean }
  ingredients: number
  recipes: number
}

export type CoachStep = {
  id: string
  selector: string | null
  title: TranslationKey
  description: TranslationKey
  tip?: TranslationKey
  advance: "next" | "click" | "auto"
  ready?: (live: JourneyLive) => boolean
  optional?: boolean
}

const el = (selector: string) => (typeof document === "undefined" ? null : document.querySelector(selector))

/** El botón «Siguiente»/«Agregar» del asistente de ingrediente está habilitado. */
const wizardReady = () => {
  const button = el('[data-journey="ing-next"], [data-journey="ing-submit"]') as HTMLButtonElement | null
  return !!button && !button.disabled
}

const filled = (selector: string) => {
  const input = el(selector) as HTMLInputElement | null
  return !!input && input.value.trim() !== ""
}

export const CHAPTER_STEPS: Record<string, CoachStep[]> = {
  welcome: [
    { id: "hello", selector: null, title: "journey_welcome_title", description: "journey_welcome_desc", advance: "next" },
    { id: "menu", selector: '[data-tour="sidebar"]', title: "journey_welcome_menu_title", description: "journey_welcome_menu_desc", advance: "next", optional: true },
  ],
  "ingredients-add": [
    { id: "open", selector: '[data-tour="ing-new"]', title: "journey_ing_open_title", description: "journey_ing_open_desc", tip: "journey_ing_open_tip", advance: "click" },
    {
      id: "name",
      selector: '[data-journey="ing-name"]',
      title: "journey_ing_name_title",
      description: "journey_ing_name_desc",
      advance: "next",
      ready: () => filled('[data-journey="ing-dialog"] #name'),
    },
    { id: "classify", selector: '[data-journey="ing-classify"]', title: "journey_ing_classify_title", description: "journey_ing_classify_desc", advance: "next", ready: wizardReady },
    { id: "next-1", selector: '[data-journey="ing-next"]', title: "journey_ing_next_title", description: "journey_ing_next_desc", advance: "click" },
    {
      id: "pricing",
      selector: '[data-journey="ing-pricing"]',
      title: "journey_ing_pricing_title",
      description: "journey_ing_pricing_desc",
      tip: "journey_ing_pricing_tip",
      advance: "next",
      ready: wizardReady,
    },
    { id: "next-2", selector: '[data-journey="ing-next"]', title: "journey_ing_next_title", description: "journey_ing_next_desc", advance: "click" },
    { id: "supplier", selector: '[data-journey="ing-supplier"]', title: "journey_ing_supplier_title", description: "journey_ing_supplier_desc", advance: "next" },
    { id: "submit", selector: '[data-journey="ing-submit"]', title: "journey_ing_submit_title", description: "journey_ing_submit_desc", advance: "click" },
    { id: "done", selector: null, title: "journey_ing_done_title", description: "journey_ing_done_desc", tip: "journey_ing_done_tip", advance: "next" },
  ],
  merma: [
    {
      id: "open",
      selector: '[data-tour="ingredientes-merma-button"]',
      title: "journey_merma_open_title",
      description: "journey_merma_open_desc",
      tip: "journey_merma_open_tip",
      advance: "click",
    },
    {
      id: "master",
      selector: '[data-journey="merma-master"]',
      title: "journey_merma_master_title",
      description: "journey_merma_master_desc",
      advance: "next",
      ready: () => el("#master-merma")?.getAttribute("data-state") === "checked",
    },
    { id: "table", selector: '[data-journey="merma-table"]', title: "journey_merma_table_title", description: "journey_merma_table_desc", advance: "next" },
    { id: "custom", selector: '[data-journey="merma-custom"]', title: "journey_merma_custom_title", description: "journey_merma_custom_desc", advance: "next", optional: true },
    { id: "save", selector: '[data-journey="merma-save"]', title: "journey_merma_save_title", description: "journey_merma_save_desc", advance: "click" },
    { id: "done", selector: null, title: "journey_merma_done_title", description: "journey_merma_done_desc", advance: "next" },
  ],
  "ficha-basic": [
    {
      id: "name",
      selector: '[data-tour="ficha-name-classification"]',
      title: "journey_ficha_name_title",
      description: "journey_ficha_name_desc",
      advance: "next",
      ready: (live) => live.ficha.hasName,
    },
    {
      id: "yield",
      selector: '[data-tour="ficha-paso-rendimiento"]',
      title: "journey_ficha_yield_title",
      description: "journey_ficha_yield_desc",
      tip: "journey_ficha_yield_tip",
      advance: "next",
      ready: (live) => live.ficha.yieldAmount > 0,
    },
    {
      id: "add-line",
      selector: '[data-journey="ficha-add-line"]',
      title: "journey_ficha_add_title",
      description: "journey_ficha_add_desc",
      advance: "click",
      // Si ya hay una línea vacía lista para elegir, no hace falta agregar otra.
      ready: () => !!el('[data-journey="ficha-line-select"]'),
    },
    {
      id: "select",
      selector: '[data-journey="ficha-line-select"]',
      title: "journey_ficha_select_title",
      description: "journey_ficha_select_desc",
      advance: "auto",
      ready: (live) => live.ficha.linesWithIngredient > 0,
    },
    {
      id: "qty",
      selector: '[data-journey="ficha-line-qty"]',
      title: "journey_ficha_qty_title",
      description: "journey_ficha_qty_desc",
      advance: "auto",
      ready: (live) => live.ficha.costedLines > 0,
    },
    { id: "table", selector: '[data-tour="ficha-ingredients-table"]', title: "journey_ficha_table_title", description: "journey_ficha_table_desc", advance: "next" },
    { id: "pricing", selector: '[data-tour="ficha-pricing"]', title: "journey_ficha_pricing_title", description: "journey_ficha_pricing_desc", advance: "next" },
    { id: "summary", selector: '[data-tour="ficha-summary"]', title: "journey_ficha_summary_title", description: "journey_ficha_summary_desc", advance: "next" },
  ],
  "ficha-advanced": [
    { id: "pax", selector: '[data-tour="ficha-pax"]', title: "journey_ficha_pax_title", description: "journey_ficha_pax_desc", tip: "journey_ficha_pax_tip", advance: "next" },
    { id: "method", selector: '[data-journey="ficha-pricing-method"]', title: "journey_ficha_method_title", description: "journey_ficha_method_desc", advance: "next", optional: true },
    { id: "percentages", selector: '[data-journey="ficha-percentages"]', title: "journey_ficha_percent_title", description: "journey_ficha_percent_desc", advance: "next", optional: true },
    { id: "save", selector: '[data-journey="ficha-save-btn"]', title: "journey_ficha_save_title", description: "journey_ficha_save_desc", advance: "click" },
  ],
  recipes: [
    { id: "card", selector: "[data-recipe-card]", title: "journey_recipes_card_title", description: "journey_recipes_card_desc", advance: "click" },
    { id: "panel", selector: '[data-tour="detail-panel-actions"]', title: "journey_recipes_panel_title", description: "journey_recipes_panel_desc", advance: "next" },
    { id: "done", selector: null, title: "journey_recipes_done_title", description: "journey_recipes_done_desc", advance: "next" },
  ],
  finish: [{ id: "done", selector: null, title: "journey_finish_title", description: "journey_finish_desc", advance: "next" }],
}

/** Tarjeta para ir a la etapa cuando la persona está en otra pantalla, y nombre del módulo. */
export const CHAPTER_GO: Record<string, { title: TranslationKey; description: TranslationKey; module: TranslationKey }> = {
  "ingredients-add": { title: "journey_go_ingredients_title", description: "journey_go_ingredients_desc", module: "nav_ingredientes" },
  "ingredients-three": { title: "journey_goal_ingredients_title", description: "journey_goal_ingredients_desc", module: "nav_ingredientes" },
  merma: { title: "journey_go_merma_title", description: "journey_go_merma_desc", module: "nav_ingredientes" },
  "ficha-basic": { title: "journey_go_ficha_title", description: "journey_go_ficha_desc", module: "nav_ficha_tecnica" },
  "ficha-advanced": { title: "journey_go_ficha_title", description: "journey_go_ficha_desc", module: "nav_ficha_tecnica" },
  recipes: { title: "journey_go_recipes_title", description: "journey_go_recipes_desc", module: "nav_mis_recetas" },
  estadisticas: { title: "journey_go_stats_title", description: "journey_go_stats_desc", module: "nav_estadisticas" },
  ventas: { title: "journey_go_sales_title", description: "journey_go_sales_desc", module: "nav_ventas" },
  "recipes-three": { title: "journey_goal_recipes_title", description: "journey_goal_recipes_desc", module: "nav_ficha_tecnica" },
  inventario: { title: "journey_go_inventory_title", description: "journey_go_inventory_desc", module: "nav_inventario" },
  menus: { title: "journey_go_menus_title", description: "journey_go_menus_desc", module: "nav_menus" },
  mep: { title: "journey_go_mep_title", description: "journey_go_mep_desc", module: "nav_mep" },
  ordenes: { title: "journey_go_orders_title", description: "journey_go_orders_desc", module: "nav_ordenes_compra" },
  equipo: { title: "journey_go_team_title", description: "journey_go_team_desc", module: "nav_equipo" },
  negocios: { title: "journey_go_business_title", description: "journey_go_business_desc", module: "nav_negocios" },
  "mi-plan": { title: "journey_go_plan_title", description: "journey_go_plan_desc", module: "mi_plan_title" },
}
