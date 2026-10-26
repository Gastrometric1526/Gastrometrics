/**
 * Páginas de búsqueda por idioma (docs/173, Fase 3 del plan de reseñas y visibilidad):
 * «software de costeo de recetas» en los 6 idiomas, cada una con su URL propia, en
 * /software/<slug>. A diferencia de /caracteristicas y /recursos (que se traducen en el
 * navegador y por eso solo exponen metadatos en español), estas páginas llegan del
 * servidor ya en su idioma, con hreflang entre ellas, para que Google indexe cada idioma.
 *
 * Solo funciones que existen hoy en la app (ver referencia completa).
 */

export type SeoLang = "es" | "en" | "da" | "fr" | "pt" | "zh"

export interface SeoLanding {
  slug: string
  lang: SeoLang
  htmlLang: string
  languageName: string
  /** Nombre corto para enlaces (pie de página). */
  navLabel: string
  title: string
  description: string
  h1: string
  lead: string
  ctaButton: string
  sections: { h2: string; body: string }[]
  featuresTitle: string
  features: string[]
  faqTitle: string
  faq: { q: string; a: string }[]
  closingTitle: string
  closingBody: string
  otherLanguages: string
}

export const seoLandings: SeoLanding[] = [
  {
    slug: "costeo-de-recetas",
    lang: "es",
    htmlLang: "es",
    languageName: "Español",
    navLabel: "Software de costeo de recetas",
    title: "Software de costeo de recetas para restaurantes — Gastrometrics",
    description:
      "Calcula el costo real de cada plato, el precio de venta sugerido y tu food cost. Fichas técnicas, sub-recetas, merma, inventario y menús. Plan gratis para siempre.",
    h1: "Software de costeo de recetas para restaurantes y cocinas",
    lead: "Carga tus ingredientes con su precio real, arma la ficha técnica y Gastrometrics calcula solo el costo de cada plato, el costo por porción y el precio de venta sugerido. Sin hojas de cálculo.",
    ctaButton: "Crear cuenta gratis",
    sections: [
      {
        h2: "El costo real de cada plato, siempre al día",
        body: "Cada ingrediente guarda su precio de compra, su contenido y su merma, así que el costo por gramo o mililitro es el real. Cuando sube el precio de un insumo, se recalculan solas todas las recetas que lo usan, también las que lo llevan dentro de una sub-receta, y el precio de venta solo sube si el costo lo deja corto.",
      },
      {
        h2: "Precio de venta con Food Cost % o con tus costos fijos",
        body: "Elige el método que usas: Food Cost % (el estándar de la industria, con ISV opcional y comisión de delivery o tarjeta) o el método de 6 rubros, que reparte servicios, marketing, operación y mano de obra sobre el costo de producción. El precio siempre se redondea hacia arriba al escalón de tu moneda.",
      },
      {
        h2: "Del costeo al control de la cocina",
        body: "Con las recetas listas puedes contar inventario (también con una foto), ver el stock teórico según tus ventas, armar menús por evento con escalado por porciones y generar órdenes de compra automáticas para lo que falta.",
      },
    ],
    featuresTitle: "Qué incluye",
    features: [
      "Fichas técnicas con costo total, costo por porción y precio sugerido",
      "Sub-recetas (salsas, bases) que se usan como ingredientes",
      "Sistema de merma por ingrediente",
      "Importa ingredientes y recetas desde Excel, PDF, texto, fotos y tickets",
      "Inventario, menús y órdenes de compra",
      "MEP: la mise en place de cada menú, por área de cocina, en PDF para el equipo",
      "PDF de cocina y PDF administrativo de cada receta",
      "6 idiomas y 21 monedas, con punto decimal",
      "Funciona en el celular y se instala como app",
    ],
    faqTitle: "Preguntas frecuentes",
    faq: [
      { q: "¿Es gratis?", a: "Sí. El plan Foodie es gratis para siempre e incluye la base de ingredientes, fichas técnicas ilimitadas, importación y el PDF de cocina. Los planes de pago agregan merma, inventario, menús, órdenes de compra y finanzas." },
      { q: "¿Cómo se calcula el precio de venta sugerido?", a: "Con Food Cost %: precio = costo por porción ÷ food cost objetivo, más ISV si lo usas y cubriendo la comisión de venta. Con el método de 6 rubros: costo más los porcentajes de cada rubro y tu costo fijo por plato. En ambos casos se redondea hacia arriba." },
      { q: "¿Qué pasa cuando sube el precio de un ingrediente?", a: "Todas las recetas que lo usan se recalculan solas, en cualquier nivel de sub-receta. Si el nuevo costo deja corto tu precio, el precio sube al sugerido; si el costo baja, tu precio se mantiene y ganas margen." },
      { q: "¿Necesito instalar algo?", a: "No. Funciona en el navegador de tu computadora o celular, y si quieres puedes instalarlo como app." },
    ],
    closingTitle: "Empieza con tu primer plato hoy",
    closingBody: "Crea tu cuenta gratis, carga tus ingredientes y mira el costo real de tu primera receta en minutos.",
    otherLanguages: "Otros idiomas",
  },
  {
    slug: "recipe-costing",
    lang: "en",
    htmlLang: "en",
    languageName: "English",
    navLabel: "Recipe costing software",
    title: "Recipe costing software for restaurants — Gastrometrics",
    description:
      "Calculate the real cost of every dish, a suggested selling price and your food cost. Recipe cards, sub-recipes, waste, inventory and menus. Free plan forever.",
    h1: "Recipe costing software for restaurants and kitchens",
    lead: "Add your ingredients with their real price, build the recipe sheet and Gastrometrics works out the cost of each dish, the cost per portion and a suggested selling price. No spreadsheets.",
    ctaButton: "Create a free account",
    sections: [
      {
        h2: "The real cost of every dish, always up to date",
        body: "Each ingredient keeps its purchase price, net content and waste, so the cost per gram or millilitre is the real one. When an ingredient goes up, every recipe that uses it is recalculated automatically, including the ones that use it inside a sub-recipe, and the selling price only goes up when the new cost leaves it short.",
      },
      {
        h2: "Selling price with Food Cost % or your fixed costs",
        body: "Pick your method: Food Cost % (the industry standard, with optional sales tax and delivery or card commission) or the 6-category method, which spreads utilities, marketing, operations and labour over the production cost. Prices are always rounded up to your currency's step.",
      },
      {
        h2: "From costing to running the kitchen",
        body: "With your recipes ready you can count inventory (even from a photo), see theoretical stock based on your sales, build event menus that scale by portions and generate automatic purchase orders for what's missing.",
      },
    ],
    featuresTitle: "What's included",
    features: [
      "Recipe cards with total cost, cost per portion and suggested price",
      "Sub-recipes (sauces, bases) used as ingredients",
      "Waste tracking per ingredient",
      "Import ingredients and recipes from Excel, PDF, text, photos and receipts",
      "Inventory, menus and purchase orders",
      "MEP: the mise en place for each menu, by kitchen area, as a PDF for the team",
      "Kitchen PDF and admin PDF for every recipe",
      "6 languages and 21 currencies",
      "Works on your phone and installs as an app",
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      { q: "Is it free?", a: "Yes. The Foodie plan is free forever and includes the ingredient database, unlimited recipe sheets, imports and the kitchen PDF. Paid plans add waste tracking, inventory, menus, purchase orders and finance." },
      { q: "How is the suggested selling price calculated?", a: "With Food Cost %: price = cost per portion ÷ target food cost, plus sales tax if you use it and covering the sales commission. With the 6-category method: cost plus each category's percentage and your fixed cost per dish. Both round up." },
      { q: "What happens when an ingredient price goes up?", a: "Every recipe that uses it is recalculated automatically, at any sub-recipe level. If the new cost leaves your price short, it rises to the suggested price; if the cost drops, your price stays and your margin grows." },
      { q: "Do I need to install anything?", a: "No. It runs in the browser on your computer or phone, and you can install it as an app if you like." },
    ],
    closingTitle: "Start with your first dish today",
    closingBody: "Create your free account, add your ingredients and see the real cost of your first recipe in minutes.",
    otherLanguages: "Other languages",
  },
  {
    slug: "opskriftsberegning",
    lang: "da",
    htmlLang: "da",
    languageName: "Dansk",
    navLabel: "Software til opskriftsberegning",
    title: "Software til opskriftsberegning for restauranter — Gastrometrics",
    description:
      "Beregn den reelle pris på hver ret, en foreslået salgspris og din food cost. Opskriftskort, underopskrifter, spild, lager og menuer. Gratis plan for altid.",
    h1: "Software til opskriftsberegning for restauranter og køkkener",
    lead: "Tilføj dine ingredienser med deres reelle pris, lav opskriftskortet, og Gastrometrics beregner selv prisen på hver ret, prisen pr. portion og en foreslået salgspris. Uden regneark.",
    ctaButton: "Opret en gratis konto",
    sections: [
      {
        h2: "Den reelle pris på hver ret, altid opdateret",
        body: "Hver ingrediens gemmer indkøbspris, indhold og spild, så prisen pr. gram eller milliliter er den reelle. Når en ingrediens stiger, genberegnes alle opskrifter, der bruger den, automatisk – også dem, hvor den indgår i en underopskrift – og salgsprisen stiger kun, hvis den nye pris gør den for lav.",
      },
      {
        h2: "Salgspris med Food Cost % eller dine faste omkostninger",
        body: "Vælg din metode: Food Cost % (branchestandarden, med valgfri moms og kommission til levering eller kort) eller 6-kategori-metoden, der fordeler forsyning, marketing, drift og løn på produktionsprisen. Prisen rundes altid op til din valutas trin.",
      },
      {
        h2: "Fra beregning til styring af køkkenet",
        body: "Når opskrifterne er klar, kan du tælle lager (også fra et foto), se teoretisk lager ud fra dit salg, lave menuer til arrangementer, der skaleres efter portioner, og oprette automatiske indkøbsordrer for det, der mangler.",
      },
    ],
    featuresTitle: "Det får du",
    features: [
      "Opskriftskort med samlet pris, pris pr. portion og foreslået pris",
      "Underopskrifter (saucer, baser) brugt som ingredienser",
      "Spild pr. ingrediens",
      "Importér ingredienser og opskrifter fra Excel, PDF, tekst, fotos og kvitteringer",
      "Lager, menuer og indkøbsordrer",
      "MEP: mise en place til hver menu, efter køkkenområde, som PDF til holdet",
      "Køkken-PDF og administrativ PDF for hver opskrift",
      "6 sprog og 21 valutaer",
      "Virker på mobilen og kan installeres som app",
    ],
    faqTitle: "Ofte stillede spørgsmål",
    faq: [
      { q: "Er det gratis?", a: "Ja. Foodie-planen er gratis for altid og omfatter ingrediensdatabasen, ubegrænsede opskriftskort, import og køkken-PDF. Betalte planer tilføjer spild, lager, menuer, indkøbsordrer og økonomi." },
      { q: "Hvordan beregnes den foreslåede salgspris?", a: "Med Food Cost %: pris = pris pr. portion ÷ mål for food cost, plus moms hvis du bruger det, og så kommissionen dækkes. Med 6-kategori-metoden: pris plus hver kategoris procent og din faste omkostning pr. ret. Begge runder op." },
      { q: "Hvad sker der, når en ingrediens bliver dyrere?", a: "Alle opskrifter, der bruger den, genberegnes automatisk på alle niveauer af underopskrifter. Bliver din pris for lav, stiger den til den foreslåede; falder prisen, bliver din pris, og din margin vokser." },
      { q: "Skal jeg installere noget?", a: "Nej. Det kører i browseren på computer eller mobil, og du kan installere det som app, hvis du vil." },
    ],
    closingTitle: "Start med din første ret i dag",
    closingBody: "Opret din gratis konto, tilføj dine ingredienser og se den reelle pris på din første opskrift på få minutter.",
    otherLanguages: "Andre sprog",
  },
  {
    slug: "calcul-cout-recettes",
    lang: "fr",
    htmlLang: "fr",
    languageName: "Français",
    navLabel: "Logiciel de coût des recettes",
    title: "Logiciel de calcul du coût des recettes pour restaurants — Gastrometrics",
    description:
      "Calculez le coût réel de chaque plat, un prix de vente conseillé et votre food cost. Fiches techniques, sous-recettes, pertes, inventaire et menus. Formule gratuite à vie.",
    h1: "Logiciel de calcul du coût des recettes pour restaurants et cuisines",
    lead: "Ajoutez vos ingrédients avec leur prix réel, créez la fiche technique et Gastrometrics calcule seul le coût de chaque plat, le coût par portion et un prix de vente conseillé. Sans tableur.",
    ctaButton: "Créer un compte gratuit",
    sections: [
      {
        h2: "Le coût réel de chaque plat, toujours à jour",
        body: "Chaque ingrédient garde son prix d'achat, son contenu et ses pertes : le coût au gramme ou au millilitre est donc le vrai. Quand un ingrédient augmente, toutes les recettes qui l'utilisent sont recalculées automatiquement, y compris celles qui l'intègrent via une sous-recette, et le prix de vente ne monte que si le nouveau coût le rend insuffisant.",
      },
      {
        h2: "Prix de vente au Food Cost % ou selon vos coûts fixes",
        body: "Choisissez votre méthode : Food Cost % (le standard du secteur, avec TVA optionnelle et commission de livraison ou de carte) ou la méthode à 6 postes, qui répartit énergie, marketing, exploitation et main-d'œuvre sur le coût de production. Le prix est toujours arrondi au palier supérieur de votre devise.",
      },
      {
        h2: "Du calcul des coûts à la gestion de la cuisine",
        body: "Une fois vos recettes prêtes, vous pouvez faire l'inventaire (même à partir d'une photo), voir le stock théorique selon vos ventes, créer des menus d'événement qui s'adaptent au nombre de couverts et générer des bons de commande automatiques pour ce qui manque.",
      },
    ],
    featuresTitle: "Ce qui est inclus",
    features: [
      "Fiches techniques avec coût total, coût par portion et prix conseillé",
      "Sous-recettes (sauces, bases) utilisées comme ingrédients",
      "Gestion des pertes par ingrédient",
      "Importez ingrédients et recettes depuis Excel, PDF, texte, photos et tickets",
      "Inventaire, menus et bons de commande",
      "MEP : la mise en place de chaque menu, par poste de cuisine, en PDF pour l’équipe",
      "PDF cuisine et PDF administratif pour chaque recette",
      "6 langues et 21 devises",
      "Fonctionne sur mobile et s'installe comme une application",
    ],
    faqTitle: "Questions fréquentes",
    faq: [
      { q: "Est-ce gratuit ?", a: "Oui. La formule Foodie est gratuite à vie et comprend la base d'ingrédients, des fiches techniques illimitées, l'import et le PDF cuisine. Les formules payantes ajoutent les pertes, l'inventaire, les menus, les bons de commande et les finances." },
      { q: "Comment le prix de vente conseillé est-il calculé ?", a: "Au Food Cost % : prix = coût par portion ÷ food cost cible, plus la TVA si vous l'utilisez, en couvrant la commission de vente. Avec la méthode à 6 postes : coût plus le pourcentage de chaque poste et votre coût fixe par plat. Les deux arrondissent au supérieur." },
      { q: "Que se passe-t-il quand le prix d'un ingrédient augmente ?", a: "Toutes les recettes qui l'utilisent sont recalculées automatiquement, à tous les niveaux de sous-recettes. Si le nouveau coût rend votre prix insuffisant, il passe au prix conseillé ; si le coût baisse, votre prix reste et votre marge augmente." },
      { q: "Dois-je installer quelque chose ?", a: "Non. Tout fonctionne dans le navigateur de votre ordinateur ou de votre téléphone, et vous pouvez l'installer comme application si vous le souhaitez." },
    ],
    closingTitle: "Commencez par votre premier plat aujourd'hui",
    closingBody: "Créez votre compte gratuit, ajoutez vos ingrédients et découvrez le coût réel de votre première recette en quelques minutes.",
    otherLanguages: "Autres langues",
  },
  {
    slug: "custo-de-receitas",
    lang: "pt",
    htmlLang: "pt-BR",
    languageName: "Português",
    navLabel: "Software de custo de receitas",
    title: "Software de custo de receitas para restaurantes — Gastrometrics",
    description:
      "Calcule o custo real de cada prato, um preço de venda sugerido e seu food cost. Fichas técnicas, sub-receitas, perdas, estoque e cardápios. Plano grátis para sempre.",
    h1: "Software de custo de receitas para restaurantes e cozinhas",
    lead: "Cadastre seus ingredientes com o preço real, monte a ficha técnica e o Gastrometrics calcula sozinho o custo de cada prato, o custo por porção e o preço de venda sugerido. Sem planilhas.",
    ctaButton: "Criar conta grátis",
    sections: [
      {
        h2: "O custo real de cada prato, sempre atualizado",
        body: "Cada ingrediente guarda o preço de compra, o conteúdo e a perda, então o custo por grama ou mililitro é o real. Quando um insumo sobe, todas as receitas que o usam são recalculadas sozinhas, inclusive as que o levam dentro de uma sub-receita, e o preço de venda só sobe se o novo custo o deixar curto.",
      },
      {
        h2: "Preço de venda com Food Cost % ou com seus custos fixos",
        body: "Escolha seu método: Food Cost % (o padrão do setor, com imposto opcional e comissão de delivery ou cartão) ou o método de 6 itens, que distribui serviços, marketing, operação e mão de obra sobre o custo de produção. O preço é sempre arredondado para cima no degrau da sua moeda.",
      },
      {
        h2: "Do custo ao controle da cozinha",
        body: "Com as receitas prontas você pode contar o estoque (até com uma foto), ver o estoque teórico de acordo com as vendas, montar cardápios para eventos com ajuste por porções e gerar ordens de compra automáticas para o que falta.",
      },
    ],
    featuresTitle: "O que inclui",
    features: [
      "Fichas técnicas com custo total, custo por porção e preço sugerido",
      "Sub-receitas (molhos, bases) usadas como ingredientes",
      "Controle de perdas por ingrediente",
      "Importe ingredientes e receitas de Excel, PDF, texto, fotos e cupons",
      "Estoque, cardápios e ordens de compra",
      "MEP: a mise en place de cada cardápio, por área da cozinha, em PDF para a equipe",
      "PDF de cozinha e PDF administrativo de cada receita",
      "6 idiomas e 21 moedas",
      "Funciona no celular e instala como app",
    ],
    faqTitle: "Perguntas frequentes",
    faq: [
      { q: "É grátis?", a: "Sim. O plano Foodie é grátis para sempre e inclui a base de ingredientes, fichas técnicas ilimitadas, importação e o PDF de cozinha. Os planos pagos adicionam perdas, estoque, cardápios, ordens de compra e finanças." },
      { q: "Como o preço de venda sugerido é calculado?", a: "Com Food Cost %: preço = custo por porção ÷ food cost alvo, mais imposto se você usar e cobrindo a comissão de venda. Com o método de 6 itens: custo mais a porcentagem de cada item e seu custo fixo por prato. Os dois arredondam para cima." },
      { q: "O que acontece quando o preço de um ingrediente sobe?", a: "Todas as receitas que o usam são recalculadas sozinhas, em qualquer nível de sub-receita. Se o novo custo deixar seu preço curto, ele sobe para o sugerido; se o custo cair, seu preço se mantém e sua margem aumenta." },
      { q: "Preciso instalar algo?", a: "Não. Funciona no navegador do computador ou do celular, e você pode instalar como app se quiser." },
    ],
    closingTitle: "Comece hoje com seu primeiro prato",
    closingBody: "Crie sua conta grátis, cadastre seus ingredientes e veja o custo real da sua primeira receita em minutos.",
    otherLanguages: "Outros idiomas",
  },
  {
    slug: "peifang-chengben",
    lang: "zh",
    htmlLang: "zh-CN",
    languageName: "中文",
    navLabel: "配方成本核算软件",
    title: "餐厅配方成本核算软件 — Gastrometrics",
    description: "计算每道菜的真实成本、建议售价和食材成本率。技术配方表、子配方、损耗、库存和菜单。永久免费套餐。",
    h1: "面向餐厅和厨房的配方成本核算软件",
    lead: "录入食材的真实价格，建立技术配方表，Gastrometrics 会自动算出每道菜的成本、每份成本和建议售价。无需电子表格。",
    ctaButton: "免费注册",
    sections: [
      {
        h2: "每道菜的真实成本，随时更新",
        body: "每种食材都记录采购价、净含量和损耗，因此每克或每毫升的成本都是真实的。食材涨价时，所有用到它的配方都会自动重新计算，包括通过子配方使用它的配方；只有当新成本让售价不够时，售价才会上调。",
      },
      {
        h2: "按食材成本率或固定成本定价",
        body: "选择你习惯的方法：食材成本率（行业标准，可选税费以及外卖或刷卡佣金），或 6 项费用法——把水电、营销、运营和人工按生产成本分摊。价格总是按你所用货币的档位向上取整。",
      },
      {
        h2: "从成本核算到厨房管理",
        body: "配方准备好后，你可以盘点库存（也可以拍照识别），根据销售查看理论库存，按份数缩放制作活动菜单，并为缺货自动生成采购单。",
      },
    ],
    featuresTitle: "包含的功能",
    features: [
      "技术配方表：总成本、每份成本和建议售价",
      "子配方（酱汁、底料）可作为食材使用",
      "按食材管理损耗",
      "从 Excel、PDF、文本、照片和小票导入食材和配方",
      "库存、菜单和采购单",
      "备料清单（MEP）：每个菜单的备料，按厨房区域生成 PDF 交给团队",
      "每个配方的厨房版 PDF 和管理版 PDF",
      "6 种语言、21 种货币",
      "支持手机使用，可安装为应用",
    ],
    faqTitle: "常见问题",
    faq: [
      { q: "免费吗？", a: "是的。Foodie 套餐永久免费，包含食材库、不限数量的技术配方表、导入功能和厨房版 PDF。付费套餐增加损耗管理、库存、菜单、采购单和财务功能。" },
      { q: "建议售价是怎么计算的？", a: "食材成本率法：售价 = 每份成本 ÷ 目标食材成本率，如有税费则加上，并覆盖销售佣金。6 项费用法：成本加上各项费用的百分比以及每道菜的固定成本。两种方法都向上取整。" },
      { q: "食材涨价时会怎样？", a: "所有用到它的配方都会自动重新计算，任何层级的子配方都包括在内。如果新成本让售价不够，售价会上调到建议价；如果成本下降，售价保持不变，利润率提高。" },
      { q: "需要安装吗？", a: "不需要。在电脑或手机的浏览器中即可使用，也可以按需安装为应用。" },
    ],
    closingTitle: "今天就从第一道菜开始",
    closingBody: "免费注册，录入食材，几分钟内就能看到第一份配方的真实成本。",
    otherLanguages: "其他语言",
  },
]

export function getSeoLanding(slug: string): SeoLanding | undefined {
  return seoLandings.find((l) => l.slug === slug)
}
