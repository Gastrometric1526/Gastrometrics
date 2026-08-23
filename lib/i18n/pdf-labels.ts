// Etiquetas usadas en los PDFs generados por lib/pdf/recipe-pdf-generator.ts.
// Separado de lib/i18n/translations.ts (que es para la interfaz) porque son cadenas
// distintas y así no se mezclan los dos catálogos. Ver documento de continuidad.
//
// La generación de PDF ocurre en una función plana (no un componente de React), así
// que no puede usar el hook useLanguage() — por eso lee el idioma actual directo de
// localStorage, con el mismo patrón que ya usa lib/currency.ts.

import type { LanguageCode } from "@/lib/i18n/translations"

export interface PdfLabels {
  nombre: string
  clasificacion: string
  plato: string
  etapaEstacion: string
  porciones: string
  rendimiento: string
  ingredientes: string
  categoria: string
  ingrediente: string
  cant: string
  cantidad: string
  medida: string
  unidad: string
  costo: string
  extension: string
  general: string
  concepto: string
  monto: string
  notas: string
  procedimiento: string
  marketing: string
  total: string
  ultimaRevision: string
  exportado: string
  pagina: string
  de: string
  serviciosPublicos: string
  costosOperativos: string
  costosLaborales: string
  gananciaNeta: string
  copiaAdministrativa: string
  copiaCocina: string
  fecha: string
  creado: string
  locale: string
  observaciones: string
  estadisticas: string
  costoPorcentaje: string
  margenContribucion: string
  metodoPrecio: string
  precioSugerido: string
  y: string
  ordenCompra: string
  proveedor: string
  sinProveedor: string
  presentacion: string
  numero: string
  itemsOrden: string
  totalOrden: string
  inventario: string
  reporteInventario: string
  stockActual: string
  stockMinimo: string
  valorizado: string
  critico: string
  bajo: string
  normal: string
  estado: string
  resumenGeneral: string
  distribucionCategoria: string
  productosRegistrados: string
  valorTotalInventario: string
  ubicacion: string
}

