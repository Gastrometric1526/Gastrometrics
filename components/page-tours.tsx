"use client"

import { useRef } from "react"

import { useRouter } from "next/navigation"
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
    {
      // Chat de soporte (docs/204): botón de ayuda en la esquina, en todas las pantallas.
      id: "support-chat",
      title: t("tour_support_chat_title"),
      description: t("tour_support_chat_desc"),
      selector: '[data-tour="support-chat"]',
    },
  ]

  return <PageTour steps={steps} storageKey="tour_completed_ficha-tecnica" />
}

export function IngredientesTour({ onOpenImport }: { onOpenImport?: () => void } = {}) {
  const { t } = useLanguage()
  const router = useRouter()
  // Terminar el recorrido abre la importación masiva (docs/145); saltarlo sigue llevando
  // a Ficha Técnica como antes. page-tour.tsx llama a onClose ANTES que a onFinish, así
  // que onClose espera un instante para saber si fue un "terminar".
  const finishedRef = useRef(false)
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_ing_header_title"),
      description: t("tour_ing_header_desc"),
      selector: '[data-tour="ing-header"]',
    },
    // Importar va antes que "Nuevo": traer la lista que ya tienes es lo más rápido (docs/148).
    { id: "import", title: t("tour_ing_import_title"), description: t("tour_ing_import_desc"), selector: '[data-tour="ing-import"]' },
    { id: "new", title: t("tour_ing_new_title"), description: t("tour_ing_new_desc"), selector: '[data-tour="ing-new"]' },
    // Empaques y desechables también son costo del plato — pedido del dueño del proyecto
    // (2026-09-29): que el usuario lo tenga en cuenta desde el primer ingrediente.
    {
      id: "packaging",
      title: t("tour_ing_packaging_title"),
      description: t("tour_ing_packaging_desc"),
      selector: '[data-tour="ing-new"]',
    },
    { id: "search", title: t("tour_ing_search_title"), description: t("tour_ing_search_desc"), selector: '[data-tour="ing-search"]' },
    { id: "unit-switch", title: t("tour_ing_unit_switch_title"), description: t("tour_ing_unit_switch_desc"), selector: '[data-tour="ing-unit-switch"]' },
    { id: "table", title: t("tour_ing_table_title"), description: t("tour_ing_table_desc"), selector: '[data-tour="ing-table"]' },
    // Último paso (docs/145): carga masiva primero, sin esconder la opción manual.
    { id: "bulk", title: t("tour_ing_bulk_title"), description: t("tour_ing_bulk_desc"), selector: '[data-tour="ing-import"]' },
  ]

  // Cierra el recorrido guiado que empieza en el Dashboard (OnboardingTour) → termina
  // acá en Ingredientes: al cerrar ESTE tour, ya sea terminándolo o saltándolo, lleva
  // directo a Ficha Técnica en vez de solo cerrarse — mismo patrón que OnboardingTour
  // usa para llegar hasta acá. Pedido explícito del dueño del proyecto: "forzar al
  // usuario de llevarlo de la mano al ingredientes y luego a ficha técnica" — por eso
  // el redirect vive en onClose (se dispara siempre, saltando o terminando el tour),
  // no en onFinish (que page-tour.tsx solo dispara al terminar el último paso).
  return (
    <PageTour
      steps={steps}
      storageKey="tour_completed_ingredientes"
      finishLabel={onOpenImport ? t("tour_finish_open_import") : t("tour_finish_go_ficha")}
      onFinish={() => {
        finishedRef.current = true
        onOpenImport?.()
      }}
      onClose={() =>
        setTimeout(() => {
          if (!finishedRef.current || !onOpenImport) router.push("/ficha-tecnica")
        }, 0)
      }
    />
  )
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

export function MisRecetasTour({ onOpenImport }: { onOpenImport?: () => void } = {}) {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    {
      id: "header",
      title: t("tour_recetas_header_title"),
      description: t("tour_recetas_header_desc"),
      selector: '[data-tour="recetas-header"]',
    },
    // docs/148: importar las recetas que ya tienes (texto, archivo o foto) es el camino
    // más rápido; el recorrido termina abriendo esa ventana.
    { id: "import", title: t("tour_recetas_import_title"), description: t("tour_recetas_import_desc"), selector: '[data-tour="recetas-import"]' },
    { id: "new", title: t("tour_recetas_new_title"), description: t("tour_recetas_new_desc"), selector: '[data-tour="recetas-new"]' },
    { id: "trash", title: t("tour_recetas_trash_title"), description: t("tour_recetas_trash_desc"), selector: '[data-tour="recetas-trash"]' },
    { id: "stats", title: t("tour_recetas_stats_title"), description: t("tour_recetas_stats_desc"), selector: '[data-tour="recetas-stats"]' },
  ]

  return (
    <PageTour
      steps={steps}
      storageKey="tour_completed_mis-recetas"
      finishLabel={onOpenImport ? t("tour_finish_open_recipe_import") : undefined}
      onFinish={onOpenImport}
    />
  )
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
      id: "mep",
      title: t("tour_menus_mep_title"),
      description: t("tour_menus_mep_desc"),
      selector: '[data-tour="menus-mep"]',
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

