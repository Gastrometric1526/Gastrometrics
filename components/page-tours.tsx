"use client"

import { PageTour, type TourStep } from "@/components/page-tour"
import { useLanguage } from "@/contexts/language-context"

// Tours ligeros por página — cada uno corre una sola vez (su propio storageKey en
// localStorage), la primera vez que el usuario visita esa sección. Todos comparten
// el motor de components/page-tour.tsx; ver ese archivo para la lógica de spotlight.
// El texto de cada paso viene de lib/i18n/translations.ts (claves tour_*) para que
// el tutorial cambie de idioma junto con el resto de la app.

export function FichaTecnicaTour({ hasIngredients }: { hasIngredients: boolean }) {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_ficha_header_title"),
      description: t("tour_ficha_header_desc"),
      selector: '[data-tour="ficha-header"]',
    },
    {
      id: "ingredientes-btn",
      title: t("tour_ficha_ingredientes_btn_title"),
      description: t("tour_ficha_ingredientes_btn_desc"),
      selector: '[data-tour="ficha-ingredientes-btn"]',
    },
    ...(hasIngredients
      ? []
      : [
          {
            id: "warning",
            title: t("tour_ficha_warning_title"),
            description: t("tour_ficha_warning_desc"),
            selector: '[data-tour="ficha-warning"]',
          } as TourStep,
        ]),
    {
      id: "name-classification",
      title: t("tour_ficha_name_title"),
      description: t("tour_ficha_name_desc"),
      selector: '[data-tour="ficha-name-classification"]',
    },
    {
      id: "paso-rendimiento",
      title: t("tour_ficha_paso_title"),
      description: t("tour_ficha_paso_desc"),
      selector: '[data-tour="ficha-paso-rendimiento"]',
    },
    {
      id: "pax",
      title: t("tour_ficha_pax_title"),
      description: t("tour_ficha_pax_desc"),
      selector: '[data-tour="ficha-pax"]',
    },
    {
      id: "ingredients-table",
      title: t("tour_ficha_ingredients_table_title"),
      description: t("tour_ficha_ingredients_table_desc"),
      selector: '[data-tour="ficha-ingredients-table"]',
    },
    {
      id: "pricing",
      title: t("tour_ficha_pricing_title"),
      description: t("tour_ficha_pricing_desc"),
      selector: '[data-tour="ficha-pricing"]',
    },
    {
      id: "summary",
      title: t("tour_ficha_summary_title"),
      description: t("tour_ficha_summary_desc"),
      selector: '[data-tour="ficha-summary"]',
    },
    {
      id: "save",
      title: t("tour_ficha_save_title"),
      description: t("tour_ficha_save_desc"),
      selector: '[data-tour="ficha-save"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_ficha-tecnica" />
}

export function IngredientesTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_ing_header_title"),
      description: t("tour_ing_header_desc"),
      selector: '[data-tour="ing-header"]',
    },
    { id: "new", title: t("tour_ing_new_title"), description: t("tour_ing_new_desc"), selector: '[data-tour="ing-new"]' },
    { id: "import", title: t("tour_ing_import_title"), description: t("tour_ing_import_desc"), selector: '[data-tour="ing-import"]' },
    { id: "search", title: t("tour_ing_search_title"), description: t("tour_ing_search_desc"), selector: '[data-tour="ing-search"]' },
    { id: "unit-switch", title: t("tour_ing_unit_switch_title"), description: t("tour_ing_unit_switch_desc"), selector: '[data-tour="ing-unit-switch"]' },
    { id: "table", title: t("tour_ing_table_title"), description: t("tour_ing_table_desc"), selector: '[data-tour="ing-table"]' },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_ingredientes" />
}

export function InventarioTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_inv_header_title"),
      description: t("tour_inv_header_desc"),
      selector: '[data-tour="inv-header"]',
    },
    { id: "add", title: t("tour_inv_add_title"), description: t("tour_inv_add_desc"), selector: '[data-tour="inv-add"]' },
    { id: "register", title: t("tour_inv_register_title"), description: t("tour_inv_register_desc"), selector: '[data-tour="inv-register"]' },
    { id: "export-pdf", title: t("tour_inv_export_pdf_title"), description: t("tour_inv_export_pdf_desc"), selector: '[data-tour="inv-export-pdf"]' },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_inventario" />
}

export function MisRecetasTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_recetas_header_title"),
      description: t("tour_recetas_header_desc"),
      selector: '[data-tour="recetas-header"]',
    },
    { id: "new", title: t("tour_recetas_new_title"), description: t("tour_recetas_new_desc"), selector: '[data-tour="recetas-new"]' },
    { id: "trash", title: t("tour_recetas_trash_title"), description: t("tour_recetas_trash_desc"), selector: '[data-tour="recetas-trash"]' },
    { id: "stats", title: t("tour_recetas_stats_title"), description: t("tour_recetas_stats_desc"), selector: '[data-tour="recetas-stats"]' },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_mis-recetas" />
}