const PDF_LABELS: Record<LanguageCode, PdfLabels> = {
  es: {
    nombre: "Nombre:",
    clasificacion: "Clasificacion:",
    plato: "Plato:",
    etapaEstacion: "Etapa/Estacion:",
    porciones: "Porciones:",
    rendimiento: "Rendimiento:",
    ingredientes: "Ingredientes",
    categoria: "Categoria",
    ingrediente: "Ingrediente",
    cant: "Cant.",
    cantidad: "Cantidad",
    medida: "Medida",
    unidad: "Unidad",
    costo: "Costo",
    extension: "Extension",
    general: "General",
    concepto: "Concepto",
    monto: "Monto",
    notas: "Notas",
    procedimiento: "Procedimiento",
    marketing: "Marketing",
    total: "TOTAL",
    ultimaRevision: "Ultima revision",
    exportado: "Exportado",
    pagina: "Pagina",
    de: "de",
    serviciosPublicos: "Servicios Publicos",
    costosOperativos: "Costos Operativos",
    costosLaborales: "Costos Laborales",
    gananciaNeta: "Ganancia Neta",
    copiaAdministrativa: "COPIA ADMINISTRATIVA - CONFIDENCIAL",
    copiaCocina: "COPIA DE COCINA",
    fecha: "Fecha",
    creado: "Creado",
    locale: "es-HN",
    observaciones: "Observaciones",
    estadisticas: "Estadisticas",
    costoPorcentaje: "Costo %",
    margenContribucion: "Margen de Contribucion",
    metodoPrecio: "Metodo de Precio",
    precioSugerido: "Precio Sugerido",
    y: "y",
    ordenCompra: "Orden de Compra",
    proveedor: "Proveedor",
    sinProveedor: "Sin proveedor",
    presentacion: "Presentacion",
    numero: "No.",
    itemsOrden: "Items",
    totalOrden: "Total de la Orden",
    inventario: "Inventario",
    reporteInventario: "Reporte de Inventario",
    stockActual: "Stock Actual",
    stockMinimo: "Stock Minimo",
    valorizado: "Valorizado",
    critico: "Critico",
    bajo: "Bajo",
    normal: "Normal",
    estado: "Estado",
    resumenGeneral: "Resumen General",
    distribucionCategoria: "Distribucion por Categoria",
    productosRegistrados: "Productos Registrados",
    valorTotalInventario: "Valor Total de Inventario",
    ubicacion: "Ubicacion",
  },
  en: {
    nombre: "Name:",
    clasificacion: "Classification:",
    plato: "Course:",
    etapaEstacion: "Stage/Station:",
    porciones: "Servings:",
    rendimiento: "Yield:",
    ingredientes: "Ingredients",
    categoria: "Category",
    ingrediente: "Ingredient",
    cant: "Qty.",
    cantidad: "Quantity",
    medida: "Measure",
    unidad: "Unit",
    costo: "Cost",
    extension: "Extension",
    general: "General",
    concepto: "Item",
    monto: "Amount",
    notas: "Notes",
    procedimiento: "Procedure",
    marketing: "Marketing",
    total: "TOTAL",
    ultimaRevision: "Last revised",
    exportado: "Exported",
    pagina: "Page",
    de: "of",
    serviciosPublicos: "Utilities",
    costosOperativos: "Operating Costs",
    costosLaborales: "Labor Costs",
    gananciaNeta: "Net Profit",
    copiaAdministrativa: "ADMINISTRATIVE COPY - CONFIDENTIAL",
    copiaCocina: "KITCHEN COPY",
    fecha: "Date",
    creado: "Created",
    locale: "en-US",
    observaciones: "Observations",
    estadisticas: "Statistics",
    costoPorcentaje: "Food Cost %",
    margenContribucion: "Contribution Margin",
    metodoPrecio: "Pricing Method",
    precioSugerido: "Suggested Price",
    y: "and",
    ordenCompra: "Purchase Order",
    proveedor: "Supplier",
    sinProveedor: "No supplier",
    presentacion: "Packaging",
    numero: "No.",
    itemsOrden: "Items",
    totalOrden: "Order Total",
    inventario: "Inventory",
    reporteInventario: "Inventory Report",
    stockActual: "Current Stock",
    stockMinimo: "Minimum Stock",
    valorizado: "Valued",
    critico: "Critical",
    bajo: "Low",
    normal: "Normal",
    estado: "Status",
    resumenGeneral: "General Summary",
    distribucionCategoria: "Distribution by Category",
    productosRegistrados: "Registered Products",
    valorTotalInventario: "Total Inventory Value",
    ubicacion: "Location",
  },
  da: {
    nombre: "Navn:",
    clasificacion: "Klassificering:",
    plato: "Ret:",
    etapaEstacion: "Trin/Station:",
    porciones: "Portioner:",
    rendimiento: "Udbytte:",
    ingredientes: "Ingredienser",
    categoria: "Kategori",
    ingrediente: "Ingrediens",
    cant: "Ant.",
    cantidad: "Mængde",
    medida: "Mål",
    unidad: "Enhed",
    costo: "Pris",
    extension: "I alt",
    general: "Generel",
    concepto: "Post",
    monto: "Beløb",
    notas: "Noter",
    procedimiento: "Fremgangsmåde",
    marketing: "Markedsføring",
    total: "TOTAL",
    ultimaRevision: "Sidst redigeret",
    exportado: "Eksporteret",
    pagina: "Side",
    de: "af",
    serviciosPublicos: "Forsyning",
    costosOperativos: "Driftsomkostninger",
    costosLaborales: "Lønomkostninger",
    gananciaNeta: "Nettoresultat",
    copiaAdministrativa: "ADMINISTRATIV KOPI - FORTROLIGT",
    copiaCocina: "KØKKENKOPI",
    fecha: "Dato",
    creado: "Oprettet",
    locale: "da-DK",
    observaciones: "Bemærkninger",
    estadisticas: "Statistik",
    costoPorcentaje: "Fødevareomkostning %",
    margenContribucion: "Dækningsbidrag",
    metodoPrecio: "Prismetode",
    precioSugerido: "Foreslået pris",
    y: "og",
    ordenCompra: "Indkøbsordre",
    proveedor: "Leverandør",
    sinProveedor: "Ingen leverandør",
    presentacion: "Emballage",
    numero: "Nr.",
    itemsOrden: "Varer",
    totalOrden: "Ordretotal",
    inventario: "Lager",
    reporteInventario: "Lagerrapport",
    stockActual: "Nuværende lager",
    stockMinimo: "Minimumslager",
    valorizado: "Værdisat",
    critico: "Kritisk",
    bajo: "Lavt",
    normal: "Normalt",
    estado: "Status",
    resumenGeneral: "Generel oversigt",
    distribucionCategoria: "Fordeling efter kategori",
    productosRegistrados: "Registrerede produkter",
    valorTotalInventario: "Samlet lagerværdi",
    ubicacion: "Placering",
  },
  fr: {
    nombre: "Nom :",
    clasificacion: "Classification :",
    plato: "Plat :",
    etapaEstacion: "Étape/Poste :",
    porciones: "Portions :",
    rendimiento: "Rendement :",
    ingredientes: "Ingrédients",
    categoria: "Catégorie",
    ingrediente: "Ingrédient",
    cant: "Qté",
    cantidad: "Quantité",
    medida: "Mesure",
    unidad: "Unité",
    costo: "Coût",
    extension: "Total",
    general: "Général",
    concepto: "Poste",
    monto: "Montant",
    notas: "Notes",
    procedimiento: "Procédure",
    marketing: "Marketing",
    total: "TOTAL",
    ultimaRevision: "Dernière révision",
    exportado: "Exporté",
    pagina: "Page",
    de: "sur",
    serviciosPublicos: "Services publics",
    costosOperativos: "Coûts opérationnels",
    costosLaborales: "Coûts de main-d'œuvre",
    gananciaNeta: "Bénéfice net",
    copiaAdministrativa: "COPIE ADMINISTRATIVE - CONFIDENTIEL",
    copiaCocina: "COPIE CUISINE",
    fecha: "Date",
    creado: "Créé le",
    locale: "fr-FR",
    observaciones: "Observations",
    estadisticas: "Statistiques",
    costoPorcentaje: "Cout Matiere %",
    margenContribucion: "Marge de Contribution",
    metodoPrecio: "Methode de Prix",
    precioSugerido: "Prix Suggere",
    y: "et",
    ordenCompra: "Bon de Commande",
    proveedor: "Fournisseur",
    sinProveedor: "Sans fournisseur",
    presentacion: "Conditionnement",
    numero: "No.",
    itemsOrden: "Articles",
    totalOrden: "Total de la Commande",
    inventario: "Inventaire",
    reporteInventario: "Rapport d'Inventaire",
    stockActual: "Stock Actuel",
    stockMinimo: "Stock Minimum",
    valorizado: "Valorise",
    critico: "Critique",
    bajo: "Bas",
    normal: "Normal",
    estado: "Statut",
    resumenGeneral: "Resume General",
    distribucionCategoria: "Repartition par Categorie",
    productosRegistrados: "Produits Enregistres",
    valorTotalInventario: "Valeur Totale de l'Inventaire",
    ubicacion: "Emplacement",
  },
  pt: {
    nombre: "Nome:",
    clasificacion: "Classificação:",
    plato: "Prato:",
    etapaEstacion: "Etapa/Estação:",
    porciones: "Porções:",
    rendimiento: "Rendimento:",
    ingredientes: "Ingredientes",
    categoria: "Categoria",
    ingrediente: "Ingrediente",
    cant: "Qtd.",
    cantidad: "Quantidade",
    medida: "Medida",
    unidad: "Unidade",
    costo: "Custo",
    extension: "Total",
    general: "Geral",
    concepto: "Item",
    monto: "Valor",
    notas: "Notas",
    procedimiento: "Procedimento",
    marketing: "Marketing",
    total: "TOTAL",
    ultimaRevision: "Última revisão",
    exportado: "Exportado",
    pagina: "Página",
    de: "de",
    serviciosPublicos: "Serviços Públicos",
    costosOperativos: "Custos Operacionais",
    costosLaborales: "Custos Trabalhistas",
    gananciaNeta: "Lucro Líquido",
    copiaAdministrativa: "CÓPIA ADMINISTRATIVA - CONFIDENCIAL",
    copiaCocina: "CÓPIA DE COZINHA",
    fecha: "Data",
    creado: "Criado",
    locale: "pt-BR",
    observaciones: "Observacoes",
    estadisticas: "Estatisticas",
    costoPorcentaje: "Custo %",
    margenContribucion: "Margem de Contribuicao",
    metodoPrecio: "Metodo de Preco",
    precioSugerido: "Preco Sugerido",
    y: "e",
    ordenCompra: "Pedido de Compra",
    proveedor: "Fornecedor",
    sinProveedor: "Sem fornecedor",
    presentacion: "Embalagem",
    numero: "No.",
    itemsOrden: "Itens",
    totalOrden: "Total do Pedido",
    inventario: "Estoque",
    reporteInventario: "Relatorio de Estoque",
    stockActual: "Estoque Atual",
    stockMinimo: "Estoque Minimo",
    valorizado: "Valorizado",
    critico: "Critico",
    bajo: "Baixo",
    normal: "Normal",
    estado: "Status",
    resumenGeneral: "Resumo Geral",
    distribucionCategoria: "Distribuicao por Categoria",
    productosRegistrados: "Produtos Registrados",
    valorTotalInventario: "Valor Total do Estoque",
    ubicacion: "Localizacao",
  },
  zh: {
    nombre: "名称：",
    clasificacion: "分类：",
    plato: "菜品：",
    etapaEstacion: "阶段/工位：",
    porciones: "份数：",
    rendimiento: "产量：",
    ingredientes: "食材",
    categoria: "类别",
    ingrediente: "食材",
    cant: "数量",
    cantidad: "数量",
    medida: "计量",
    unidad: "单位",
    costo: "成本",
    extension: "小计",
    general: "常规",
    concepto: "项目",
    monto: "金额",
    notas: "备注",
    procedimiento: "步骤",
    marketing: "营销",
    total: "总计",
    ultimaRevision: "最后修改",
    exportado: "导出时间",
    pagina: "第",
    de: "页，共",
    serviciosPublicos: "水电费",
    costosOperativos: "运营成本",
    costosLaborales: "人工成本",
    gananciaNeta: "净利润",
    copiaAdministrativa: "管理版 - 保密",
    copiaCocina: "厨房版",
    fecha: "日期",
    creado: "创建于",
    locale: "zh-CN",
    observaciones: "备注说明",
    estadisticas: "统计数据",
    costoPorcentaje: "成本率 %",
    margenContribucion: "边际贡献率",
    metodoPrecio: "定价方法",
    precioSugerido: "建议价格",
    y: "与",
    ordenCompra: "采购订单",
    proveedor: "供应商",
    sinProveedor: "无供应商",
    presentacion: "包装规格",
    numero: "编号",
    itemsOrden: "项目",
    totalOrden: "订单总额",
    inventario: "库存",
    reporteInventario: "库存报告",
    stockActual: "当前库存",
    stockMinimo: "最低库存",
    valorizado: "估值",
    critico: "紧急",
    bajo: "偏低",
    normal: "正常",
    estado: "状态",
    resumenGeneral: "总体摘要",
    distribucionCategoria: "按类别分布",
    productosRegistrados: "已登记产品",
    valorTotalInventario: "库存总价值",
    ubicacion: "位置",
  },
}

const LANGUAGE_STORAGE_KEY = "app_language"

export function getCurrentPdfLanguage(): LanguageCode {
  if (typeof window === "undefined") return "es"
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as LanguageCode | null
  return saved && PDF_LABELS[saved] ? saved : "es"
}

export function getPdfLabels(): PdfLabels {
  return PDF_LABELS[getCurrentPdfLanguage()]
}
