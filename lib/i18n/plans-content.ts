/**
 * Contenido traducible de cada plan (precio, tagline, descripción, y las listas de
 * funciones incluidas/bloqueadas) — separado de lib/plans.ts a propósito: ese archivo
 * es la fuente de verdad de la LÓGICA de negocio por plan (unlockedFeatures,
 * maxBusinesses, maxUsers, comingSoon) y esos campos NUNCA deben variar por idioma. El
 * NOMBRE del plan ("Foodie", "Chef Ejecutivo", etc.) tampoco se traduce a propósito —
 * pedido explícito del dueño del proyecto: son nombres propios de la marca, no
 * descripciones. Ver getLocalizedPlan()/getLocalizedPlans() en lib/plans.ts, que
 * combinan este contenido con los datos de lib/plans.ts según el idioma activo.
 */

import type { LanguageCode } from "./translations"

export interface PlanLocalizedContent {
  price: string
  tagline: string
  description: string
  features: string[]
  locked: string[]
}

export const planContentByLanguage: Record<LanguageCode, Record<string, PlanLocalizedContent>> = {
  es: {
    foodie: {
      price: "Gratis",
      tagline: "Para empezar a organizar tus recetas",
      description: "Base de datos, fichas técnicas ilimitadas, exportación de receta en PDF de cocina.",
      features: [
        "Base de datos de ingredientes",
        "Fichas técnicas ilimitadas",
        "Importación desde Excel",
        "Exportar PDF de cocina (ingredientes y procedimiento, sin costos)",
      ],
      locked: [
        "Sistema de merma",
        "PDF administrativo (con costos y rentabilidad)",
        "Órdenes de compra",
        "Inventario",
        "Menús",
        "Estadísticas y Finanzas",
      ],
    },
    "home-cook": {
      price: "$15/mes",
      tagline: "Para quien ya calcula costos en serio",
      description: "Todo lo de Foodie, más sistema de merma, órdenes de compra manuales y PDF administrativo.",
      features: [
        "Todo lo del plan Foodie",
        "Sistema de merma",
        "Órdenes de compra manuales",
        "PDF administrativo (con costos y rentabilidad)",
      ],
      locked: ["Inventario y auto-sugerencia de órdenes", "Menús", "Estadísticas y Finanzas avanzadas", "Multi-negocio"],
    },
    "chef-de-partie": {
      price: "$35/mes",
      tagline: "Para operar una cocina completa",
      description: "Todo lo anterior, más inventario completo, órdenes automáticas, menús y estadísticas de uso.",
      features: [
        "Todo lo del plan Home Cook",
        "Inventario completo (stock y alertas)",
        "Órdenes de compra automáticas (desde menús y stock bajo)",
        "Menús completos (con escalado por PAX)",
        "1 negocio",
        "Estadísticas de uso (panorama del negocio)",
      ],
      locked: ["Finanzas completas (P&L, importación de POS, Menu Engineering)", "Multi-negocio", "Usuarios extra"],
    },
    "sous-chef": {
      price: "$70/mes",
      tagline: "El control total de tu negocio",
      description:
        "Todo lo anterior, más finanzas completas: P&L real, importación de ventas del POS, Menu Engineering y varianza de precios de proveedores.",
      features: [
        "Todo lo del plan Chef de Partie",
        "Finanzas completas: P&L, importación de ventas del POS",
        "Menu Engineering (Estrellas, Vacas, Puzzles, Perros)",
        "Varianza de precios de proveedores",
        "Dashboard financiero histórico",
        "Hasta 2 negocios sincronizados",
        "Hasta 2 usuarios en la misma cuenta",
      ],
      locked: ["Multi-negocio masivo (+5)", "Soporte prioritario", "Usuarios ilimitados"],
    },
    "chef-ejecutivo": {
      price: "$120/mes",
      tagline: "Para grupos y cadenas",
      description: "Todo lo anterior, más hasta 5 negocios, 5 usuarios, soporte prioritario y onboarding personalizado.",
      features: [
        "Todo lo del plan Sous Chef",
        "Hasta 5 negocios sincronizados",
        "Hasta 5 usuarios",
        "Soporte prioritario",
        "Onboarding personalizado",
        "Importación de datos asistida",
      ],
      locked: [],
    },
  },
  en: {
    foodie: {
      price: "Free",
      tagline: "To start organizing your recipes",
      description: "Ingredient database, unlimited recipe sheets, kitchen PDF recipe export.",
      features: [
        "Ingredient database",
        "Unlimited recipe sheets",
        "Excel import",
        "Kitchen PDF export (ingredients and procedure, no costs)",
      ],
      locked: [
        "Waste system",
        "Administrative PDF (with costs and profitability)",
        "Purchase orders",
        "Inventory",
        "Menus",
        "Statistics and Finance",
      ],
    },
    "home-cook": {
      price: "$15/mo",
      tagline: "For those already calculating costs seriously",
      description: "Everything in Foodie, plus a waste system, manual purchase orders, and administrative PDF.",
      features: [
        "Everything in the Foodie plan",
        "Waste system",
        "Manual purchase orders",
        "Administrative PDF (with costs and profitability)",
      ],
      locked: ["Inventory and order auto-suggestion", "Menus", "Advanced Statistics and Finance", "Multi-business"],
    },
    "chef-de-partie": {
      price: "$35/mo",
      tagline: "To run a full kitchen",
      description: "Everything above, plus full inventory, automatic orders, menus, and usage statistics.",
      features: [
        "Everything in the Home Cook plan",
        "Full inventory (stock and alerts)",
        "Automatic purchase orders (from menus and low stock)",
        "Full menus (with per-diner scaling)",
        "1 business",
        "Usage statistics (business overview)",
      ],
      locked: ["Full finance (P&L, POS import, Menu Engineering)", "Multi-business", "Extra users"],
    },
    "sous-chef": {
      price: "$70/mo",
      tagline: "Total control of your business",
      description:
        "Everything above, plus full finance: real P&L, POS sales import, Menu Engineering, and supplier price variance.",
      features: [
        "Everything in the Chef de Partie plan",
        "Full finance: P&L, POS sales import",
        "Menu Engineering (Stars, Cows, Puzzles, Dogs)",
        "Supplier price variance",
        "Historical financial dashboard",
        "Up to 2 synced businesses",
        "Up to 2 users on the same account",
      ],
      locked: ["Large-scale multi-business (+5)", "Priority support", "Unlimited users"],
    },
    "chef-ejecutivo": {
      price: "$120/mo",
      tagline: "For groups and chains",
      description: "Everything above, plus up to 5 businesses, 5 users, priority support, and personalized onboarding.",
      features: [
        "Everything in the Sous Chef plan",
        "Up to 5 synced businesses",
        "Up to 5 users",
        "Priority support",
        "Personalized onboarding",
        "Assisted data import",
      ],
      locked: [],
    },
  },
  da: {
    foodie: {
      price: "Gratis",
      tagline: "Til at begynde at organisere dine opskrifter",
      description: "Ingrediensdatabase, ubegrænsede opskriftsark, PDF-eksport af køkkenopskrift.",
      features: [
        "Ingrediensdatabase",
        "Ubegrænsede opskriftsark",
        "Excel-import",
        "Eksportér køkken-PDF (ingredienser og fremgangsmåde, uden omkostninger)",
      ],
      locked: [
        "Spildsystem",
        "Administrativ PDF (med omkostninger og rentabilitet)",
        "Indkøbsordrer",
        "Lager",
        "Menuer",
        "Statistik og økonomi",
      ],
    },
    "home-cook": {
      price: "$15/md",
      tagline: "For dig der allerede beregner omkostninger seriøst",
      description: "Alt fra Foodie, plus spildsystem, manuelle indkøbsordrer og administrativ PDF.",
      features: [
        "Alt fra Foodie-planen",
        "Spildsystem",
        "Manuelle indkøbsordrer",
        "Administrativ PDF (med omkostninger og rentabilitet)",
      ],
      locked: ["Lager og automatisk ordreforslag", "Menuer", "Avanceret statistik og økonomi", "Flere virksomheder"],
    },
    "chef-de-partie": {
      price: "$35/md",
      tagline: "Til at drive et komplet køkken",
      description: "Alt ovenstående, plus fuldt lager, automatiske ordrer, menuer og brugsstatistik.",
      features: [
        "Alt fra Home Cook-planen",
        "Fuldt lager (beholdning og advarsler)",
        "Automatiske indkøbsordrer (fra menuer og lav beholdning)",
        "Fulde menuer (med skalering pr. kuvert)",
        "1 virksomhed",
        "Brugsstatistik (overblik over virksomheden)",
      ],
      locked: ["Fuld økonomi (P&L, POS-import, Menu Engineering)", "Flere virksomheder", "Ekstra brugere"],
    },
    "sous-chef": {
      price: "$70/md",
      tagline: "Fuld kontrol over din virksomhed",
      description:
        "Alt ovenstående, plus komplet økonomi: reel P&L, import af POS-salg, Menu Engineering og leverandørprisvarians.",
      features: [
        "Alt fra Chef de Partie-planen",
        "Komplet økonomi: P&L, import af POS-salg",
        "Menu Engineering (Stjerner, Køer, Puslespil, Hunde)",
        "Leverandørprisvarians",
        "Historisk økonomisk dashboard",
        "Op til 2 synkroniserede virksomheder",
        "Op til 2 brugere på samme konto",
      ],
      locked: ["Storskala multi-virksomhed (+5)", "Prioriteret support", "Ubegrænsede brugere"],
    },
    "chef-ejecutivo": {
      price: "$120/md",
      tagline: "Til grupper og kæder",
      description: "Alt ovenstående, plus op til 5 virksomheder, 5 brugere, prioriteret support og personlig onboarding.",
      features: [
        "Alt fra Sous Chef-planen",
        "Op til 5 synkroniserede virksomheder",
        "Op til 5 brugere",
        "Prioriteret support",
        "Personlig onboarding",
        "Assisteret dataimport",
      ],
      locked: [],
    },
  },
  fr: {
    foodie: {
      price: "Gratuit",
      tagline: "Pour commencer à organiser tes recettes",
      description: "Base de données d'ingrédients, fiches techniques illimitées, export PDF de recette pour la cuisine.",
      features: [
        "Base de données d'ingrédients",
        "Fiches techniques illimitées",
        "Importation depuis Excel",
        "Export PDF cuisine (ingrédients et procédure, sans les coûts)",
      ],
      locked: [
        "Système de pertes",
        "PDF administratif (avec coûts et rentabilité)",
        "Bons de commande",
        "Inventaire",
        "Menus",
        "Statistiques et finances",
      ],
    },
    "home-cook": {
      price: "15 $/mois",
      tagline: "Pour ceux qui calculent déjà les coûts sérieusement",
      description: "Tout ce qu'offre Foodie, plus un système de pertes, des bons de commande manuels et le PDF administratif.",
      features: [
        "Tout ce qu'offre le plan Foodie",
        "Système de pertes",
        "Bons de commande manuels",
        "PDF administratif (avec coûts et rentabilité)",
      ],
      locked: ["Inventaire et suggestion automatique de commandes", "Menus", "Statistiques et finances avancées", "Multi-établissement"],
    },
    "chef-de-partie": {
      price: "35 $/mois",
      tagline: "Pour faire tourner une cuisine complète",
      description: "Tout ce qui précède, plus l'inventaire complet, les commandes automatiques, les menus et les statistiques d'utilisation.",
      features: [
        "Tout ce qu'offre le plan Home Cook",
        "Inventaire complet (stock et alertes)",
        "Bons de commande automatiques (depuis les menus et le stock bas)",
        "Menus complets (avec mise à l'échelle par couvert)",
        "1 établissement",
        "Statistiques d'utilisation (aperçu de l'établissement)",
      ],
      locked: ["Finances complètes (P&L, import POS, Menu Engineering)", "Multi-établissement", "Utilisateurs supplémentaires"],
    },
    "sous-chef": {
      price: "70 $/mois",
      tagline: "Le contrôle total de ton établissement",
      description:
        "Tout ce qui précède, plus les finances complètes : P&L réel, import des ventes POS, Menu Engineering et variance des prix fournisseurs.",
      features: [
        "Tout ce qu'offre le plan Chef de Partie",
        "Finances complètes : P&L, import des ventes POS",
        "Menu Engineering (Étoiles, Vaches, Puzzles, Chiens)",
        "Variance des prix fournisseurs",
        "Tableau de bord financier historique",
        "Jusqu'à 2 établissements synchronisés",
        "Jusqu'à 2 utilisateurs sur le même compte",
      ],
      locked: ["Multi-établissement à grande échelle (+5)", "Support prioritaire", "Utilisateurs illimités"],
    },
    "chef-ejecutivo": {
      price: "120 $/mois",
      tagline: "Pour les groupes et les chaînes",
      description: "Tout ce qui précède, plus jusqu'à 5 établissements, 5 utilisateurs, un support prioritaire et un onboarding personnalisé.",
      features: [
        "Tout ce qu'offre le plan Sous Chef",
        "Jusqu'à 5 établissements synchronisés",
        "Jusqu'à 5 utilisateurs",
        "Support prioritaire",
        "Onboarding personnalisé",
        "Import de données assisté",
      ],
      locked: [],
    },
  },
  pt: {
    foodie: {
      price: "Grátis",
      tagline: "Para começar a organizar suas receitas",
      description: "Banco de dados de ingredientes, fichas técnicas ilimitadas, exportação de receita em PDF de cozinha.",
      features: [
        "Banco de dados de ingredientes",
        "Fichas técnicas ilimitadas",
        "Importação do Excel",
        "Exportar PDF de cozinha (ingredientes e procedimento, sem custos)",
      ],
      locked: [
        "Sistema de perdas",
        "PDF administrativo (com custos e rentabilidade)",
        "Pedidos de compra",
        "Estoque",
        "Cardápios",
        "Estatísticas e finanças",
      ],
    },
    "home-cook": {
      price: "US$15/mês",
      tagline: "Para quem já calcula custos a sério",
      description: "Tudo do Foodie, mais sistema de perdas, pedidos de compra manuais e PDF administrativo.",
      features: [
        "Tudo do plano Foodie",
        "Sistema de perdas",
        "Pedidos de compra manuais",
        "PDF administrativo (com custos e rentabilidade)",
      ],
      locked: ["Estoque e sugestão automática de pedidos", "Cardápios", "Estatísticas e finanças avançadas", "Múltiplos negócios"],
    },
    "chef-de-partie": {
      price: "US$35/mês",
      tagline: "Para operar uma cozinha completa",
      description: "Tudo o anterior, mais estoque completo, pedidos automáticos, cardápios e estatísticas de uso.",
      features: [
        "Tudo do plano Home Cook",
        "Estoque completo (níveis e alertas)",
        "Pedidos de compra automáticos (a partir de cardápios e estoque baixo)",
        "Cardápios completos (com escalonamento por pessoa)",
        "1 negócio",
        "Estatísticas de uso (panorama do negócio)",
      ],
      locked: ["Finanças completas (P&L, importação de POS, Menu Engineering)", "Múltiplos negócios", "Usuários extras"],
    },
    "sous-chef": {
      price: "US$70/mês",
      tagline: "O controle total do seu negócio",
      description:
        "Tudo o anterior, mais finanças completas: P&L real, importação de vendas do POS, Menu Engineering e variação de preços de fornecedores.",
      features: [
        "Tudo do plano Chef de Partie",
        "Finanças completas: P&L, importação de vendas do POS",
        "Menu Engineering (Estrelas, Vacas, Quebra-cabeças, Cães)",
        "Variação de preços de fornecedores",
        "Painel financeiro histórico",
        "Até 2 negócios sincronizados",
        "Até 2 usuários na mesma conta",
      ],
      locked: ["Múltiplos negócios em grande escala (+5)", "Suporte prioritário", "Usuários ilimitados"],
    },
    "chef-ejecutivo": {
      price: "US$120/mês",
      tagline: "Para grupos e redes",
      description: "Tudo o anterior, mais até 5 negócios, 5 usuários, suporte prioritário e onboarding personalizado.",
      features: [
        "Tudo do plano Sous Chef",
        "Até 5 negócios sincronizados",
        "Até 5 usuários",
        "Suporte prioritário",
        "Onboarding personalizado",
        "Importação de dados assistida",
      ],
      locked: [],
    },
  },
  zh: {
    foodie: {
      price: "免费",
      tagline: "开始整理你的配方",
      description: "食材数据库、无限配方卡、厨房版配方PDF导出。",
      features: ["食材数据库", "无限配方卡", "从Excel导入", "导出厨房版PDF（食材和步骤，不含成本）"],
      locked: ["损耗系统", "管理版PDF（含成本和利润率）", "采购订单", "库存", "菜单", "统计与财务"],
    },
    "home-cook": {
      price: "$15/月",
      tagline: "适合已经认真核算成本的你",
      description: "包含Foodie的全部功能，另加损耗系统、手动采购订单和管理版PDF。",
      features: ["Foodie套餐的全部功能", "损耗系统", "手动采购订单", "管理版PDF（含成本和利润率）"],
      locked: ["库存及自动订单建议", "菜单", "高级统计与财务", "多商家"],
    },
    "chef-de-partie": {
      price: "$35/月",
      tagline: "适合运营一整间厨房",
      description: "包含以上全部，另加完整库存、自动订单、菜单和使用统计。",
      features: [
        "Home Cook套餐的全部功能",
        "完整库存（库存量与预警）",
        "自动采购订单（根据菜单和低库存生成）",
        "完整菜单（按用餐人数换算）",
        "1个商家",
        "使用统计（商家概览）",
      ],
      locked: ["完整财务（P&L、POS销售导入、菜单工程分析）", "多商家", "额外用户"],
    },
    "sous-chef": {
      price: "$70/月",
      tagline: "全面掌控你的生意",
      description: "包含以上全部，另加完整财务：真实P&L、POS销售数据导入、菜单工程分析和供应商价格波动分析。",
      features: [
        "Chef de Partie套餐的全部功能",
        "完整财务：P&L、POS销售数据导入",
        "菜单工程分析（明星、瘦狗、问题、金牛）",
        "供应商价格波动分析",
        "历史财务看板",
        "最多同步2个商家",
        "同一账户最多2个用户",
      ],
      locked: ["大规模多商家（+5个）", "优先支持", "无限用户"],
    },
    "chef-ejecutivo": {
      price: "$120/月",
      tagline: "适合集团和连锁品牌",
      description: "包含以上全部，另加最多5个商家、5个用户、优先支持和专属引导服务。",
      features: [
        "Sous Chef套餐的全部功能",
        "最多同步5个商家",
        "最多5个用户",
        "优先支持",
        "专属引导服务",
        "协助数据导入",
      ],
      locked: [],
    },
  },
}