export function MenusTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_menus_header_title"),
      description: t("tour_menus_header_desc"),
      selector: '[data-tour="menus-header"]',
    },
    {
      id: "new",
      title: t("tour_menus_new_title"),
      description: t("tour_menus_new_desc"),
      selector: '[data-tour="menus-new"]',
    },
    {
      id: "generate-order",
      title: t("tour_menus_generate_order_title"),
      description: t("tour_menus_generate_order_desc"),
      selector: '[data-tour="menus-generate-order"]',
      // El ítem vive dentro de un DropdownMenu que no está en el DOM hasta que se abre —
      // y DropdownMenuTrigger de Radix reacciona a onPointerDown, no a onClick (ver el
      // mismo hallazgo documentado en docs/35 para Tabs, con onMouseDown en ese caso).
      beforeShow: () => {
        document
          .querySelector('[data-tour="menus-card-menu-trigger"]')
          ?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }))
      },
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_menus" />
}

export function EstadisticasTour() {
  const { t } = useLanguage()
  // Igual que en Configuración (ver docs/35): las pestañas Panorama/Finanzas son Radix
  // Tabs, así que el contenido de la pestaña inactiva no existe en el DOM hasta que se
  // hace clic — y TabsTrigger reacciona a onMouseDown, no a onClick.
  const clickTab = (id: string) => () => {
    document.getElementById(id)?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
  }

  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_stats_header_title"),
      description: t("tour_stats_header_desc"),
      selector: '[data-tour="stats-header"]',
    },
    {
      id: "overview-cards",
      title: t("tour_stats_overview_title"),
      description: t("tour_stats_overview_desc"),
      selector: '[data-tour="stats-overview-cards"]',
      beforeShow: clickTab("stats-tab-panorama"),
    },
    {
      id: "price-history",
      title: t("tour_stats_price_history_title"),
      description: t("tour_stats_price_history_desc"),
      selector: '[data-tour="stats-price-history"]',
    },
    {
      id: "finanzas-import",
      title: t("tour_stats_finanzas_import_title"),
      description: t("tour_stats_finanzas_import_desc"),
      selector: '[data-tour="finanzas-import-pos"]',
      beforeShow: clickTab("stats-tab-finanzas"),
    },
    {
      id: "finanzas-key-cards",
      title: t("tour_stats_finanzas_cards_title"),
      description: t("tour_stats_finanzas_cards_desc"),
      selector: '[data-tour="finanzas-key-cards"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_estadisticas" />
}

export function OrdenesCompraTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_ordenes_header_title"),
      description: t("tour_ordenes_header_desc"),
      selector: '[data-tour="ordenes-header"]',
    },
    { id: "new", title: t("tour_ordenes_new_title"), description: t("tour_ordenes_new_desc"), selector: '[data-tour="ordenes-new"]' },
    { id: "auto-suggest", title: t("tour_ordenes_auto_suggest_title"), description: t("tour_ordenes_auto_suggest_desc"), selector: '[data-tour="ordenes-auto-suggest"]' },
    { id: "search", title: t("tour_ordenes_search_title"), description: t("tour_ordenes_search_desc"), selector: '[data-tour="ordenes-search"]' },
    { id: "row-pdf", title: t("tour_ordenes_row_pdf_title"), description: t("tour_ordenes_row_pdf_desc"), selector: '[data-tour="ordenes-row-pdf"]' },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_ordenes-compra" />
}