// MEP — mise en place de un menú (docs/202).
export function MepTour() {
  const { t } = useLanguage()
  const steps: TourStep[] = [
    { id: "header", title: t("tour_mep_header_title"), description: t("tour_mep_header_desc"), selector: '[data-tour="mep-header"]' },
    { id: "menu", title: t("tour_mep_menu_title"), description: t("tour_mep_menu_desc"), selector: '[data-tour="mep-menu"]' },
    { id: "areas", title: t("tour_mep_areas_title"), description: t("tour_mep_areas_desc"), selector: '[data-tour="mep-areas"]' },
    { id: "preps", title: t("tour_mep_preps_title"), description: t("tour_mep_preps_desc"), selector: '[data-tour="mep-preps"]' },
    { id: "dishes", title: t("tour_mep_dishes_title"), description: t("tour_mep_dishes_desc"), selector: '[data-tour="mep-dishes"]' },
    { id: "progress", title: t("tour_mep_progress_title"), description: t("tour_mep_progress_desc"), selector: '[data-tour="mep-progress"]' },
    { id: "share", title: t("tour_mep_share_title"), description: t("tour_mep_share_desc"), selector: '[data-tour="mep-share"]' },
  ]
  return <PageTour steps={steps} storageKey="tour_completed_mep" />
}

// canAccessFinance viene de useFeatureAccess("stats_finance") en app/estadisticas/page.tsx —
// sin esto, el tour mencionaba y apuntaba a la pestaña Finanzas (import de POS) para
// CUALQUIER plan, incluido Chef de Partie, que no la tiene todavía: el paso caía a un
// recuadro centrado sin nada que resaltar (page-tour.tsx ya tolera un selector que no
// existe), pero seguía describiendo una función bloqueada.
//
// El paso de la pestaña "Ventas" (registro manual dentro de Estadísticas) se quitó de
// este tour cuando ese registro se separó a su propio módulo (/ventas, ver docs/124) —
// la pestaña que este paso resaltaba ya no existe en esta página.
export function EstadisticasTour({
  canAccessFinance,
}: {
  canAccessFinance: boolean
}) {
  const { t } = useLanguage()
  // Igual que en Configuración (ver docs/35): las pestañas son Radix Tabs, así que el
  // contenido de la pestaña inactiva no existe en el DOM hasta que se hace clic — y
  // TabsTrigger reacciona a onMouseDown, no a onClick.
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
      id: "suppliers",
      title: t("tour_stats_suppliers_title"),
      description: t("tour_stats_suppliers_desc"),
      selector: '[data-tour="stats-suppliers"]',
      beforeShow: clickTab("stats-tab-proveedores"),
    },
    {
      id: "price-history",
      title: t("tour_stats_price_history_title"),
      description: t("tour_stats_price_history_desc"),
      selector: '[data-tour="stats-price-history"]',
    },
    {
      id: "merma",
      title: t("tour_stats_merma_title"),
      description: t("tour_stats_merma_desc"),
      selector: '[data-tour="stats-merma"]',
      beforeShow: clickTab("stats-tab-merma"),
    },
    ...(canAccessFinance
      ? [
          {
            id: "finanzas-import",
            title: t("tour_stats_finanzas_import_title"),
            description: t("tour_stats_finanzas_import_desc"),
            selector: '[data-tour="finanzas-import-pos"]',
            beforeShow: clickTab("stats-tab-finanzas"),
          } as TourStep,
          {
            id: "finanzas-key-cards",
            title: t("tour_stats_finanzas_cards_title"),
            description: t("tour_stats_finanzas_cards_desc"),
            selector: '[data-tour="finanzas-key-cards"]',
          } as TourStep,
        ]
      : []),
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
    { id: "row-send", title: t("tour_ordenes_row_send_title"), description: t("tour_ordenes_row_send_desc"), selector: '[data-tour="ordenes-row-send"]' },
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
// showDeveloperTools viene de !isTeamPreview en components/settings-dialog.tsx — sin
// esto, el tour intentaba abrir y explicar la pestaña "Cuenta" (eliminar cuenta)
// incluso para un invitado de equipo, para quien esa pestaña ya no existe en el DOM
// (docs/88) — el paso caía a un recuadro centrado sin nada que resaltar, pero seguía
// describiendo una función a la que no tiene acceso.
export function SettingsTour({ showDeveloperTools = true }: { showDeveloperTools?: boolean } = {}) {
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
    ...(showDeveloperTools
      ? [
          {
            id: "account-delete",
            title: t("tour_settings_account_delete_title"),
            description: t("tour_settings_account_delete_desc"),
            selector: '[data-tour="settings-account-delete"]',
            beforeShow: clickTab("settings-tab-account"),
          } as TourStep,
        ]
      : []),
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
    // Tu plan: vencimiento, siguiente cobro y meses ganados (docs/180).
    { id: "timeline", title: t("tour_plan_timeline_title"), description: t("tour_plan_timeline_desc"), selector: '[data-tour="plan-timeline"]' },
    // Regala un mes, gana un mes, dentro de Mi Plan (docs/179, docs/181).
    { id: "invita", title: t("tour_invita_header_title"), description: t("tour_invita_header_desc"), selector: '[data-tour="invita-header"]' },
    { id: "invita-link", title: t("tour_invita_link_title"), description: t("tour_invita_link_desc"), selector: '[data-tour="invita-link"]' },
    { id: "invita-list", title: t("tour_invita_list_title"), description: t("tour_invita_list_desc"), selector: '[data-tour="invita-list"]' },
    { id: "invita-rules", title: t("tour_invita_rules_title"), description: t("tour_invita_rules_desc"), selector: '[data-tour="invita-rules"]' },
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
    // Cancelar suscripción, borrar contenido y eliminar cuenta (docs/182).
    { id: "account", title: t("tour_miplan_account_title"), description: t("tour_miplan_account_desc"), selector: '[data-tour="miplan-account"]' },
    // Vencimiento, cuenta regresiva y pago programado (docs/165).
    {
      id: "expiry",
      title: t("tour_miplan_expiry_title"),
      description: t("tour_miplan_expiry_desc"),
      selector: '[data-tour="sidebar-plan"]',
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
