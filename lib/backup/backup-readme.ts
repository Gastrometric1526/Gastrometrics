/**
 * LEEME.txt del respaldo (docs/223): qué contiene, qué no y cómo usarlo, en el idioma de la
 * persona. Puro, probado en backup-readme.test.ts.
 */

import type { LanguageCode } from "@/lib/i18n/translations"
import { formatDateTime } from "@/lib/date-format"

export interface BackupScopeCounts {
  label: string
  ingredients: number
  recipes: number
  menus: number
  inventory: number
  purchaseOrders: number
  invoices: number
  salesImports: number
  recipePdfs: number
  menuPdfs: number
}

interface ReadmeText {
  title: string
  date: string
  currency: string
  format: string
  spaces: string
  main: string
  rows: [keyof Omit<BackupScopeCounts, "label">, string][]
  includedTitle: string
  included: string[]
  excludedTitle: string
  excluded: string[]
  useTitle: string
  use: string[]
}

const TEXT: Record<LanguageCode, ReadmeText> = {
  es: {
    title: "Respaldo de GastroMetrics",
    date: "Fecha del respaldo",
    currency: "Moneda",
    format: "Versión del formato",
    spaces: "Espacios incluidos",
    main: "Principal",
    rows: [
      ["ingredients", "Ingredientes"],
      ["recipes", "Recetas"],
      ["menus", "Menús"],
      ["inventory", "Productos de inventario"],
      ["purchaseOrders", "Órdenes de compra"],
      ["invoices", "Facturas"],
      ["salesImports", "Registros de ventas"],
      ["recipePdfs", "PDF de recetas"],
      ["menuPdfs", "PDF de menús"],
    ],
    includedTitle: "Qué contiene",
    included: [
      "datos.json: todos los datos de cada espacio con sus identificadores, para que recetas, menús, inventario y órdenes sigan unidos a sus ingredientes.",
      "Cada registro de ventas con cuadre de caja incluye el resultado calculado (cashUpResult): lo esperado, lo contado y la diferencia.",
      "pdfs/: la ficha administrativa de cada receta y la carta de cada menú.",
    ],
    excludedTitle: "Qué no contiene",
    excluded: [
      "Contraseñas, sesiones ni datos de pago (nunca se exportan).",
      "Tu equipo y sus permisos, tu plan y tus cobros: los ves en Mi Plan y en Equipo.",
      "El historial de actividad y las notificaciones.",
    ],
    useTitle: "Cómo usarlo",
    use: [
      "Guarda este archivo en un lugar seguro. Puedes abrir los PDF directamente y datos.json con cualquier editor de texto.",
      "Por ahora la app no lo vuelve a importar automáticamente: es una copia para guardar y consultar. Tus datos siguen guardados en tu cuenta.",
    ],
  },
  en: {
    title: "GastroMetrics backup",
    date: "Backup date",
    currency: "Currency",
    format: "Format version",
    spaces: "Spaces included",
    main: "Main",
    rows: [
      ["ingredients", "Ingredients"],
      ["recipes", "Recipes"],
      ["menus", "Menus"],
      ["inventory", "Inventory products"],
      ["purchaseOrders", "Purchase orders"],
      ["invoices", "Invoices"],
      ["salesImports", "Sales records"],
      ["recipePdfs", "Recipe PDFs"],
      ["menuPdfs", "Menu PDFs"],
    ],
    includedTitle: "What it contains",
    included: [
      "datos.json: all the data of each space with its identifiers, so recipes, menus, inventory and orders stay linked to their ingredients.",
      "Each sales record with a cash-up includes the calculated result (cashUpResult): expected, counted and the difference.",
      "pdfs/: the administrative sheet of each recipe and the card of each menu.",
    ],
    excludedTitle: "What it doesn't contain",
    excluded: [
      "Passwords, sessions or payment details (never exported).",
      "Your team and its permissions, your plan and your charges: see them in My Plan and Team.",
      "The activity history and notifications.",
    ],
    useTitle: "How to use it",
    use: [
      "Keep this file somewhere safe. You can open the PDFs directly and datos.json with any text editor.",
      "For now the app doesn't import it back automatically: it's a copy to keep and consult. Your data stays saved in your account.",
    ],
  },
  da: {
    title: "GastroMetrics-backup",
    date: "Backupdato",
    currency: "Valuta",
    format: "Formatversion",
    spaces: "Medtagne områder",
    main: "Hovedområde",
    rows: [
      ["ingredients", "Ingredienser"],
      ["recipes", "Opskrifter"],
      ["menus", "Menuer"],
      ["inventory", "Lagerprodukter"],
      ["purchaseOrders", "Indkøbsordrer"],
      ["invoices", "Fakturaer"],
      ["salesImports", "Salgsregistreringer"],
      ["recipePdfs", "Opskrift-PDF'er"],
      ["menuPdfs", "Menu-PDF'er"],
    ],
    includedTitle: "Hvad den indeholder",
    included: [
      "datos.json: alle data for hvert område med deres id'er, så opskrifter, menuer, lager og ordrer forbliver koblet til deres ingredienser.",
      "Hver salgsregistrering med kasseafstemning indeholder det beregnede resultat (cashUpResult): forventet, optalt og forskellen.",
      "pdfs/: det administrative ark for hver opskrift og kortet for hver menu.",
    ],
    excludedTitle: "Hvad den ikke indeholder",
    excluded: [
      "Adgangskoder, sessioner eller betalingsoplysninger (eksporteres aldrig).",
      "Dit team og dets rettigheder, din plan og dine betalinger: se dem i Min plan og Team.",
      "Aktivitetshistorikken og notifikationerne.",
    ],
    useTitle: "Sådan bruger du den",
    use: [
      "Gem filen et sikkert sted. Du kan åbne PDF'erne direkte og datos.json med en hvilken som helst teksteditor.",
      "Indtil videre importerer appen den ikke automatisk igen: det er en kopi til at gemme og slå op i. Dine data forbliver gemt på din konto.",
    ],
  },
  fr: {
    title: "Sauvegarde GastroMetrics",
    date: "Date de la sauvegarde",
    currency: "Devise",
    format: "Version du format",
    spaces: "Espaces inclus",
    main: "Principal",
    rows: [
      ["ingredients", "Ingrédients"],
      ["recipes", "Recettes"],
      ["menus", "Menus"],
      ["inventory", "Produits d'inventaire"],
      ["purchaseOrders", "Bons de commande"],
      ["invoices", "Factures"],
      ["salesImports", "Registres de ventes"],
      ["recipePdfs", "PDF des recettes"],
      ["menuPdfs", "PDF des menus"],
    ],
    includedTitle: "Ce qu'elle contient",
    included: [
      "datos.json : toutes les données de chaque espace avec leurs identifiants, pour que recettes, menus, inventaire et commandes restent liés à leurs ingrédients.",
      "Chaque registre de ventes avec clôture de caisse inclut le résultat calculé (cashUpResult) : attendu, compté et l'écart.",
      "pdfs/ : la fiche administrative de chaque recette et la carte de chaque menu.",
    ],
    excludedTitle: "Ce qu'elle ne contient pas",
    excluded: [
      "Mots de passe, sessions ou données de paiement (jamais exportés).",
      "Votre équipe et ses autorisations, votre forfait et vos paiements : consultez-les dans Mon forfait et Équipe.",
      "L'historique d'activité et les notifications.",
    ],
    useTitle: "Comment l'utiliser",
    use: [
      "Conservez ce fichier en lieu sûr. Vous pouvez ouvrir les PDF directement et datos.json avec n'importe quel éditeur de texte.",
      "Pour l'instant, l'application ne la réimporte pas automatiquement : c'est une copie à conserver et à consulter. Vos données restent enregistrées dans votre compte.",
    ],
  },
  pt: {
    title: "Backup do GastroMetrics",
    date: "Data do backup",
    currency: "Moeda",
    format: "Versão do formato",
    spaces: "Espaços incluídos",
    main: "Principal",
    rows: [
      ["ingredients", "Ingredientes"],
      ["recipes", "Receitas"],
      ["menus", "Cardápios"],
      ["inventory", "Produtos de inventário"],
      ["purchaseOrders", "Ordens de compra"],
      ["invoices", "Faturas"],
      ["salesImports", "Registros de vendas"],
      ["recipePdfs", "PDFs de receitas"],
      ["menuPdfs", "PDFs de cardápios"],
    ],
    includedTitle: "O que contém",
    included: [
      "datos.json: todos os dados de cada espaço com seus identificadores, para que receitas, cardápios, inventário e ordens continuem ligados aos seus ingredientes.",
      "Cada registro de vendas com fechamento de caixa inclui o resultado calculado (cashUpResult): esperado, contado e a diferença.",
      "pdfs/: a ficha administrativa de cada receita e o cardápio de cada menu.",
    ],
    excludedTitle: "O que não contém",
    excluded: [
      "Senhas, sessões ou dados de pagamento (nunca são exportados).",
      "Sua equipe e permissões, seu plano e suas cobranças: veja em Meu plano e Equipe.",
      "O histórico de atividade e as notificações.",
    ],
    useTitle: "Como usar",
    use: [
      "Guarde este arquivo num lugar seguro. Você pode abrir os PDFs diretamente e o datos.json com qualquer editor de texto.",
      "Por enquanto o app não o importa de volta automaticamente: é uma cópia para guardar e consultar. Seus dados continuam salvos na sua conta.",
    ],
  },
  zh: {
    title: "GastroMetrics 备份",
    date: "备份日期",
    currency: "货币",
    format: "格式版本",
    spaces: "包含的空间",
    main: "主空间",
    rows: [
      ["ingredients", "食材"],
      ["recipes", "配方"],
      ["menus", "套餐"],
      ["inventory", "库存产品"],
      ["purchaseOrders", "采购订单"],
      ["invoices", "发票"],
      ["salesImports", "销售记录"],
      ["recipePdfs", "配方 PDF"],
      ["menuPdfs", "套餐 PDF"],
    ],
    includedTitle: "包含内容",
    included: [
      "datos.json：每个空间的全部数据及其标识符，配方、套餐、库存和订单与食材的关联得以保留。",
      "每条带收银对账的销售记录都包含计算结果（cashUpResult）：应有金额、清点金额和差额。",
      "pdfs/：每个配方的管理表和每个套餐的菜单。",
    ],
    excludedTitle: "不包含的内容",
    excluded: [
      "密码、会话或支付信息（从不导出）。",
      "你的团队及权限、套餐和扣款：请在“我的套餐”和“团队”中查看。",
      "活动记录和通知。",
    ],
    useTitle: "如何使用",
    use: [
      "请将此文件保存在安全的地方。PDF 可直接打开，datos.json 可用任何文本编辑器打开。",
      "目前应用还不能自动重新导入：这是一份用于保存和查阅的副本。你的数据仍保存在你的账户中。",
    ],
  },
}

export function buildBackupReadme(input: {
  language: LanguageCode
  exportedAt: string
  currency: string
  formatVersion: number
  counts: BackupScopeCounts[]
}): string {
  const tx = TEXT[input.language] ?? TEXT.es
  const lines: string[] = [
    tx.title,
    "=".repeat(tx.title.length),
    "",
    `${tx.date}: ${formatDateTime(input.exportedAt)}`,
    `${tx.currency}: ${input.currency}`,
    `${tx.format}: ${input.formatVersion}`,
    "",
    `${tx.spaces}:`,
  ]
  for (const scope of input.counts) {
    lines.push("", `  ${scope.label === "main" ? tx.main : scope.label}`)
    for (const [key, label] of tx.rows) lines.push(`    ${label}: ${scope[key]}`)
  }
  const section = (title: string, items: string[]) => ["", title, ...items.map((i) => `  - ${i}`)]
  lines.push(...section(tx.includedTitle, tx.included), ...section(tx.excludedTitle, tx.excluded), ...section(tx.useTitle, tx.use), "")
  return lines.join("\r\n")
}