// Tour del diálogo de Configuración — a diferencia de los demás tours (montados una
// sola vez por página), este vive DENTRO del contenido del Dialog (ver
// components/settings-dialog.tsx), así que se monta de nuevo cada vez que el diálogo
// se abre — su propia bandera de localStorage (storageKey) se encarga de que solo se
// muestre una vez en la vida del usuario, igual que los demás. Cada paso que apunta a
// una pestaña que no es "Perfil" (la que abre por defecto) usa `beforeShow` para
// hacer clic en su trigger antes de buscar el elemento — si no, el contenido de esa
// pestaña ni siquiera existe en el DOM todavía (Radix Tabs no monta pestañas inactivas).
export function SettingsTour() {
  const { t } = useLanguage()
  // Radix's TabsTrigger cambia de pestaña en su handler de onMouseDown (o onFocus en
  // modo de activación automática) — nunca en onClick. `element.click()` no dispara
  // ninguno de los dos, así que no cambia de pestaña aquí; se simula un mousedown real.
  const clickTab = (id: string) => () => {
    document.getElementById(id)?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }))
  }

  const steps: TourStep[] = [
    {
      id: "tabs",
      title: t("tour_settings_tabs_title"),
      description: t("tour_settings_tabs_desc"),
      selector: '[data-tour="settings-tabs"]',
    },
    {
      id: "profile",
      title: t("tour_settings_profile_title"),
      description: t("tour_settings_profile_desc"),
      selector: '[data-tour="settings-profile-fields"]',
      beforeShow: clickTab("settings-tab-profile"),
    },
    {
      id: "appearance",
      title: t("tour_settings_appearance_title"),
      description: t("tour_settings_appearance_desc"),
      selector: '[data-tour="settings-appearance-theme"]',
      beforeShow: clickTab("settings-tab-appearance"),
    },
    {
      id: "regional",
      title: t("tour_settings_regional_title"),
      description: t("tour_settings_regional_desc"),
      selector: '[data-tour="settings-regional-fields"]',
      beforeShow: clickTab("settings-tab-regional"),
    },
    {
      id: "notifications",
      title: t("tour_settings_notifications_title"),
      description: t("tour_settings_notifications_desc"),
      selector: '[data-tour="settings-notifications-toggles"]',
      beforeShow: clickTab("settings-tab-notifications"),
    },
    {
      id: "developer-backup",
      title: t("tour_settings_developer_backup_title"),
      description: t("tour_settings_developer_backup_desc"),
      selector: '[data-tour="settings-developer-backup"]',
      beforeShow: clickTab("settings-tab-developer"),
    },
    {
      id: "developer-reset",
      title: t("tour_settings_developer_reset_title"),
      description: t("tour_settings_developer_reset_desc"),
      selector: '[data-tour="settings-developer-reset"]',
    },
    {
      id: "save",
      title: t("tour_settings_save_title"),
      description: t("tour_settings_save_desc"),
      selector: '[data-tour="settings-save"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_settings-dialog" />
}

export function EquipoTour({ hasMembers }: { hasMembers: boolean }) {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_equipo_header_title"),
      description: t("tour_equipo_header_desc"),
      selector: '[data-tour="equipo-header"]',
    },
    {
      id: "invite",
      title: t("tour_equipo_invite_title"),
      description: t("tour_equipo_invite_desc"),
      selector: '[data-tour="equipo-invite"]',
    },
    ...(hasMembers
      ? [
          {
            id: "members",
            title: t("tour_equipo_members_title"),
            description: t("tour_equipo_members_desc"),
            selector: '[data-tour="equipo-members"]',
          } as TourStep,
        ]
      : []),
  ]

  return <PageTour steps={steps} storageKey="tour_completed_equipo" />
}

export function MiPlanTour({ hasManageButton }: { hasManageButton: boolean }) {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_miplan_header_title"),
      description: t("tour_miplan_header_desc"),
      selector: '[data-tour="miplan-header"]',
    },
    ...(hasManageButton
      ? [
          {
            id: "manage",
            title: t("tour_miplan_manage_title"),
            description: t("tour_miplan_manage_desc"),
            selector: '[data-tour="miplan-manage"]',
          } as TourStep,
        ]
      : []),
    {
      id: "grid",
      title: t("tour_miplan_grid_title"),
      description: t("tour_miplan_grid_desc"),
      selector: '[data-tour="miplan-grid"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_mi-plan" />
}

export function ProcesarOrdenesTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_procesar_header_title"),
      description: t("tour_procesar_header_desc"),
      selector: '[data-tour="procesar-header"]',
    },
    {
      id: "upload",
      title: t("tour_procesar_upload_title"),
      description: t("tour_procesar_upload_desc"),
      selector: '[data-tour="procesar-upload"]',
    },
    {
      id: "info",
      title: t("tour_procesar_info_title"),
      description: t("tour_procesar_info_desc"),
      selector: '[data-tour="procesar-info"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_procesar-ordenes" />
}

export function BusinessDetailTour({ hasScenarioSection }: { hasScenarioSection: boolean }) {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_business_header_title"),
      description: t("tour_business_header_desc"),
      selector: '[data-tour="business-header"]',
    },
    {
      id: "modules",
      title: t("tour_business_modules_title"),
      description: t("tour_business_modules_desc"),
      selector: '[data-tour="business-modules"]',
    },
    {
      id: "summary",
      title: t("tour_business_summary_title"),
      description: t("tour_business_summary_desc"),
      selector: '[data-tour="business-summary"]',
    },
    ...(hasScenarioSection
      ? [
          {
            id: "scenario",
            title: t("tour_business_scenario_title"),
            description: t("tour_business_scenario_desc"),
            selector: '[data-tour="business-scenario"]',
          } as TourStep,
        ]
      : []),
    {
      id: "activity",
      title: t("tour_business_activity_title"),
      description: t("tour_business_activity_desc"),
      selector: '[data-tour="business-activity"]',
    },
    {
      id: "notifications",
      title: t("tour_business_notifications_title"),
      description: t("tour_business_notifications_desc"),
      selector: '[data-tour="business-notifications"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_business-detail" />
}

export function NegociosTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_negocios_header_title"),
      description: t("tour_negocios_header_desc"),
      selector: '[data-tour="negocios-header"]',
    },
    { id: "new", title: t("tour_negocios_new_title"), description: t("tour_negocios_new_desc"), selector: '[data-tour="negocios-new"]' },
    { id: "stats", title: t("tour_negocios_stats_title"), description: t("tour_negocios_stats_desc"), selector: '[data-tour="negocios-stats"]' },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_negocios" />
}
