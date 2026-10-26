/**
 * Novedades del producto — una entrada por publicación, mostrada como pop-up al
 * entrar (components/whats-new-dialog.tsx) y opcionalmente por correo a quien
 * marcó la casilla de novedades (ver app/api/admin/product-update-email/route.ts).
 *
 * Cómo agregar una nueva entrada cuando se publique algo nuevo: agregar un objeto
 * arriba del array (más reciente primero), con una versión nueva (fecha ISO del día
 * basta como versión) y el mismo contenido traducido a los 6 idiomas. El pop-up se
 * vuelve a mostrar solo por el hecho de que `LATEST_CHANGELOG_VERSION` cambió — no
 * hace falta tocar ningún otro archivo para que se dispare de nuevo.
 *
 * Ley (docs/167): cada entrada nueva lleva `tutorialHref` al tutorial de su sección,
 * actualizado con lo nuevo.
 */

import type { LanguageCode } from "@/lib/i18n/translations"
import { tourHref } from "@/lib/tour-links"

export interface ChangelogEntry {
  /** Fecha ISO (YYYY-MM-DD) — también funciona como identificador único de versión. */
  version: string
  /**
   * LEY DEL PROYECTO (docs/167): toda novedad desde 2026-10-17 lleva el enlace al
   * tutorial de la sección que cambió, creado con `tourHref("<slug>")` de
   * lib/tour-links.ts, y ese tutorial se actualiza con lo nuevo. La ventana de Novedades
   * y el correo muestran el botón «Ver el tutorial». changelog.test.ts lo exige.
   */
  tutorialHref?: string
  content: Record<LanguageCode, { title: string; items: string[] }>
}

// Más reciente primero.
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026-10-26",
    tutorialHref: tourHref("mep"),
    content: {
      es: {
        title: "Nuevo: MEP (mise en place), envío de órdenes y precios por proveedor",
        items: [
          "MEP: elige un menú y ve todo lo que hay que producir, con las preparaciones base primero y después cada plato, ya calculado con sus porciones. Toca una receta para ver ingredientes, cantidades y procedimiento, y marca lo que va estando listo.",
          "La MEP se descarga o se manda como PDF: la primera página es la lista completa y después va una receta por página.",
          "Puedes agruparla por área de cocina (las clasificaciones de la Ficha Técnica: línea caliente, línea fría, pastelería…) e imprimir la hoja de cada sección para su equipo.",
          "Órdenes de compra: nuevo botón «Enviar» para mandarlas por WhatsApp o por correo (tú eliges a quién). El PDF se sigue descargando como siempre.",
          "Reportes → Proveedores: historial de precios de cada ingrediente, qué proveedor te lo vende más barato, cuánto podrías ahorrar y qué subió en los últimos 30 días.",
          "Reportes → Merma: cuánto te cuesta la merma que configuraste (global o personalizada), en qué ingredientes pierdes más y dónde conviene activarla.",
        ],
      },
      en: {
        title: "New: MEP (mise en place), sending orders and prices by supplier",
        items: [
          "MEP: pick a menu and see everything to prepare, with base preps first and then each dish, already scaled to its portions. Tap a recipe to see ingredients, quantities and method, and check things off as they’re done.",
          "Download or send the MEP as a PDF: the first page is the full list, followed by one recipe per page.",
          "You can group it by kitchen area (the Recipe Sheet classifications: hot line, cold line, pastry…) and print each station’s sheet for its team.",
          "Purchase orders: new “Send” button to share them by WhatsApp or email (you choose who). The PDF still downloads as always.",
          "Reports → Suppliers: price history for each ingredient, which supplier sells it cheapest, how much you could save and what went up in the last 30 days.",
          "Reports → Waste: what the waste you set (global or custom) costs you, where you lose the most and where it’s worth turning on.",
        ],
      },
      da: {
        title: "Nyt: MEP (mise en place), afsendelse af ordrer og priser pr. leverandør",
        items: [
          "MEP: vælg en menu og se alt, der skal laves, med grundtilberedningerne først og derefter hver ret, allerede beregnet efter portionerne. Tryk på en opskrift for at se ingredienser, mængder og fremgangsmåde, og sæt flueben, når noget er klar.",
          "Download eller send MEP’en som PDF: første side er hele listen, derefter én opskrift pr. side.",
          "Du kan gruppere den efter køkkenområde (opskriftskortets klassificeringer: varm linje, kold linje, konditori…) og udskrive hver stations ark til holdet.",
          "Indkøbsordrer: ny knap “Send” til at dele dem på WhatsApp eller e-mail (du vælger modtager). PDF’en kan stadig downloades som altid.",
          "Rapporter → Leverandører: prishistorik for hver ingrediens, hvilken leverandør der er billigst, hvor meget du kan spare, og hvad der steg de seneste 30 dage.",
          "Rapporter → Svind: hvad det svind, du har sat (globalt eller tilpasset), koster dig, hvor du mister mest, og hvor det er værd at slå til.",
        ],
      },
      fr: {
        title: "Nouveau : MEP (mise en place), envoi des commandes et prix par fournisseur",
        items: [
          "MEP : choisissez un menu et voyez tout ce qu’il faut produire, avec d’abord les préparations de base puis chaque plat, déjà calculé selon les portions. Touchez une recette pour voir ingrédients, quantités et procédé, et cochez ce qui est prêt.",
          "Téléchargez ou envoyez la MEP en PDF : la première page est la liste complète, puis une recette par page.",
          "Vous pouvez la regrouper par poste de cuisine (les classifications de la fiche technique : chaud, froid, pâtisserie…) et imprimer la feuille de chaque section pour son équipe.",
          "Commandes d’achat : nouveau bouton « Envoyer » pour les partager par WhatsApp ou e-mail (vous choisissez le destinataire). Le PDF se télécharge toujours comme avant.",
          "Rapports → Fournisseurs : historique des prix de chaque ingrédient, le fournisseur le moins cher, l’économie possible et ce qui a augmenté sur 30 jours.",
          "Rapports → Pertes : ce que vous coûtent les pertes configurées (globales ou personnalisées), où vous perdez le plus et où il vaut la peine de les activer.",
        ],
      },
      pt: {
        title: "Novo: MEP (mise en place), envio de pedidos e preços por fornecedor",
        items: [
          "MEP: escolha um cardápio e veja tudo o que é preciso produzir, com as preparações base primeiro e depois cada prato, já calculado com as porções. Toque numa receita para ver ingredientes, quantidades e modo de preparo, e marque o que já está pronto.",
          "Baixe ou envie o MEP em PDF: a primeira página é a lista completa e depois vem uma receita por página.",
          "Você pode agrupá-lo por área da cozinha (as classificações da Ficha Técnica: linha quente, linha fria, confeitaria…) e imprimir a folha de cada seção para a equipe.",
          "Pedidos de compra: novo botão “Enviar” para mandar por WhatsApp ou e-mail (você escolhe para quem). O PDF continua sendo baixado como sempre.",
          "Relatórios → Fornecedores: histórico de preços de cada ingrediente, qual fornecedor vende mais barato, quanto você poderia economizar e o que subiu nos últimos 30 dias.",
          "Relatórios → Perdas: quanto custa a perda que você configurou (global ou personalizada), onde você perde mais e onde vale a pena ativá-la.",
        ],
      },
      zh: {
        title: "新功能：备料清单（MEP）、发送订单和按供应商比价",
        items: [
          "备料清单：选择一个菜单，就能看到需要准备的全部内容——先是基础备料，然后是每道菜，用量已按份数算好。点击配方可查看食材、用量和步骤，完成后可以打勾。",
          "备料清单可以下载或以 PDF 发送：第一页是完整清单，之后每页一个配方。",
          "可以按厨房区域分组（技术配方表的分类：热厨、冷厨、甜点……），并为每个工位打印清单交给团队。",
          "采购订单：新增“发送”按钮，可通过 WhatsApp 或邮件发送（由你选择收件人）。PDF 仍可照常下载。",
          "报表 → 供应商：每种食材的价格历史、哪家供应商最便宜、可以节省多少，以及最近 30 天涨价的食材。",
          "报表 → 损耗：你设置的损耗（通用或自定义）带来的成本、损失最多的食材，以及建议启用损耗的地方。",
        ],
      },
    },
  },
  {
    version: "2026-10-23d",
    tutorialHref: tourHref("ordenes-compra"),
    content: {
      es: {
        title: "Órdenes de compra e inventario más confiables",
        items: [
          "Órdenes de compra: al editar una orden ya no se pierde el impuesto, y las notas y la fecha de entrega esperada ahora se guardan.",
          "Al marcar una orden como «Recibida», se suma al Inventario aunque hayas renombrado el ingrediente, y si algún producto no está en Inventario te decimos cuál.",
          "Inventario: un producto que agregas a mano con el nombre de un ingrediente queda conectado a ese ingrediente (stock teórico y órdenes sugeridas).",
          "Mis Recetas: ahora puedes ordenarlas por margen.",
          "PAX: las cantidades muy pequeñas (por ejemplo, unos miligramos de azafrán) ya no se redondean de más.",
        ],
      },
      en: {
        title: "More reliable purchase orders and inventory",
        items: [
          "Purchase orders: editing an order no longer drops its sales tax, and notes and the expected delivery date are now saved.",
          "When you mark an order as \"Received\", it's added to Inventory even if you renamed the ingredient, and if a product isn't in Inventory we tell you which.",
          "Inventory: a product you add manually with an ingredient's name is linked to that ingredient (theoretical stock and suggested orders).",
          "My Recipes: you can now sort them by margin.",
          "PAX: very small quantities (a few milligrams of saffron, for example) are no longer rounded up too much.",
        ],
      },
      da: {
        title: "Mere pålidelige indkøbsordrer og lager",
        items: [
          "Indkøbsordrer: når du redigerer en ordre, forsvinder momsen ikke længere, og noter og forventet leveringsdato gemmes nu.",
          "Når du markerer en ordre som »Modtaget«, lægges den på Lager, selv om du har omdøbt ingrediensen, og hvis en vare ikke findes på Lager, fortæller vi dig hvilken.",
          "Lager: en vare, du tilføjer manuelt med en ingrediens' navn, kobles til den ingrediens (teoretisk lager og foreslåede ordrer).",
          "Mine Opskrifter: du kan nu sortere dem efter margin.",
          "PAX: meget små mængder (fx nogle få milligram safran) rundes ikke længere for meget op.",
        ],
      },
      fr: {
        title: "Des bons de commande et un inventaire plus fiables",
        items: [
          "Bons de commande : modifier une commande ne fait plus perdre la taxe, et les notes et la date de livraison prévue sont maintenant enregistrées.",
          "Quand vous marquez une commande comme « Reçue », elle s'ajoute à l'Inventaire même si vous avez renommé l'ingrédient, et si un produit n'y est pas, nous vous indiquons lequel.",
          "Inventaire : un produit ajouté à la main avec le nom d'un ingrédient est relié à cet ingrédient (stock théorique et commandes suggérées).",
          "Mes Recettes : vous pouvez maintenant les trier par marge.",
          "PAX : les très petites quantités (quelques milligrammes de safran, par exemple) ne sont plus trop arrondies.",
        ],
      },
      pt: {
        title: "Ordens de compra e estoque mais confiáveis",
        items: [
          "Ordens de compra: ao editar uma ordem, o imposto não se perde mais, e as notas e a data de entrega prevista agora são salvas.",
          "Ao marcar uma ordem como «Recebido», ela é somada ao Estoque mesmo que você tenha renomeado o ingrediente, e se algum produto não estiver no Estoque, avisamos qual.",
          "Estoque: um produto que você adiciona à mão com o nome de um ingrediente fica ligado a esse ingrediente (estoque teórico e ordens sugeridas).",
          "Minhas Receitas: agora você pode ordená-las por margem.",
          "PAX: quantidades muito pequenas (alguns miligramas de açafrão, por exemplo) não são mais arredondadas demais.",
        ],
      },
      zh: {
        title: "采购订单和库存更可靠",
        items: [
          "采购订单：编辑订单时不再丢失税费，备注和预计交货日期现在也会保存。",
          "将订单标记为“已收货”后，即使你改过食材名称也会计入库存；如有商品不在库存中，我们会告诉你是哪些。",
          "库存：手动添加且名称与某个食材相同的商品，会与该食材关联（理论库存和建议订单）。",
          "我的配方：现在可以按毛利排序。",
          "人数调整器：极小的用量（例如几毫克藏红花）不再被过度取整。",
        ],
      },
    },
  },
  {
    version: "2026-10-23c",
    tutorialHref: tourHref("ficha-tecnica"),
    content: {
      es: {
        title: "Modificador de PAX más preciso",
        items: [
          "Ficha Técnica: al escalar a más o menos personas, las cantidades en kilos o litros se redondean al gramo o mililitro (antes 0.01 kg de sal podía salir 0.1 kg) y ya no suben un escalón de más por un error de decimales.",
          "El costo y el precio que ves con el PAX activo son exactamente los que se guardan y salen en el PDF.",
          "«Restaurar receta original» trae los precios de hoy, y respeta los cambios de unidad de tus ingredientes.",
          "Órdenes de compra desde un menú: un plato con 0 porciones ya no se compra.",
        ],
      },
      en: {
        title: "More accurate PAX modifier",
        items: [
          "Recipe Sheet: when scaling to more or fewer people, quantities in kilos or liters are rounded to the gram or milliliter (0.01 kg of salt used to become 0.1 kg) and no longer go one step too high because of a decimal error.",
          "The cost and price you see with PAX active are exactly the ones saved and printed in the PDF.",
          "\"Restore original recipe\" brings today's prices and respects unit changes in your ingredients.",
          "Purchase orders from a menu: a dish with 0 servings is no longer ordered.",
        ],
      },
      da: {
        title: "Mere præcis PAX-modifikator",
        items: [
          "Opskriftsark: når du skalerer til flere eller færre personer, rundes mængder i kilo eller liter til nærmeste gram eller milliliter (før kunne 0.01 kg salt blive til 0.1 kg), og de stiger ikke længere et trin for meget på grund af en decimalfejl.",
          "Omkostningen og prisen, du ser med PAX aktiv, er præcis dem, der gemmes og vises i PDF'en.",
          "»Gendan original opskrift« henter dagens priser og tager højde for enhedsændringer på dine ingredienser.",
          "Indkøbsordrer fra en menu: en ret med 0 portioner bestilles ikke længere.",
        ],
      },
      fr: {
        title: "Modificateur de PAX plus précis",
        items: [
          "Fiche technique : en ajustant à plus ou moins de personnes, les quantités en kilos ou en litres sont arrondies au gramme ou au millilitre (avant, 0.01 kg de sel pouvait devenir 0.1 kg) et ne montent plus d'un cran de trop à cause d'une erreur de décimales.",
          "Le coût et le prix affichés avec le PAX actif sont exactement ceux qui sont enregistrés et imprimés dans le PDF.",
          "« Restaurer la recette originale » reprend les prix du jour et respecte les changements d'unité de vos ingrédients.",
          "Bons de commande depuis un menu : un plat à 0 portion n'est plus commandé.",
        ],
      },
      pt: {
        title: "Modificador de PAX mais preciso",
        items: [
          "Ficha técnica: ao ajustar para mais ou menos pessoas, as quantidades em quilos ou litros são arredondadas ao grama ou mililitro (antes, 0.01 kg de sal podia virar 0.1 kg) e não sobem mais um degrau a mais por erro de decimais.",
          "O custo e o preço que você vê com o PAX ativo são exatamente os que são salvos e saem no PDF.",
          "«Restaurar receita original» traz os preços de hoje e respeita as mudanças de unidade dos seus ingredientes.",
          "Ordens de compra a partir de um cardápio: um prato com 0 porções não é mais comprado.",
        ],
      },
      zh: {
        title: "人数调整器更精确",
        items: [
          "技术配方表：按人数放大或缩小时，以公斤或升计的用量会精确到克或毫升（以前 0.01 kg 的盐可能变成 0.1 kg），也不会再因小数误差多进一位。",
          "人数调整器启用时看到的成本和价格，与保存后及 PDF 中的完全一致。",
          "“恢复原始配方”会使用当前价格，并考虑食材单位的更改。",
          "从菜单生成采购订单：份数为 0 的菜品不再采购。",
        ],
      },
    },
  },
  {
    version: "2026-10-23b",
    tutorialHref: tourHref("estadisticas"),
    content: {
      es: {
        title: "Textos más claros en todos los idiomas",
        items: [
          "Reportes y Dashboard: el margen promedio y el costo % ahora se miden igual que en la Ficha Técnica, sin el ISV incluido en tus precios y descontando la comisión.",
          "Revisamos la ortografía y la gramática de toda la app, los correos y el manual en los 6 idiomas, y unificamos los nombres: cada cosa se llama igual en todas las pantallas.",
          "Los mensajes de error ahora te dicen qué hacer para resolverlo.",
        ],
      },
      en: {
        title: "Clearer wording in every language",
        items: [
          "Reports and Dashboard: average margin and cost % are now measured the same way as on the Recipe Sheet, without the sales tax included in your prices and after commission.",
          "We reviewed spelling and grammar across the app, emails and manual in all 6 languages, and unified names so each thing is called the same on every screen.",
          "Error messages now tell you what to do to fix the problem.",
        ],
      },
      da: {
        title: "Klarere tekster på alle sprog",
        items: [
          "Rapporter og Dashboard: gennemsnitlig avance og omkostnings-% måles nu som i opskriftsarket, uden momsen i dine priser og efter kommission.",
          "Vi har gennemgået stavning og grammatik i hele appen, e-mails og manualen på alle 6 sprog og ensrettet navnene, så hver ting hedder det samme på alle skærme.",
          "Fejlbeskeder fortæller dig nu, hvad du skal gøre for at løse problemet.",
        ],
      },
      fr: {
        title: "Des textes plus clairs dans toutes les langues",
        items: [
          "Rapports et Dashboard : la marge moyenne et le coût % se mesurent désormais comme dans la fiche technique, hors taxe incluse dans vos prix et après commission.",
          "Nous avons revu l'orthographe et la grammaire de toute l'application, des e-mails et du manuel dans les 6 langues, et unifié les noms : chaque élément porte le même nom sur tous les écrans.",
          "Les messages d'erreur vous indiquent maintenant quoi faire pour résoudre le problème.",
        ],
      },
      pt: {
        title: "Textos mais claros em todos os idiomas",
        items: [
          "Relatórios e Dashboard: a margem média e o custo % agora são medidos como na ficha técnica, sem o imposto incluído nos seus preços e descontando a comissão.",
          "Revisamos a ortografia e a gramática de todo o app, dos e-mails e do manual nos 6 idiomas, e unificamos os nomes: cada coisa tem o mesmo nome em todas as telas.",
          "As mensagens de erro agora dizem o que fazer para resolver o problema.",
        ],
      },
      zh: {
        title: "所有语言的文字更清晰",
        items: [
          "报表和仪表盘：平均利润率和成本率现在与技术配方表的计算方式一致，不含价格中包含的税费，并扣除佣金。",
          "我们检查了应用、邮件和使用手册在 6 种语言中的拼写和语法，并统一了名称：同一功能在所有页面上名称一致。",
          "错误提示现在会告诉你如何解决问题。",
        ],
      },
    },
  },
  {
    version: "2026-10-23",
    tutorialHref: tourHref("estadisticas"),
    content: {
      es: {
        title: "Cálculos revisados y más precisos",
        items: [
          "Reportes → Finanzas: el food cost, el Prime Cost y el estado de resultados ahora se miden sobre las ventas netas, sin el ISV incluido en tus precios (igual que en la Ficha Técnica). Si tus porcentajes cambiaron, es por esto: antes el impuesto se contaba como venta.",
          "Menu Engineering usa el método estándar de la industria (Kasavana y Smith): un plato muy vendido pero con poco margen por plato ahora aparece como «Vaca lechera», no como «Estrella».",
          "Órdenes de compra: la merma ya no se cobra dos veces en el costo ni pide envases de más, y los precios por gramo o mililitro mantienen sus decimales.",
          "Ingredientes: cambiar de métrico a imperial (o la unidad de un ingrediente) convierte también tus recetas e inventario, sin cambiar ningún costo. Un rubro en 0 % se respeta, y las fechas de hoy usan tu hora local.",
        ],
      },
      en: {
        title: "Reviewed, more accurate calculations",
        items: [
          "Reports → Finance: food cost, Prime Cost and the income statement are now measured on net sales, without the sales tax included in your prices (same as the recipe sheet). If your percentages changed, this is why: tax used to be counted as sales.",
          "Menu Engineering uses the industry-standard method (Kasavana and Smith): a dish that sells a lot but earns little per plate now shows as a \"Cash Cow\", not a \"Star\".",
          "Purchase orders: waste is no longer charged twice in the cost or ordering extra packages, and prices per gram or milliliter keep their decimals.",
          "Ingredients: switching between metric and imperial (or an ingredient's unit) also converts your recipes and inventory, without changing any cost. A 0% cost line is respected, and today's dates use your local time.",
        ],
      },
      da: {
        title: "Gennemgåede og mere præcise beregninger",
        items: [
          "Rapporter → Økonomi: food cost, Prime Cost og resultatopgørelsen måles nu på nettosalget, uden den moms der er inkluderet i dine priser (som i opskriftskortet). Har dine procenter ændret sig, er det derfor: momsen blev tidligere talt med som salg.",
          "Menu Engineering bruger branchens standardmetode (Kasavana og Smith): en ret, der sælger meget men tjener lidt pr. ret, vises nu som «Malkeko», ikke som «Stjerne».",
          "Indkøbsordrer: svind tælles ikke længere to gange i omkostningen eller bestiller ekstra emballager, og priser pr. gram eller milliliter beholder deres decimaler.",
          "Ingredienser: skift mellem metrisk og imperial (eller en ingrediens' enhed) konverterer også dine opskrifter og dit lager uden at ændre nogen omkostning. En post på 0 % respekteres, og dagens dato bruger din lokale tid.",
        ],
      },
      fr: {
        title: "Calculs révisés et plus précis",
        items: [
          "Rapports → Finances : le food cost, le Prime Cost et le compte de résultat se mesurent désormais sur les ventes nettes, sans la taxe incluse dans vos prix (comme dans la fiche technique). Si vos pourcentages ont changé, c'est pour cela : la taxe était comptée comme vente.",
          "Le Menu Engineering utilise la méthode standard du secteur (Kasavana et Smith) : un plat très vendu mais peu rentable par assiette apparaît maintenant comme « Vache à lait », et non comme « Étoile ».",
          "Bons de commande : la perte n'est plus comptée deux fois dans le coût ni ne fait commander d'emballages en trop, et les prix au gramme ou au millilitre gardent leurs décimales.",
          "Ingrédients : passer du métrique à l'impérial (ou changer l'unité d'un ingrédient) convertit aussi vos recettes et votre inventaire, sans changer aucun coût. Un poste à 0 % est respecté, et la date du jour utilise votre heure locale.",
        ],
      },
      pt: {
        title: "Cálculos revisados e mais precisos",
        items: [
          "Relatórios → Finanças: o food cost, o Prime Cost e o DRE agora são medidos sobre as vendas líquidas, sem o imposto incluído nos seus preços (como na ficha técnica). Se seus percentuais mudaram, é por isso: antes o imposto era contado como venda.",
          "O Menu Engineering usa o método padrão do setor (Kasavana e Smith): um prato que vende muito mas rende pouco por prato agora aparece como «Vaca leiteira», não como «Estrela».",
          "Ordens de compra: a perda não é mais cobrada duas vezes no custo nem pede embalagens a mais, e os preços por grama ou mililitro mantêm seus decimais.",
          "Ingredientes: trocar entre métrico e imperial (ou a unidade de um ingrediente) também converte suas receitas e seu estoque, sem mudar nenhum custo. Uma rubrica em 0 % é respeitada, e a data de hoje usa seu horário local.",
        ],
      },
      zh: {
        title: "计算已复核，更加精确",
        items: [
          "报表 → 财务：食材成本率、Prime Cost 和损益表现在按净销售额计算，不含价格中包含的税费（与配方卡一致）。如果你的百分比有变化，原因就在这里：以前税费被算作销售额。",
          "菜单工程采用行业标准方法（Kasavana 与 Smith）：销量高但单份利润低的菜品现在显示为「摇钱树」，而不是「明星」。",
          "采购单：损耗不再在成本中重复计算，也不会多订包装；按克或毫升计的价格会保留小数。",
          "食材：在公制与英制之间切换（或更改食材单位）时，会同时换算你的配方和库存，任何成本都不会改变。0% 的费用项会被保留，今天的日期使用你的本地时间。",
        ],
      },
    },
  },
  {
    version: "2026-10-22d",
    tutorialHref: tourHref("mi-plan"),
    content: {
      es: {
        title: "Te confirmamos cada cobro",
        items: [
          "Cada vez que Stripe cobra tu plan, te llega un correo «Pago confirmado» con el monto, la fecha, tu siguiente cobro y la factura, y lo ves también al entrar a la app.",
          "Si un cobro no se puede hacer, te avisamos que no se te cobró nada y te dejamos actualizar tu tarjeta con un toque, antes de perder tu plan.",
          "En Mi Plan, la tarjeta «Tu plan» muestra tus últimos cobros, pagados o fallidos.",
        ],
      },
      en: {
        title: "We confirm every charge",
        items: [
          "Every time Stripe charges your plan, you get a \"Payment confirmed\" email with the amount, date, your next charge and the invoice, and you also see it when you open the app.",
          "If a charge can't be made, we let you know nothing was charged and let you update your card with one tap, before you lose your plan.",
          "In My Plan, the \"Your plan\" card shows your recent charges, paid or failed.",
        ],
      },
      da: {
        title: "Vi bekræfter hver opkrævning",
        items: [
          "Hver gang Stripe opkræver din plan, får du en e-mail \"Betaling bekræftet\" med beløb, dato, din næste opkrævning og fakturaen, og du ser det også, når du åbner appen.",
          "Kan en opkrævning ikke gennemføres, fortæller vi dig, at intet er opkrævet, og lader dig opdatere dit kort med ét tryk, før du mister din plan.",
          "I Min plan viser kortet \"Din plan\" dine seneste opkrævninger, betalte eller mislykkede.",
        ],
      },
      fr: {
        title: "Nous confirmons chaque prélèvement",
        items: [
          "Chaque fois que Stripe prélève votre forfait, vous recevez un e-mail « Paiement confirmé » avec le montant, la date, votre prochain prélèvement et la facture, et vous le voyez aussi en ouvrant l'application.",
          "Si un prélèvement échoue, nous vous indiquons que rien n'a été prélevé et vous permettons de mettre à jour votre carte en un geste, avant de perdre votre forfait.",
          "Dans Mon forfait, la carte « Votre forfait » affiche vos derniers prélèvements, payés ou échoués.",
        ],
      },
      pt: {
        title: "Confirmamos cada cobrança",
        items: [
          "Sempre que a Stripe cobra seu plano, você recebe um e-mail \"Pagamento confirmado\" com o valor, a data, sua próxima cobrança e a fatura, e também vê isso ao abrir o app.",
          "Se uma cobrança não puder ser feita, avisamos que nada foi cobrado e deixamos você atualizar o cartão com um toque, antes de perder seu plano.",
          "Em Meu plano, o cartão \"Seu plano\" mostra suas últimas cobranças, pagas ou com falha.",
        ],
      },
      zh: {
        title: "每一笔扣费我们都会确认",
        items: [
          "每次 Stripe 为你的套餐扣费，你都会收到「付款成功」邮件，包含金额、日期、下次扣费和发票；打开应用时也会看到。",
          "如果扣费失败，我们会告诉你没有收取任何费用，并让你一键更新银行卡，避免失去套餐。",
          "在「我的套餐」中，「你的套餐」卡片会显示最近的扣费记录，包括成功和失败。",
        ],
      },
    },
  },
  {
    version: "2026-10-22c",
    tutorialHref: tourHref("mi-plan"),
    content: {
      es: {
        title: "Ahora ganas Chef Ejecutivo, y tu cuenta en Mi Plan",
        items: [
          "«Regala un mes, gana un mes» mejora: tu colega recibe 30 días de Chef Ejecutivo, el plan más completo, y tú también ganas Chef Ejecutivo cuando empieza. Si ya tienes un plan con fecha (como las cocinas fundadoras), los 30 días se suman al final.",
          "En Mi Plan, al final, la nueva sección «Tu cuenta»: cancela tu suscripción (sigues con tu plan hasta el fin del período pagado), borra todo tu contenido o elimina tu cuenta.",
        ],
      },
      en: {
        title: "You now earn Chef Ejecutivo, and your account is in My Plan",
        items: [
          "\"Give a month, get a month\" gets better: your colleague gets 30 days of Chef Ejecutivo, the most complete plan, and you also earn Chef Ejecutivo when they get started. If you already have a plan with an end date (like founding kitchens), the 30 days are added at the end.",
          "At the bottom of My Plan, the new \"Your account\" section: cancel your subscription (you keep your plan until the end of the paid period), delete all your content or delete your account.",
        ],
      },
      da: {
        title: "Nu får du Chef Ejecutivo, og din konto ligger i Min plan",
        items: [
          "\"Giv en måned, få en måned\" bliver bedre: din kollega får 30 dage med Chef Ejecutivo, den mest komplette plan, og du får også Chef Ejecutivo, når de kommer i gang. Har du allerede en plan med slutdato (som stiftende køkkener), lægges de 30 dage til i slutningen.",
          "Nederst i Min plan finder du den nye sektion \"Din konto\": opsig dit abonnement (du beholder din plan til udgangen af den betalte periode), slet alt dit indhold eller slet din konto.",
        ],
      },
      fr: {
        title: "Vous gagnez désormais Chef Ejecutivo, et votre compte est dans Mon forfait",
        items: [
          "« Offrez un mois, gagnez un mois » s'améliore : votre collègue reçoit 30 jours de Chef Ejecutivo, le forfait le plus complet, et vous gagnez aussi Chef Ejecutivo quand il démarre. Si vous avez déjà un forfait avec une date de fin (comme les cuisines fondatrices), les 30 jours s'ajoutent à la fin.",
          "En bas de Mon forfait, la nouvelle section « Votre compte » : résiliez votre abonnement (vous gardez votre forfait jusqu'à la fin de la période payée), effacez tout votre contenu ou supprimez votre compte.",
        ],
      },
      pt: {
        title: "Agora você ganha Chef Ejecutivo, e sua conta está em Meu plano",
        items: [
          "\"Dê um mês, ganhe um mês\" fica melhor: seu colega recebe 30 dias de Chef Ejecutivo, o plano mais completo, e você também ganha Chef Ejecutivo quando ele começa. Se você já tem um plano com data (como as cozinhas fundadoras), os 30 dias se somam ao final.",
          "No fim de Meu plano, a nova seção \"Sua conta\": cancele sua assinatura (você continua com seu plano até o fim do período pago), apague todo o seu conteúdo ou exclua sua conta.",
        ],
      },
      zh: {
        title: "现在奖励升级为 Chef Ejecutivo，账户管理也在「我的套餐」",
        items: [
          "「送一个月，得一个月」升级：你的同行获得 30 天功能最全的 Chef Ejecutivo，对方开始使用时你也获得 Chef Ejecutivo。如果你已有带到期日的套餐（例如创始厨房），这 30 天会加在到期日之后。",
          "「我的套餐」底部新增「你的账户」：取消订阅（套餐保持到已付费周期结束）、清空所有内容或删除账户。",
        ],
      },
    },
  },
  {
    version: "2026-10-22b",
    tutorialHref: tourHref("mi-plan"),
    content: {
      es: {
        title: "Tu plan, tus cobros e invitar, todo en Mi Plan",
        items: [
          "Mi Plan reúne todo en una sola página: la tarjeta «Tu plan» (cuándo vence tu plan, tu siguiente cobro y desde y hasta cuándo corren los meses que ganaste invitando), «Regala un mes, gana un mes» y cambiar de plan.",
          "El atajo «Invita» del menú lateral te lleva directo a esa sección.",
          "Actualizamos los Términos de Uso (sección 4.7, programa de referidos) y la Política de Privacidad (qué ve quien te invitó).",
        ],
      },
      en: {
        title: "Your plan, your charges and inviting, all in My Plan",
        items: [
          "My Plan brings everything together on one page: the \"Your plan\" card (when your plan ends, your next charge, and from when to when the months you earned by inviting run), \"Give a month, get a month\" and changing plans.",
          "The \"Invite\" shortcut in the side menu takes you straight to that section.",
          "We updated the Terms of Use (section 4.7, referral program) and the Privacy Policy (what the person who invited you can see).",
        ],
      },
      da: {
        title: "Din plan, dine opkrævninger og invitationer, alt i Min plan",
        items: [
          "Min plan samler alt på én side: kortet \"Din plan\" (hvornår din plan udløber, din næste opkrævning, og fra hvornår til hvornår de måneder, du har optjent ved at invitere, løber), \"Giv en måned, få en måned\" og skift af plan.",
          "Genvejen \"Inviter\" i sidemenuen fører dig direkte til den sektion.",
          "Vi har opdateret Brugsvilkårene (afsnit 4.7, henvisningsprogram) og Privatlivspolitikken (hvad den, der inviterede dig, kan se).",
        ],
      },
      fr: {
        title: "Votre forfait, vos prélèvements et vos invitations, tout dans Mon forfait",
        items: [
          "Mon forfait réunit tout sur une seule page : la carte « Votre forfait » (fin de votre forfait, prochain prélèvement et période des mois gagnés en invitant), « Offrez un mois, gagnez un mois » et le changement de forfait.",
          "Le raccourci « Inviter » du menu latéral vous amène directement à cette section.",
          "Nous avons mis à jour les Conditions d'utilisation (section 4.7, programme de parrainage) et la Politique de confidentialité (ce que voit la personne qui vous a invité).",
        ],
      },
      pt: {
        title: "Seu plano, suas cobranças e convites, tudo em Meu plano",
        items: [
          "Meu plano reúne tudo em uma só página: o cartão \"Seu plano\" (quando seu plano vence, sua próxima cobrança e de quando até quando correm os meses que você ganhou convidando), \"Dê um mês, ganhe um mês\" e mudar de plano.",
          "O atalho \"Convidar\" do menu lateral leva você direto para essa seção.",
          "Atualizamos os Termos de Uso (seção 4.7, programa de indicação) e a Política de Privacidade (o que vê quem convidou você).",
        ],
      },
      zh: {
        title: "套餐、扣费和邀请，全部在「我的套餐」",
        items: [
          "「我的套餐」把所有内容整合在一个页面：「你的套餐」卡片（套餐何时到期、下次扣费，以及通过邀请赚到的月份的起止日期）、「送一个月，得一个月」和更换套餐。",
          "侧边菜单中的「邀请」快捷入口会直接带你到该部分。",
          "我们更新了《使用条款》（第 4.7 条，推荐计划）和《隐私政策》（邀请你的人能看到什么）。",
        ],
      },
    },
  },
  {
    version: "2026-10-22",
    tutorialHref: tourHref("mi-plan"),
    content: {
      es: {
        title: "Regala un mes, gana un mes",
        items: [
          "Nuevo: «Invita» en el menú lateral. Comparte tu enlace con otro chef o cocina: recibe 30 días de Chef Ejecutivo gratis, sin tarjeta y sin compromiso. Al terminar vuelve a Foodie sola si no quiere seguir.",
          "Tú ganas un mes cuando tu invitado empieza de verdad (guarda una receta con costo o elige un plan) dentro de sus primeros 30 días. Hasta 12 meses al año.",
          "Si eres cocina fundadora, no pierdes nada: cada mes que ganes se suma al final de tu Chef Ejecutivo. Si pagas, se descuenta de tu próxima factura.",
          "Toca el «?» en Invita para ver todas las reglas.",
        ],
      },
      en: {
        title: "Give a month, get a month",
        items: [
          "New: \"Invite\" in the side menu. Share your link with another chef or kitchen: they get 30 days of Chef Ejecutivo free, no card, no commitment. When it ends they go back to Foodie on their own if they don't want to continue.",
          "You earn a month when your guest really gets started (saves a recipe with cost or picks a plan) within their first 30 days. Up to 12 months a year.",
          "If you're a founding kitchen, you lose nothing: every month you earn is added to the end of your Chef Ejecutivo. If you pay, it comes off your next invoice.",
          "Tap the \"?\" in Invite to see all the rules.",
        ],
      },
      da: {
        title: "Giv en måned, få en måned",
        items: [
          "Nyt: \"Inviter\" i sidemenuen. Del dit link med en anden kok eller et køkken: de får 30 dage med Chef Ejecutivo gratis, uden kort og uden binding. Når perioden slutter, går de selv tilbage til Foodie, hvis de ikke vil fortsætte.",
          "Du får en måned, når din gæst kommer rigtigt i gang (gemmer en opskrift med kostpris eller vælger en plan) inden for de første 30 dage. Op til 12 måneder om året.",
          "Er du et stiftende køkken, mister du intet: hver måned, du optjener, lægges til i slutningen af din Chef Ejecutivo. Betaler du, trækkes den fra din næste faktura.",
          "Tryk på \"?\" i Inviter for at se alle reglerne.",
        ],
      },
      fr: {
        title: "Offrez un mois, gagnez un mois",
        items: [
          "Nouveau : « Inviter » dans le menu latéral. Partagez votre lien avec un autre chef ou une autre cuisine : il reçoit 30 jours de Chef Ejecutivo gratuits, sans carte et sans engagement. À la fin, il repasse tout seul à Foodie s'il ne veut pas continuer.",
          "Vous gagnez un mois quand votre invité démarre vraiment (enregistre une recette avec coût ou choisit un forfait) dans ses 30 premiers jours. Jusqu'à 12 mois par an.",
          "Si vous êtes une cuisine fondatrice, vous ne perdez rien : chaque mois gagné s'ajoute à la fin de votre Chef Ejecutivo. Si vous payez, il est déduit de votre prochaine facture.",
          "Touchez le « ? » dans Inviter pour voir toutes les règles.",
        ],
      },
      pt: {
        title: "Dê um mês, ganhe um mês",
        items: [
          "Novo: \"Convidar\" no menu lateral. Compartilhe seu link com outro chef ou cozinha: a pessoa recebe 30 dias de Chef Ejecutivo grátis, sem cartão e sem compromisso. Ao terminar, volta sozinha para o Foodie se não quiser continuar.",
          "Você ganha um mês quando seu convidado começa de verdade (salva uma receita com custo ou escolhe um plano) nos primeiros 30 dias. Até 12 meses por ano.",
          "Se você é uma cozinha fundadora, não perde nada: cada mês que ganhar se soma ao final do seu Chef Ejecutivo. Se você paga, é descontado da próxima fatura.",
          "Toque no \"?\" em Convidar para ver todas as regras.",
        ],
      },
      zh: {
        title: "送一个月，得一个月",
        items: [
          "新功能：侧边菜单中的「邀请」。把你的链接分享给其他厨师或厨房：对方免费获得 30 天 Chef Ejecutivo，无需银行卡、没有任何承诺。结束后如果不想继续，会自动回到 Foodie。",
          "当你邀请的人在前 30 天内真正开始使用（保存一份带成本的配方或选择一个套餐）时，你获得一个月。每年最多 12 个月。",
          "如果你是创始厨房，你不会损失任何东西：每赚到一个月，都会加在你的 Chef Ejecutivo 之后。如果你是付费用户，会从下一张账单中扣除。",
          "点击「邀请」页面中的「？」查看全部规则。",
        ],
      },
    },
  },
  {
    version: "2026-10-20b",
    tutorialHref: tourHref("ingredientes"),
    content: {
      es: {
        title: "Nunca pierdas lo que estabas haciendo",
        items: [
          "Si cierras o te sales sin guardar un ingrediente nuevo, un registro de inventario, un menú o una orden de compra, lo recuperas al volver: 24 horas para ingredientes, 3 días para inventario y órdenes, 7 días para menús.",
          "Todas las fechas de la app, los PDF y los correos se muestran como día/mes/año, en cualquier idioma. Los campos de fecha también: escribe dd/mm/aaaa o elige en el calendario.",
        ],
      },
      en: {
        title: "Never lose what you were working on",
        items: [
          "If you close or leave without saving a new ingredient, an inventory count, a menu or a purchase order, you'll get it back when you return: 24 hours for ingredients, 3 days for inventory and orders, 7 days for menus.",
          "Every date in the app, PDFs and emails now shows as day/month/year, in any language. Date fields too: type dd/mm/yyyy or pick from the calendar.",
        ],
      },
      da: {
        title: "Mist aldrig det, du var i gang med",
        items: [
          "Lukker eller forlader du en ny ingrediens, en lageroptælling, en menu eller en indkøbsordre uden at gemme, får du det tilbage, når du vender tilbage: 24 timer for ingredienser, 3 dage for lager og ordrer, 7 dage for menuer.",
          "Alle datoer i appen, PDF'erne og e-mails vises som dag/måned/år på alle sprog. Datofelter også: skriv dd/mm/åååå eller vælg i kalenderen.",
        ],
      },
      fr: {
        title: "Ne perdez plus jamais ce que vous faisiez",
        items: [
          "Si vous fermez ou partez sans enregistrer un nouvel ingrédient, un inventaire, un menu ou un bon de commande, vous le retrouvez à votre retour : 24 heures pour les ingrédients, 3 jours pour l'inventaire et les commandes, 7 jours pour les menus.",
          "Toutes les dates de l'application, des PDF et des e-mails s'affichent en jour/mois/année, dans toutes les langues. Les champs de date aussi : tapez jj/mm/aaaa ou choisissez dans le calendrier.",
        ],
      },
      pt: {
        title: "Nunca perca o que estava fazendo",
        items: [
          "Se fechar ou sair sem salvar um ingrediente novo, uma contagem de estoque, um cardápio ou uma ordem de compra, você recupera ao voltar: 24 horas para ingredientes, 3 dias para estoque e ordens, 7 dias para cardápios.",
          "Todas as datas do app, dos PDFs e dos e-mails aparecem como dia/mês/ano, em qualquer idioma. Os campos de data também: digite dd/mm/aaaa ou escolha no calendário.",
        ],
      },
      zh: {
        title: "再也不会丢失正在做的内容",
        items: [
          "如果未保存就关闭或离开新食材、库存盘点、菜单或采购单，回来时可以恢复：食材 24 小时，库存和采购单 3 天，菜单 7 天。",
          "应用、PDF 和邮件中的所有日期现在都以 日/月/年 显示，任何语言都一样。日期输入框也是：输入 日/月/年 或在日历中选择。",
        ],
      },
    },
  },
  {
    version: "2026-10-20",
    tutorialHref: tourHref("mi-plan"),
    content: {
      es: {
        title: "Tu plan, sin sorpresas",
        items: [
          "Si tu plan tiene fecha de vencimiento, el menú lateral te muestra cuántos días quedan, en gris, ámbar o rojo según se acerca la fecha.",
          "Tres días antes y el mismo día te avisamos en la app, con lo que perderías y el plan con el que quieres seguir.",
          "Puedes programar el pago para el día que vence tu plan. Tu plan solo cambia cuando Stripe confirma el cobro.",
          "Al crear tu cuenta ves todo lo que incluye cada plan antes de elegir; Foodie viene elegido por defecto.",
        ],
      },
      en: {
        title: "Your plan, no surprises",
        items: [
          "If your plan has an end date, the sidebar shows how many days are left, in gray, amber or red as the date gets closer.",
          "Three days before and on the day itself we remind you in the app, with what you'd lose and the plan you want to keep.",
          "You can schedule the payment for the day your plan ends. Your plan only changes once Stripe confirms the charge.",
          "When you create your account you see everything each plan includes before choosing; Foodie is selected by default.",
        ],
      },
      da: {
        title: "Din plan uden overraskelser",
        items: [
          "Hvis din plan har en udløbsdato, viser menuen, hvor mange dage der er tilbage, i gråt, ravgult eller rødt, efterhånden som datoen nærmer sig.",
          "Tre dage før og på selve dagen minder vi dig om det i appen, med hvad du ville miste, og den plan du vil fortsætte med.",
          "Du kan planlægge betalingen til den dag, din plan udløber. Din plan skifter kun, når Stripe bekræfter betalingen.",
          "Når du opretter din konto, ser du alt, hvad hver plan indeholder, før du vælger; Foodie er valgt som standard.",
        ],
      },
      fr: {
        title: "Votre formule, sans surprise",
        items: [
          "Si votre formule a une date d'expiration, le menu latéral affiche les jours restants, en gris, ambre ou rouge à mesure que la date approche.",
          "Trois jours avant et le jour même, nous vous le rappelons dans l'application, avec ce que vous perdriez et la formule à garder.",
          "Vous pouvez programmer le paiement pour le jour où votre formule expire. Votre formule ne change qu'une fois le prélèvement confirmé par Stripe.",
          "En créant votre compte, vous voyez tout ce que comprend chaque formule avant de choisir ; Foodie est sélectionnée par défaut.",
        ],
      },
      pt: {
        title: "Seu plano, sem surpresas",
        items: [
          "Se o seu plano tem data de vencimento, o menu lateral mostra quantos dias faltam, em cinza, âmbar ou vermelho conforme a data se aproxima.",
          "Três dias antes e no próprio dia avisamos você no app, com o que você perderia e o plano com o qual quer continuar.",
          "Você pode programar o pagamento para o dia em que seu plano vence. Seu plano só muda quando a Stripe confirma a cobrança.",
          "Ao criar sua conta, você vê tudo o que cada plano inclui antes de escolher; o Foodie vem escolhido por padrão.",
        ],
      },
      zh: {
        title: "你的套餐，不再有意外",
        items: [
          "如果你的套餐有到期日，侧边菜单会显示剩余天数，随着日期临近显示为灰色、琥珀色或红色。",
          "到期前三天和当天，我们会在应用中提醒你，并列出你将失去的功能和你想继续使用的套餐。",
          "你可以把付款预约在套餐到期当天。只有在 Stripe 确认扣款后，套餐才会更改。",
          "创建账户时，你可以先看到每个套餐包含的全部内容再选择；默认选中 Foodie。",
        ],
      },
    },
  },
  {
    version: "2026-10-17",
    tutorialHref: tourHref("ficha-tecnica"),
    content: {
      es: {
        title: "Sub-recetas: costos al día en toda la cadena",
        items: [
          "Si sube un ingrediente, ahora también se recalculan los platos que lo usan a través de una sub-receta (por ejemplo, los que llevan la salsa y no el tomate suelto), en cualquier nivel. Sus precios siguen la regla de siempre: solo suben.",
          "Si una sub-receta tiene un precio de venta que escribiste a mano y su costo sube, la app te pregunta si también quieres subir ese precio: todas, una por una o ninguna, y puedes recordar tu elección.",
          "En la Ficha Técnica de cada sub-receta eliges qué hacer con su precio cuando sube el costo: preguntarme, actualizar siempre o no actualizar nunca. Ahí también desmarcas una elección que recordaste.",
          "Guardar una sub-receta recalcula al instante las recetas que la usan.",
        ],
      },
      en: {
        title: "Sub-recipes: costs up to date across the whole chain",
        items: [
          "When an ingredient goes up, the dishes that use it through a sub-recipe (for example, the ones with the sauce instead of loose tomato) are now recalculated too, at any level. Their prices follow the usual rule: they only go up.",
          "If a sub-recipe has a sale price you wrote by hand and its cost goes up, the app asks whether you also want to raise that price: all, one by one or none, and you can remember your choice.",
          "In each sub-recipe's Recipe Sheet you choose what happens to its price when the cost goes up: ask me, always update or never update. That's also where you uncheck a remembered choice.",
          "Saving a sub-recipe instantly recalculates the recipes that use it.",
        ],
      },
      da: {
        title: "Underopskrifter: opdaterede omkostninger i hele kæden",
        items: [
          "Når en ingrediens bliver dyrere, genberegnes nu også de retter, der bruger den via en underopskrift (fx dem med saucen i stedet for løse tomater), på alle niveauer. Deres priser følger den sædvanlige regel: de stiger kun.",
          "Hvis en underopskrift har en salgspris, du har skrevet i hånden, og dens omkostning stiger, spørger appen, om du også vil hæve prisen: alle, én ad gangen eller ingen, og du kan huske dit valg.",
          "I hver underopskrifts tekniske ark vælger du, hvad der sker med prisen, når omkostningen stiger: spørg mig, opdater altid eller opdater aldrig. Her fjerner du også et husket valg.",
          "Når du gemmer en underopskrift, genberegnes de opskrifter, der bruger den, med det samme.",
        ],
      },
      fr: {
        title: "Sous-recettes : des coûts à jour dans toute la chaîne",
        items: [
          "Quand un ingrédient augmente, les plats qui l'utilisent via une sous-recette (par exemple ceux avec la sauce plutôt que la tomate seule) sont maintenant recalculés aussi, à tous les niveaux. Leurs prix suivent la règle habituelle : ils ne font que monter.",
          "Si une sous-recette a un prix de vente saisi à la main et que son coût augmente, l'application vous demande si vous voulez aussi monter ce prix : toutes, une par une ou aucune, et vous pouvez mémoriser votre choix.",
          "Dans la fiche technique de chaque sous-recette, vous choisissez ce qui arrive à son prix quand le coût augmente : me demander, toujours mettre à jour ou ne jamais mettre à jour. C'est aussi là que vous décochez un choix mémorisé.",
          "Enregistrer une sous-recette recalcule immédiatement les recettes qui l'utilisent.",
        ],
      },
      pt: {
        title: "Sub-receitas: custos em dia em toda a cadeia",
        items: [
          "Quando um ingrediente sobe, agora também são recalculados os pratos que o usam através de uma sub-receita (por exemplo, os que levam o molho e não o tomate solto), em qualquer nível. Os preços seguem a regra de sempre: só sobem.",
          "Se uma sub-receita tem um preço de venda escrito à mão e o custo dela sobe, o app pergunta se você também quer subir esse preço: todas, uma por uma ou nenhuma, e você pode lembrar a escolha.",
          "Na Ficha Técnica de cada sub-receita você escolhe o que acontece com o preço quando o custo sobe: perguntar, atualizar sempre ou nunca atualizar. É ali também que você desmarca uma escolha lembrada.",
          "Salvar uma sub-receita recalcula na hora as receitas que a usam.",
        ],
      },
      zh: {
        title: "子配方：整条链上的成本保持最新",
        items: [
          "食材涨价时，通过子配方使用它的菜品（例如用酱汁而不是直接用番茄的菜）现在也会在任何层级重新计算。它们的价格遵循一贯规则：只升不降。",
          "如果某个子配方有你手动填写的售价且成本上涨，应用会询问是否也提高该售价：全部、逐个或都不，并且可以记住你的选择。",
          "在每个子配方的技术配方表中，你可以选择成本上涨时售价如何处理：每次询问、始终更新或从不更新。也可以在那里取消已记住的选择。",
          "保存子配方时，会立即重新计算使用它的配方。",
        ],
      },
    },
  },
  {
    version: "2026-10-11",
    content: {
      es: {
        title: "Precios que te cuidan el margen",
        items: [
          "Tus precios ya no bajan solos: si sube el costo de un ingrediente y una receta queda corta, su precio sube al nuevo sugerido. Si el costo baja, el precio se mantiene (como si lo hubieras escrito tú) y en Notificaciones te avisamos cuánto subió tu margen.",
          "Food Cost % es ahora el método de precio recomendado para recetas y negocios nuevos. Tus recetas guardadas conservan su método y su precio.",
          "ISV en Food Cost %: precio = costo ÷ objetivo × (1 + ISV). La Ficha Técnica muestra el ISV incluido y mide el margen sobre la venta sin impuesto.",
          "Al cambiar de plan te queda una notificación y un tutorial corto con lo que tu plan nuevo desbloquea y dónde está cada cosa.",
          "100 cocinas fundadoras: las primeras 100 cuentas nuevas reciben Chef Ejecutivo gratis por 30 días.",
          "Ficha Técnica e Ingredientes se ven completas en el celular, sin desplazarse de lado.",
          "Fechas de Notificaciones y Actividad en tu idioma, y al importar ingredientes te avisamos si un contenido en g o ml parece mal cargado.",
          "Síguenos en Instagram y Facebook (@gastrometrics.app) para tips de costeo y novedades: los enlaces están al pie del sitio.",
        ],
      },
      en: {
        title: "Prices that protect your margin",
        items: [
          "Your prices no longer drop on their own: if an ingredient's cost rises and a recipe falls short, its price moves up to the new suggested price. If the cost drops, the price stays (as if you had typed it) and Notifications tells you how much your margin rose.",
          "Food Cost % is now the recommended pricing method for new recipes and businesses. Your saved recipes keep their method and price.",
          "Sales tax in Food Cost %: price = cost ÷ target × (1 + tax). The Recipe Sheet shows the tax included and measures margin on sales before tax.",
          "When your plan changes you get a notification and a short tutorial showing what your new plan unlocks and where everything is.",
          "100 founding kitchens: the first 100 new accounts get Executive Chef free for 30 days.",
          "The Recipe Sheet and Ingredients fit fully on your phone, with no sideways scrolling.",
          "Notification and Activity dates in your language, and when importing ingredients we warn you if a content in g or ml looks wrong.",
          "Follow us on Instagram and Facebook (@gastrometrics.app) for costing tips and news: the links are at the bottom of the site.",
        ],
      },
      da: {
        title: "Priser, der beskytter din margin",
        items: [
          "Dine priser falder ikke længere af sig selv: stiger en ingrediens' kostpris, og en opskrift bliver for billig, hæves prisen til den nye foreslåede pris. Falder kostprisen, bliver prisen stående (som om du havde skrevet den), og under Notifikationer kan du se, hvor meget din margin steg.",
          "Food Cost % er nu den anbefalede prismetode for nye opskrifter og virksomheder. Dine gemte opskrifter beholder deres metode og pris.",
          "Moms i Food Cost %: pris = kostpris ÷ mål × (1 + moms). Det tekniske ark viser den inkluderede moms og måler marginen på salget uden moms.",
          "Når din plan ændres, får du en notifikation og en kort vejledning i, hvad din nye plan låser op, og hvor tingene findes.",
          "100 stiftende køkkener: de første 100 nye konti får Executive Chef gratis i 30 dage.",
          "Det tekniske ark og Ingredienser passer helt på mobilen uden sidelæns rulning.",
          "Datoer i Notifikationer og Aktivitet på dit sprog, og ved import af ingredienser advarer vi dig, hvis et indhold i g eller ml ser forkert ud.",
          "Følg os på Instagram og Facebook (@gastrometrics.app) for tips om kostberegning og nyheder: linkene er nederst på siden.",
        ],
      },
      fr: {
        title: "Des prix qui protègent votre marge",
        items: [
          "Vos prix ne baissent plus tout seuls : si le coût d'un ingrédient augmente et qu'une recette devient insuffisante, son prix passe au nouveau prix suggéré. Si le coût baisse, le prix reste (comme si vous l'aviez saisi) et Notifications vous indique de combien votre marge a augmenté.",
          "Le Food Cost % est désormais la méthode de prix recommandée pour les nouvelles recettes et établissements. Vos recettes enregistrées gardent leur méthode et leur prix.",
          "TVA dans le Food Cost % : prix = coût ÷ objectif × (1 + TVA). La fiche technique affiche la TVA incluse et mesure la marge sur les ventes hors taxe.",
          "Quand votre forfait change, vous recevez une notification et un court tutoriel sur ce que votre nouveau forfait débloque et où tout se trouve.",
          "100 cuisines fondatrices : les 100 premiers nouveaux comptes reçoivent Chef Exécutif gratuitement pendant 30 jours.",
          "La fiche technique et les Ingrédients s'affichent entièrement sur mobile, sans défilement horizontal.",
          "Dates des Notifications et de l'Activité dans votre langue, et à l'import d'ingrédients nous vous avertissons si un contenu en g ou ml semble erroné.",
          "Suivez-nous sur Instagram et Facebook (@gastrometrics.app) pour des conseils de calcul des coûts et des nouveautés : les liens sont en bas du site.",
        ],
      },
      pt: {
        title: "Preços que protegem a sua margem",
        items: [
          "Os seus preços não baixam mais sozinhos: se o custo de um ingrediente sobe e uma receita fica curta, o preço sobe para o novo sugerido. Se o custo baixa, o preço se mantém (como se você o tivesse digitado) e em Notificações avisamos quanto a sua margem subiu.",
          "Food Cost % agora é o método de preço recomendado para receitas e negócios novos. As suas receitas salvas mantêm o método e o preço.",
          "Imposto no Food Cost %: preço = custo ÷ objetivo × (1 + imposto). A Ficha Técnica mostra o imposto incluído e mede a margem sobre a venda sem imposto.",
          "Ao mudar de plano você recebe uma notificação e um tutorial curto com o que o novo plano libera e onde fica cada coisa.",
          "100 cozinhas fundadoras: as primeiras 100 contas novas recebem Chef Executivo grátis por 30 dias.",
          "A Ficha Técnica e Ingredientes cabem inteiras no celular, sem rolar para o lado.",
          "Datas de Notificações e Atividade no seu idioma, e ao importar ingredientes avisamos se um conteúdo em g ou ml parece errado.",
          "Siga-nos no Instagram e no Facebook (@gastrometrics.app) para dicas de custeio e novidades: os links estão no rodapé do site.",
        ],
      },
      zh: {
        title: "守护利润率的定价",
        items: [
          "售价不再自动下降：如果食材成本上涨导致配方售价不够，售价会调整到新的建议售价。如果成本下降，售价保持不变（就像你手动输入的一样），并会在“通知”中告诉你利润率提高了多少。",
          "食材成本率（Food Cost %）现在是新配方和新店铺的推荐定价方法。已保存的配方保留原来的方法和售价。",
          "食材成本率中的税：售价 = 成本 ÷ 目标 × (1 + 税率)。技术配方表会显示含税金额，并按不含税销售额计算利润率。",
          "更换套餐时，你会收到一条通知和一个简短教程，介绍新套餐解锁的功能及其位置。",
          "100 家创始厨房：前 100 个新账户可免费使用行政主厨套餐 30 天。",
          "技术配方表和食材页面在手机上可完整显示，无需左右滑动。",
          "通知和动态的日期以你的语言显示；导入食材时，如果以克或毫升计的含量看起来有误，我们会提醒你。",
          "在 Instagram 和 Facebook（@gastrometrics.app）关注我们，获取成本核算技巧和最新消息：链接在网站底部。",
        ],
      },
    },
  },
  {
    version: "2026-10-04-d",
    content: {
      es: {
        title: "Tickets, fichas técnicas y recetarios",
        items: [
          "Libros de Excel completos (.xlsx, .xlsm o .xls): la app elige la hoja de ingredientes o la de la ficha técnica, entiende columnas como «Conversión» y «Unidad receta», y deja importar en 0 los productos sin precio para completarlos después.",
          "Desde Home Cook, con cualquier lista (por ejemplo, la de tu proveedor) puedes actualizar el precio de los ingredientes que ya tienes y recalcular tus recetas.",
          "Inventario: en «Registrar inventario» puedes leer tu hoja de conteo desde una foto, un PDF o un Excel, y las cantidades se llenan solas.",
          "Nueva revisión de lo leído: vas directo a la receta entendida, con la foto al lado, un resumen y el estado de cada ingrediente («En tu base», «Nuevo» o «Revisa»).",
          "Nuevo: carga ingredientes desde la foto o el PDF de un ticket o factura del supermercado. La app lee cada producto con su precio, deja fuera totales e impuestos, y puedes corregir nombre y precio antes de importar.",
          "Desde Home Cook, con un ticket también puedes actualizar el precio de los ingredientes que ya tienes, y sus recetas se recalculan solas.",
          "Recetarios en PDF de muchas páginas: la app elige sola la primera página con una receta y puedes cambiarla. Si la ficha técnica trae costos, se usan como precio del ingrediente nuevo.",
          "Se leen mejor las fichas técnicas reales: tablas con columnas de costo o nutrición, nombres partidos en dos líneas, fichas a dos columnas y abreviaturas como «c», «t» y «T».",
          "Una foto tomada de lado se gira sola.",
          "Importar tus datos desde donde ya los tienes (texto, Excel, PDF, fotos y tickets) está incluido en todos los planes, también en Foodie.",
        ],
      },
      en: {
        title: "Receipts, recipe sheets and recipe books",
        items: [
          "Complete Excel workbooks (.xlsx, .xlsm or .xls): the app picks the ingredients sheet or the recipe sheet, understands columns like \"Conversion\" and \"Recipe unit\", and lets you import products without a price at 0 to complete later.",
          "From Home Cook, with any list (for example, your supplier's) you can update the price of the ingredients you already have and recalculate your recipes.",
          "Inventory: in \"Register inventory\" you can read your count sheet from a photo, a PDF or an Excel file, and the quantities fill in automatically.",
          "New review of what was read: you go straight to the recipe as understood, with the photo beside it, a summary and each ingredient's status (\"In your database\", \"New\" or \"Check\").",
          "New: load ingredients from the photo or PDF of a supermarket receipt or invoice. The app reads each product with its price, leaves out totals and taxes, and you can fix the name and price before importing.",
          "From Home Cook, with a receipt you can also update the price of ingredients you already have, and their recipes recalculate on their own.",
          "Multi-page PDF recipe books: the app picks the first page with a recipe and you can change it. If the recipe sheet includes costs, they're used as the new ingredient's price.",
          "Real recipe sheets are read better: tables with cost or nutrition columns, names split over two lines, two-column cards and abbreviations like \"c\", \"t\" and \"T\".",
          "A photo taken sideways is rotated automatically.",
          "Importing your data from wherever it already is (text, Excel, PDF, photos and receipts) is included in every plan, Foodie too.",
        ],
      },
      da: {
        title: "Kvitteringer, opskriftsark og opskriftsbøger",
        items: [
          "Hele Excel-projektmapper (.xlsx, .xlsm eller .xls): appen vælger arket med ingredienser eller opskriftsarket, forstår kolonner som \"Omregning\" og \"Opskriftsenhed\" og lader dig importere produkter uden pris til 0, så du kan udfylde dem senere.",
          "Fra Home Cook kan du med en hvilken som helst liste (f.eks. din leverandørs) opdatere prisen på de ingredienser, du allerede har, og genberegne dine opskrifter.",
          "Lager: under \"Registrer lager\" kan du læse dit optællingsark fra et foto, en PDF eller en Excel-fil, og mængderne udfyldes automatisk.",
          "Ny gennemgang af det læste: du kommer direkte til opskriften, som den er forstået, med fotoet ved siden af, et resumé og status for hver ingrediens (\"I din database\", \"Ny\" eller \"Tjek\").",
          "Nyt: indlæs ingredienser fra fotoet eller PDF'en af en kvittering eller faktura fra supermarkedet. Appen læser hvert produkt med pris, udelader totaler og moms, og du kan rette navn og pris før importen.",
          "Fra Home Cook kan du også med en kvittering opdatere prisen på de ingredienser, du allerede har, og deres opskrifter genberegnes af sig selv.",
          "Opskriftsbøger i PDF med mange sider: appen vælger selv den første side med en opskrift, og du kan skifte side. Har opskriftsarket priser, bruges de som pris for den nye ingrediens.",
          "Rigtige opskriftsark læses bedre: tabeller med pris- eller næringskolonner, navne delt over to linjer, kort i to kolonner og forkortelser som \"c\", \"t\" og \"T\".",
          "Et foto taget på langs drejes automatisk.",
          "Import af dine data, hvor de end ligger i dag (tekst, Excel, PDF, fotos og kvitteringer), er med i alle planer, også Foodie.",
        ],
      },
      fr: {
        title: "Tickets, fiches techniques et recueils de recettes",
        items: [
          "Classeurs Excel complets (.xlsx, .xlsm ou .xls) : l'application choisit la feuille des ingrédients ou celle de la fiche technique, comprend des colonnes comme « Conversion » et « Unité recette », et permet d'importer à 0 les produits sans prix pour les compléter plus tard.",
          "Dès Home Cook, avec n'importe quelle liste (par exemple celle de votre fournisseur), vous pouvez mettre à jour le prix des ingrédients que vous avez déjà et recalculer vos recettes.",
          "Inventaire : dans « Enregistrer l'inventaire », vous pouvez lire votre feuille de comptage depuis une photo, un PDF ou un fichier Excel, et les quantités se remplissent seules.",
          "Nouvelle vérification de ce qui a été lu : vous arrivez directement à la recette comprise, avec la photo à côté, un résumé et le statut de chaque ingrédient (« Dans votre base », « Nouveau » ou « À vérifier »).",
          "Nouveau : chargez des ingrédients depuis la photo ou le PDF d'un ticket ou d'une facture de supermarché. L'application lit chaque produit avec son prix, ignore totaux et taxes, et vous pouvez corriger nom et prix avant d'importer.",
          "Dès Home Cook, avec un ticket, vous pouvez aussi mettre à jour le prix des ingrédients que vous avez déjà, et leurs recettes se recalculent toutes seules.",
          "Recueils de recettes en PDF de nombreuses pages : l'application choisit seule la première page avec une recette et vous pouvez en changer. Si la fiche technique contient des coûts, ils servent de prix au nouvel ingrédient.",
          "Les vraies fiches techniques sont mieux lues : tableaux avec colonnes de coûts ou de nutrition, noms coupés sur deux lignes, fiches à deux colonnes et abréviations comme « c », « t » et « T ».",
          "Une photo prise de côté est pivotée automatiquement.",
          "Importer vos données là où elles se trouvent déjà (texte, Excel, PDF, photos et tickets) est inclus dans toutes les offres, Foodie compris.",
        ],
      },
      pt: {
        title: "Cupons, fichas técnicas e receituários",
        items: [
          "Pastas do Excel completas (.xlsx, .xlsm ou .xls): o app escolhe a planilha de ingredientes ou a da ficha técnica, entende colunas como «Conversão» e «Unidade receita» e permite importar em 0 os produtos sem preço para completar depois.",
          "A partir do Home Cook, com qualquer lista (por exemplo, a do seu fornecedor) você pode atualizar o preço dos ingredientes que já tem e recalcular suas receitas.",
          "Estoque: em «Registrar estoque» você pode ler sua folha de contagem a partir de uma foto, um PDF ou um Excel, e as quantidades são preenchidas sozinhas.",
          "Nova revisão do que foi lido: você vai direto para a receita entendida, com a foto ao lado, um resumo e o status de cada ingrediente («Na sua base», «Novo» ou «Revise»).",
          "Novo: cadastre ingredientes a partir da foto ou do PDF de um cupom ou nota fiscal do supermercado. O app lê cada produto com o preço, deixa de fora totais e impostos, e você pode corrigir nome e preço antes de importar.",
          "A partir do Home Cook, com um cupom você também pode atualizar o preço dos ingredientes que já tem, e suas receitas são recalculadas sozinhas.",
          "Receituários em PDF de muitas páginas: o app escolhe sozinho a primeira página com uma receita e você pode trocá-la. Se a ficha técnica traz custos, eles são usados como preço do ingrediente novo.",
          "Fichas técnicas reais são lidas melhor: tabelas com colunas de custo ou nutrição, nomes divididos em duas linhas, fichas em duas colunas e abreviações como «c», «t» e «T».",
          "Uma foto tirada de lado é girada automaticamente.",
          "Importar seus dados de onde eles já estão (texto, Excel, PDF, fotos e cupons) está incluído em todos os planos, inclusive no Foodie.",
        ],
      },
      zh: {
        title: "小票、技术配方表与配方合集",
        items: [
          "支持完整的 Excel 文件（.xlsx、.xlsm 或 .xls）：应用会自动选择食材表或技术配方表，能识别“换算”“配方单位”等列，没有价格的商品可按 0 导入，稍后补充。",
          "Home Cook 起，使用任何价目表（例如供应商的价目表）都可以更新已有食材的价格，并重新计算配方。",
          "库存：在“登记库存”中可以从照片、PDF 或 Excel 读取盘点表，数量会自动填入。",
          "全新的识别结果核对界面：直接显示已理解的配方，照片在旁边，顶部有摘要，每种食材都显示状态（“已在食材库”“新食材”或“请核对”）。",
          "新功能：可通过超市小票或发票的照片或 PDF 导入食材。应用会识别每件商品及其价格，忽略合计和税费，导入前可修改名称和价格。",
          "Home Cook 起，使用小票还可以更新已有食材的价格，相关配方会自动重新计算。",
          "多页 PDF 配方合集：应用会自动选择第一页含配方的页面，你也可以更换页面。如果技术配方表带有成本，会作为新食材的价格。",
          "更好地识别真实的技术配方表：带成本或营养列的表格、分两行书写的名称、双栏配方卡，以及“c”“t”“T”等缩写。",
          "横向拍摄的照片会自动旋转。",
          "从你现有的资料直接导入（文本、Excel、PDF、照片和小票），所有套餐（包括 Foodie）均包含。",
        ],
      },
    },
  },
  {
    version: "2026-10-04-c",
    content: {
      es: {
        title: "Trae tus cosas en minutos",
        items: [
          "Importar ingredientes ya no necesita la plantilla: sube tu Excel o CSV tal como lo tienes, o pega tu lista desde una hoja de cálculo, un correo o WhatsApp. Se leen bien los precios con símbolo de moneda («₡1.500», «$8,50») y antes de importar ves qué entra y qué se omite.",
          "Si la lista no trae categoría, se sugiere por el nombre del ingrediente.",
          "«Importar receta» ahora acepta Excel y PDF, incluso PDF escaneados, además de texto y fotos.",
          "No tienes que elegir el idioma de la receta: se asume el de tu app y, si la receta está en otro (de los 6), la app lo detecta y la lee con el correcto.",
          "«Tu camino» y los recorridos te llevan directo a importar: primero tus ingredientes, después tus recetas una tras otra.",
        ],
      },
      en: {
        title: "Bring your stuff in within minutes",
        items: [
          "Importing ingredients no longer needs the template: upload your Excel or CSV as it is, or paste your list from a spreadsheet, an email or WhatsApp. Prices with currency symbols (\"$8,50\", \"1,250.75\") are read correctly and before importing you see what comes in and what is skipped.",
          "If the list has no category, one is suggested from the ingredient name.",
          "\"Import recipe\" now accepts Excel and PDF, even scanned PDFs, as well as text and photos.",
          "You don't have to choose the recipe's language: your app language is assumed and, if the recipe is in another one (of the 6), the app detects it and reads it with the right one.",
          "\"Your path\" and the tours take you straight to importing: first your ingredients, then your recipes one after another.",
        ],
      },
      da: {
        title: "Hent dine ting ind på få minutter",
        items: [
          "Import af ingredienser kræver ikke længere skabelonen: upload din Excel eller CSV, som den er, eller indsæt listen fra et regneark, en e-mail eller WhatsApp. Priser med valutategn (\"12,50 kr\", \"1.250,75\") læses korrekt, og før importen ser du, hvad der kommer ind, og hvad der springes over.",
          "Har listen ingen kategori, foreslås en ud fra ingrediensens navn.",
          "\"Importér opskrift\" accepterer nu Excel og PDF, også scannede PDF'er, ud over tekst og fotos.",
          "Du behøver ikke vælge opskriftens sprog: appens sprog antages, og er opskriften på et andet (af de 6), opdager appen det og læser den med det rigtige.",
          "\"Din vej\" og guiderne fører dig direkte til import: først dine ingredienser, derefter dine opskrifter én efter én.",
        ],
      },
      fr: {
        title: "Importez vos données en quelques minutes",
        items: [
          "Importer des ingrédients ne demande plus le modèle : téléversez votre Excel ou CSV tel quel, ou collez votre liste depuis un tableur, un e-mail ou WhatsApp. Les prix avec symbole monétaire (« 1,50 € », « 1 250,75 ») sont bien lus et, avant d'importer, vous voyez ce qui entre et ce qui est ignoré.",
          "Si la liste n'a pas de catégorie, elle est suggérée d'après le nom de l'ingrédient.",
          "« Importer une recette » accepte maintenant Excel et PDF, même scannés, en plus du texte et des photos.",
          "Plus besoin de choisir la langue de la recette : celle de votre application est utilisée par défaut et, si la recette est dans une autre (parmi les 6), l'application la détecte et la lit avec la bonne.",
          "« Votre parcours » et les visites guidées vous mènent directement à l'import : d'abord vos ingrédients, puis vos recettes l'une après l'autre.",
        ],
      },
      pt: {
        title: "Traga suas coisas em minutos",
        items: [
          "Importar ingredientes não precisa mais do modelo: envie seu Excel ou CSV como está, ou cole sua lista de uma planilha, um e-mail ou WhatsApp. Preços com símbolo de moeda («R$ 1,50», «1.250,75») são lidos corretamente e, antes de importar, você vê o que entra e o que é ignorado.",
          "Se a lista não tiver categoria, ela é sugerida pelo nome do ingrediente.",
          "«Importar receita» agora aceita Excel e PDF, inclusive PDFs escaneados, além de texto e fotos.",
          "Você não precisa escolher o idioma da receita: assume-se o do seu app e, se a receita estiver em outro (dos 6), o app detecta e a lê com o certo.",
          "«Seu caminho» e os tours levam você direto a importar: primeiro seus ingredientes, depois suas receitas uma atrás da outra.",
        ],
      },
      zh: {
        title: "几分钟搬入你的数据",
        items: [
          "导入食材不再需要模板：按原样上传 Excel 或 CSV，或从表格、邮件、WhatsApp 粘贴清单。带货币符号的价格（“¥8.50”“1,250.75”）都能正确读取，导入前可看到哪些会导入、哪些会跳过。",
          "如果清单没有分类，会根据食材名称自动建议。",
          "“导入配方”现已支持 Excel 和 PDF（包括扫描版 PDF），以及文本和照片。",
          "无需选择配方语言：默认使用应用当前的语言；如果配方是其他语言（6 种之一），应用会自动识别并用正确的语言读取。",
          "“之路”和引导教程会直接带你去导入：先导入食材，再一份接一份地导入配方。",
        ],
      },
    },
  },
  {
    version: "2026-10-04-b",
    content: {
      es: {
        title: "Importa tus recetas y empieza más fácil",
        items: [
          "Nuevo: «Importar receta» en Mis Recetas. Pega una receta tal como la tienes escrita (o sube un archivo) y se convierte en una ficha técnica, con los ingredientes de tu base y las cantidades convertidas a su unidad.",
          "También puedes tomarle una foto a la receta con la cámara del celular: la app lee el texto, te marca las líneas dudosas para que las corrijas y lo convierte en ficha técnica. La foto se lee en tu propio dispositivo.",
          "El menú se va completando paso a paso: los módulos avanzados aparecen al crear tus primeras recetas, y el Dashboard te muestra «Tu camino». Si quieres verlo todo, hay un botón para mostrar todos los módulos.",
          "El recorrido de Ingredientes termina abriendo la importación masiva, para cargar toda tu lista de una vez (también puedes seguir agregándolos uno por uno).",
          "Nueva casilla «Recuérdame en este dispositivo» al iniciar sesión.",
        ],
      },
      en: {
        title: "Import your recipes and get started more easily",
        items: [
          "New: \"Import recipe\" in My Recipes. Paste a recipe as you have it written (or upload a file) and it becomes a recipe sheet, with your database ingredients and quantities converted to their unit.",
          "You can also take a photo of the recipe with your phone camera: the app reads the text, highlights doubtful lines for you to fix and turns it into a recipe sheet. The photo is read on your own device.",
          "The menu fills in step by step: advanced modules appear as you create your first recipes, and the Dashboard shows \"Your path\". To see everything, there's a button to show all modules.",
          "The Ingredients tour now ends by opening bulk import, so you can load your whole list at once (you can still add them one by one).",
          "New \"Remember me on this device\" box when signing in.",
        ],
      },
      da: {
        title: "Importér dine opskrifter, og kom lettere i gang",
        items: [
          "Nyt: \"Importér opskrift\" under Mine opskrifter. Indsæt en opskrift, som du har den (eller upload en fil), og den bliver til et opskriftsark med ingredienserne fra din database og mængderne omregnet til deres enhed.",
          "Du kan også tage et foto af opskriften med mobilens kamera: appen læser teksten, markerer usikre linjer, så du kan rette dem, og gør det til et opskriftsark. Fotoet læses på din egen enhed.",
          "Menuen udfyldes trin for trin: avancerede moduler dukker op, når du opretter dine første opskrifter, og Dashboardet viser \"Din vej\". Vil du se det hele, er der en knap til at vise alle moduler.",
          "Turen i Ingredienser slutter nu med at åbne masseimport, så du kan indlæse hele listen på én gang (du kan stadig tilføje dem én ad gangen).",
          "Nyt felt \"Husk mig på denne enhed\" ved login.",
        ],
      },
      fr: {
        title: "Importez vos recettes et démarrez plus facilement",
        items: [
          "Nouveau : « Importer une recette » dans Mes recettes. Collez une recette telle que vous l'avez écrite (ou téléversez un fichier) et elle devient une fiche technique, avec les ingrédients de votre base et les quantités converties dans leur unité.",
          "Vous pouvez aussi photographier la recette avec l'appareil photo du téléphone : l'application lit le texte, signale les lignes douteuses pour que vous les corrigiez et en fait une fiche technique. La photo est lue sur votre propre appareil.",
          "Le menu se complète étape par étape : les modules avancés apparaissent quand vous créez vos premières recettes, et le Dashboard affiche « Votre parcours ». Pour tout voir, un bouton affiche tous les modules.",
          "La visite des Ingrédients se termine désormais en ouvrant l'import en masse, pour charger toute votre liste d'un coup (vous pouvez toujours les ajouter un par un).",
          "Nouvelle case « Se souvenir de moi sur cet appareil » à la connexion.",
        ],
      },
      pt: {
        title: "Importe suas receitas e comece mais fácil",
        items: [
          "Novo: «Importar receita» em Minhas receitas. Cole uma receita como você a tem escrita (ou envie um arquivo) e ela vira uma ficha técnica, com os ingredientes da sua base e as quantidades convertidas para a unidade deles.",
          "Você também pode tirar uma foto da receita com a câmera do celular: o app lê o texto, marca as linhas duvidosas para você corrigir e transforma em ficha técnica. A foto é lida no seu próprio dispositivo.",
          "O menu vai se completando passo a passo: os módulos avançados aparecem ao criar suas primeiras receitas, e o Dashboard mostra «Seu caminho». Para ver tudo, há um botão para mostrar todos os módulos.",
          "O tour de Ingredientes agora termina abrindo a importação em massa, para cadastrar toda a lista de uma vez (você ainda pode adicioná-los um por um).",
          "Nova caixa «Lembrar de mim neste dispositivo» ao entrar.",
        ],
      },
      zh: {
        title: "导入你的配方，更轻松地开始",
        items: [
          "新功能：“我的配方”中的“导入配方”。按原样粘贴配方（或上传文件），即可转换为技术配方表，自动匹配你食材库中的食材，并把数量换算为对应单位。",
          "你也可以用手机相机给配方拍照：应用会识别文字、标出不确定的行供你修正，并转换为技术配方表。照片在你自己的设备上识别。",
          "菜单会逐步完善：创建最初的几个配方后会出现高级模块，仪表盘会显示“你的 Gastrometrics 之路”。想看到全部，可以点击按钮显示所有模块。",
          "食材引导教程现在结束时会打开批量导入，让你一次性导入整份清单（仍可逐个添加）。",
          "登录时新增“在此设备上记住我”选项。",
        ],
      },
    },
  },
  {
    version: "2026-10-04",
    content: {
      es: {
        title: "Correos que te avisan lo importante",
        items: [
          "Resumen semanal: cada lunes recibes tus números clave (food cost promedio, valor del inventario, productos bajo mínimo y platos con margen bajo).",
          "Alertas útiles: te avisamos cuando un producto llega a su mínimo o cuando un plato deja de cubrir su meta de food cost.",
          "También te escribimos si tu invitado no ha entrado al equipo, si un negocio nuevo sigue sin recetas o cuando alcanzas un logro.",
          "Los correos llegan con textos distintos, para que no recibas siempre el mismo. Puedes desactivarlos en Configuración → Notificaciones.",
        ],
      },
      en: {
        title: "Emails that tell you what matters",
        items: [
          "Weekly summary: every Monday you get your key numbers (average food cost, inventory value, items below minimum and dishes with low margin).",
          "Useful alerts: we let you know when an item reaches its minimum or when a dish stops meeting its food cost target.",
          "We also email you if your invitee hasn't joined the team, if a new business still has no recipes, or when you reach a milestone.",
          "Emails come with different wording so you don't always get the same one. You can turn them off in Settings → Notifications.",
        ],
      },
      da: {
        title: "E-mails, der fortæller dig det vigtige",
        items: [
          "Ugentlig oversigt: hver mandag får du dine nøgletal (gennemsnitlig food cost, lagerværdi, varer under minimum og retter med lav margin).",
          "Nyttige advarsler: vi giver besked, når en vare når sit minimum, eller når en ret ikke længere når sit food cost-mål.",
          "Vi skriver også, hvis din inviterede ikke er kommet ind i teamet, hvis en ny virksomhed stadig ikke har opskrifter, eller når du når en milepæl.",
          "E-mailene kommer med forskellige tekster, så du ikke altid får den samme. Du kan slå dem fra under Indstillinger → Notifikationer.",
        ],
      },
      fr: {
        title: "Des e-mails qui vous signalent l'essentiel",
        items: [
          "Résumé hebdomadaire : chaque lundi, vos chiffres clés (food cost moyen, valeur du stock, produits sous le minimum et plats à faible marge).",
          "Alertes utiles : nous vous prévenons quand un produit atteint son minimum ou quand un plat ne respecte plus son objectif de food cost.",
          "Nous vous écrivons aussi si votre invité n'a pas rejoint l'équipe, si un nouvel établissement n'a toujours pas de recettes ou quand vous franchissez une étape.",
          "Les e-mails arrivent avec des textes différents pour ne pas recevoir toujours le même. Vous pouvez les désactiver dans Paramètres → Notifications.",
        ],
      },
      pt: {
        title: "E-mails que avisam o que importa",
        items: [
          "Resumo semanal: toda segunda você recebe seus números principais (food cost médio, valor do estoque, produtos abaixo do mínimo e pratos com margem baixa).",
          "Alertas úteis: avisamos quando um produto chega ao mínimo ou quando um prato deixa de cumprir sua meta de food cost.",
          "Também escrevemos se seu convidado não entrou na equipe, se um negócio novo continua sem receitas ou quando você alcança uma conquista.",
          "Os e-mails chegam com textos diferentes, para você não receber sempre o mesmo. Você pode desativá-los em Configurações → Notificações.",
        ],
      },
      zh: {
        title: "告诉你重要事项的邮件",
        items: [
          "每周摘要：每周一你会收到关键数字（平均食材成本率、库存价值、低于最低库存的产品以及毛利偏低的菜品）。",
          "实用提醒：当某个产品达到最低库存，或某道菜不再达到食材成本率目标时，我们会通知你。",
          "当你邀请的人还没加入团队、新商户仍没有配方，或你达成某个里程碑时，我们也会发邮件给你。",
          "邮件会使用不同的文字，你不会总是收到同一封。你可以在“设置 → 通知”中关闭它们。",
        ],
      },
    },
  },
  {
    version: "2026-09-29-d",
    content: {
      es: {
        title: "PDF en chino y mejor traducidos",
        items: [
          "Con la app en chino, todos los PDF (fichas técnicas, menús, inventario, órdenes de compra, facturas e historial de ventas) ya se ven con caracteres chinos correctos.",
          "Las unidades, categorías y clasificaciones de los PDF salen en tu idioma, en lugar de siempre en español.",
          "Corregidos los dos puntos dobles en la ficha rápida y las tildes que faltaban en los PDF en español.",
        ],
      },
      en: {
        title: "Chinese PDFs and better translations",
        items: [
          "With the app in Chinese, every PDF (recipe sheets, menus, inventory, purchase orders, invoices and sales history) now shows proper Chinese characters.",
          "Units, categories and classifications in PDFs now appear in your language instead of always in Spanish.",
          "Fixed the double colons on the quick sheet and the missing accents in Spanish PDFs.",
        ],
      },
      da: {
        title: "PDF på kinesisk og bedre oversættelser",
        items: [
          "Med appen på kinesisk viser alle PDF'er (opskriftsark, menuer, lager, indkøbsordrer, fakturaer og salgshistorik) nu korrekte kinesiske tegn.",
          "Enheder, kategorier og klassificeringer i PDF'er vises nu på dit sprog i stedet for altid på spansk.",
          "Rettet de dobbelte koloner på hurtigarket og de manglende accenter i spanske PDF'er.",
        ],
      },
      fr: {
        title: "PDF en chinois et meilleures traductions",
        items: [
          "Avec l'application en chinois, tous les PDF (fiches techniques, menus, inventaire, bons de commande, factures et historique des ventes) affichent désormais correctement les caractères chinois.",
          "Les unités, catégories et classifications des PDF apparaissent dans votre langue au lieu de toujours en espagnol.",
          "Corrigé : les doubles deux-points de la fiche rapide et les accents manquants dans les PDF en espagnol.",
        ],
      },
      pt: {
        title: "PDFs em chinês e melhor traduzidos",
        items: [
          "Com o app em chinês, todos os PDFs (fichas técnicas, cardápios, estoque, pedidos de compra, faturas e histórico de vendas) agora mostram os caracteres chineses corretamente.",
          "Unidades, categorias e classificações nos PDFs aparecem no seu idioma, em vez de sempre em espanhol.",
          "Corrigidos os dois-pontos duplicados na ficha rápida e os acentos que faltavam nos PDFs em espanhol.",
        ],
      },
      zh: {
        title: "中文 PDF 与更完善的翻译",
        items: [
          "应用设为中文时，所有 PDF（技术配方表、菜单、库存、采购单、发票和销售记录）现在都能正确显示中文字符。",
          "PDF 中的单位、分类和类别现在以你的语言显示，而不再总是西班牙语。",
          "修复了快速单据中的双冒号，以及西班牙语 PDF 中缺失的重音符号。",
        ],
      },
    },
  },
  {
    version: "2026-09-29-c",
    content: {
      es: {
        title: "Correos más variados y cambios de plan más claros",
        items: [
          "Los recordatorios por correo ya no llegan siempre con el mismo texto: cada uno tiene tres versiones distintas y nunca recibes la misma dos veces seguidas.",
          "Cuando tu plan cambia, el correo y la ventana del Dashboard te muestran exactamente qué ganas, qué pierdes y qué incluye tu plan ahora. Tus datos nunca se borran al bajar de plan.",
          "Si un plan asignado por el equipo de Gastrometrics vence, tu cuenta pasa sola al plan gratis y te avisamos con la misma lista.",
          "Corregido: el correo de cambio de plan mostraba solo la primera función del plan.",
        ],
      },
      en: {
        title: "More varied emails and clearer plan changes",
        items: [
          "Reminder emails no longer arrive with the same text every time: each one has three different versions and you never get the same one twice in a row.",
          "When your plan changes, the email and the Dashboard window show exactly what you gain, what you lose and what your plan includes now. Your data is never deleted when you downgrade.",
          "If a plan assigned by the Gastrometrics team expires, your account moves to the free plan automatically and we let you know with the same list.",
          "Fixed: the plan-change email only showed the first feature of the plan.",
        ],
      },
      da: {
        title: "Mere varierede e-mails og tydeligere planskift",
        items: [
          "Påmindelser på e-mail kommer ikke længere med den samme tekst hver gang: hver har tre forskellige versioner, og du får aldrig den samme to gange i træk.",
          "Når din plan ændres, viser e-mailen og vinduet i Dashboardet præcis, hvad du får, hvad du mister, og hvad din plan nu omfatter. Dine data slettes aldrig, når du nedgraderer.",
          "Hvis en plan tildelt af Gastrometrics-teamet udløber, går din konto automatisk over til gratisplanen, og vi giver dig besked med den samme liste.",
          "Rettet: e-mailen om planskift viste kun planens første funktion.",
        ],
      },
      fr: {
        title: "Des e-mails plus variés et des changements de forfait plus clairs",
        items: [
          "Les rappels par e-mail n'arrivent plus toujours avec le même texte : chacun a trois versions différentes et vous ne recevez jamais la même deux fois de suite.",
          "Quand votre forfait change, l'e-mail et la fenêtre du Dashboard indiquent exactement ce que vous gagnez, ce que vous perdez et ce que comprend votre forfait. Vos données ne sont jamais supprimées en cas de rétrogradation.",
          "Si un forfait attribué par l'équipe Gastrometrics expire, votre compte passe automatiquement au forfait gratuit et nous vous prévenons avec la même liste.",
          "Corrigé : l'e-mail de changement de forfait n'affichait que la première fonctionnalité du forfait.",
        ],
      },
      pt: {
        title: "E-mails mais variados e mudanças de plano mais claras",
        items: [
          "Os lembretes por e-mail não chegam mais sempre com o mesmo texto: cada um tem três versões diferentes e você nunca recebe a mesma duas vezes seguidas.",
          "Quando seu plano muda, o e-mail e a janela do Dashboard mostram exatamente o que você ganha, o que perde e o que seu plano inclui agora. Seus dados nunca são apagados ao baixar de plano.",
          "Se um plano atribuído pela equipe da Gastrometrics vencer, sua conta passa sozinha para o plano grátis e avisamos com a mesma lista.",
          "Corrigido: o e-mail de mudança de plano mostrava só a primeira função do plano.",
        ],
      },
      zh: {
        title: "更多样的邮件和更清晰的套餐变更",
        items: [
          "提醒邮件不再每次都是同样的文字：每种提醒有三个不同版本，你不会连续两次收到同一封。",
          "当你的套餐变化时，邮件和仪表盘弹窗会准确列出你获得了什么、失去了什么以及套餐现在包含的内容。降级时你的数据永远不会被删除。",
          "如果 Gastrometrics 团队分配的套餐到期，你的账户会自动转为免费套餐，我们会用同样的清单通知你。",
          "已修复：套餐变更邮件只显示套餐的第一项功能。",
        ],
      },
    },
  },
  {
    version: "2026-09-29-b",
    content: {
      es: {
        title: "Más novedades en Gastrometrics",
        items: [
          "Migrar recetas a otro negocio ahora te pregunta: llevar también sus ingredientes y sub-recetas, o solo la receta. Si eliges solo la receta, se abre su ficha en ese negocio para que elijas los ingredientes de su propia base de datos.",
          "Corregido: al migrar una receta con sus ingredientes, los ingredientes no se guardaban en el negocio destino. Ahora sí, y sin duplicar los que ya existían.",
          "PDF: la foto del plato sale más grande y sin deformarse en las tres fichas técnicas (la administrativa ahora también la incluye), y el logo de tu negocio aparece en todos los PDF, incluida la carta para tus clientes.",
          "Las fotos que subes a una receta se optimizan solas: pesan mucho menos y siempre se ven en el PDF.",
        ],
      },
      en: {
        title: "More news in Gastrometrics",
        items: [
          "Migrating recipes to another business now asks you: bring its ingredients and sub-recipes too, or just the recipe. If you choose just the recipe, its sheet opens in that business so you pick the ingredients from its own database.",
          "Fixed: when migrating a recipe with its ingredients, the ingredients weren't saved in the target business. Now they are, without duplicating the ones that already existed.",
          "PDFs: the dish photo is bigger and no longer distorted in all three recipe sheets (the administrative one now includes it too), and your business logo appears on every PDF, including the customer menu.",
          "Photos you upload to a recipe are optimized automatically: they're much lighter and always show up in the PDF.",
        ],
      },
      da: {
        title: "Flere nyheder i Gastrometrics",
        items: [
          "Når du flytter opskrifter til en anden virksomhed, bliver du nu spurgt: skal ingredienser og underopskrifter med, eller kun opskriften? Vælger du kun opskriften, åbnes arket i virksomheden, så du vælger ingredienserne fra dens egen database.",
          "Rettet: når en opskrift blev flyttet med ingredienser, blev ingredienserne ikke gemt i den nye virksomhed. Nu gør de, uden at dem, der allerede fandtes, bliver dubleret.",
          "PDF'er: fotoet af retten er større og ikke længere forvrænget i alle tre opskriftsark (det administrative har det nu også), og din virksomheds logo vises på alle PDF'er, også gæstemenuen.",
          "Fotos, du uploader til en opskrift, optimeres automatisk: de fylder meget mindre og vises altid i PDF'en.",
        ],
      },
      fr: {
        title: "Encore des nouveautés dans Gastrometrics",
        items: [
          "Migrer une recette vers un autre établissement vous demande désormais : emporter aussi ses ingrédients et sous-recettes, ou seulement la recette. Si vous choisissez seulement la recette, sa fiche s'ouvre dans cet établissement pour que vous choisissiez les ingrédients dans sa propre base.",
          "Corrigé : en migrant une recette avec ses ingrédients, ceux-ci n'étaient pas enregistrés dans l'établissement de destination. C'est désormais le cas, sans dupliquer ceux qui existaient déjà.",
          "PDF : la photo du plat est plus grande et n'est plus déformée dans les trois fiches techniques (l'administrative l'inclut désormais), et le logo de votre établissement apparaît sur tous les PDF, y compris la carte client.",
          "Les photos que vous ajoutez à une recette sont optimisées automatiquement : elles sont bien plus légères et s'affichent toujours dans le PDF.",
        ],
      },
      pt: {
        title: "Mais novidades na Gastrometrics",
        items: [
          "Migrar receitas para outro negócio agora pergunta: levar também os ingredientes e sub-receitas, ou só a receita. Se escolher só a receita, a ficha abre nesse negócio para você escolher os ingredientes da base dele.",
          "Corrigido: ao migrar uma receita com os ingredientes, eles não eram salvos no negócio de destino. Agora são, sem duplicar os que já existiam.",
          "PDFs: a foto do prato sai maior e sem distorção nas três fichas técnicas (a administrativa agora também a inclui), e o logo do seu negócio aparece em todos os PDFs, inclusive no cardápio para clientes.",
          "As fotos que você envia para uma receita são otimizadas sozinhas: ficam muito mais leves e sempre aparecem no PDF.",
        ],
      },
      zh: {
        title: "Gastrometrics 更多新功能",
        items: [
          "把配方迁移到另一个商户时，现在会询问：是否同时带上食材和子配方，还是只迁移配方。若只迁移配方，会在该商户中打开配方表，由你从该商户自己的数据库选择食材。",
          "已修复：连同食材迁移配方时，食材没有保存到目标商户。现在会正确保存，且不会重复已有的食材。",
          "PDF：三种技术配方表中的菜品照片更大且不再变形（管理版现在也包含照片），你的商户标志会出现在所有 PDF 上，包括给客人的菜单。",
          "上传到配方的照片会自动优化：体积小得多，并且始终能在 PDF 中显示。",
        ],
      },
    },
  },
  {
    version: "2026-09-29",
    content: {
      es: {
        title: "Novedades en Gastrometrics: bebidas y barra",
        items: [
          "Costea tu barra como costeas tu cocina: nuevas categorías de ingrediente (destilados, vinos, cerveza de barril y embotellada, refrescos y mixers) con su merma típica, y clasificaciones «Barra · Cócteles / Vinos / Cervezas / Sin alcohol / Café y té» en Ficha Técnica.",
          "Al elegir una clasificación de barra, el precio se calcula con pour cost (lo típico: tragos 20 %, vino 30 %, cerveza 24 %), sin tocar el objetivo de tus platos.",
          "Nuevo botón «Vender por copa o botella» en Ingredientes: crea en segundos la ficha de una copa de vino, un shot o una botella con el costo por servicio ya calculado.",
          "Inventario de barra: cuenta en botellas con decimales (2.3 = 2 enteras y 3 décimos de la abierta) o con báscula, y mira stock, mínimo y faltantes en botellas.",
          "Reportes → Finanzas: cocina y barra por separado (ventas, costo teórico y costo real de cada una) y Menu Engineering por área.",
          "El precio sugerido ahora se redondea según tu moneda (por ejemplo, al 0.50 en dólares o euros, en vez de siempre al 5).",
          "Corregido el valor del inventario y el costo real: ahora se calcula con el precio de cada envase dividido entre su contenido.",
          "Comisión de delivery o tarjeta en Ficha Técnica: escribe el % que se queda la app o el banco y el precio sugerido la cubre; ves la comisión por plato y lo que te queda.",
          "Alérgenos: márcalos en cada ingrediente y aparecen solos en tus recetas, en los PDF de la ficha y bajo cada plato en la carta del cliente.",
          "Nuevo tipo de menú «Carta de bebidas», con tiempos de Cócteles, Vinos, Cervezas y Bebidas sin alcohol.",
          "Correcciones: un conteo de inventario ahora actualiza también los productos agregados a mano; los precios por gramo o mililitro muestran hasta 4 decimales (antes salían en 0.00); el Paso, la clasificación, el tipo de menú y los tiempos de menú aparecen siempre en tu idioma.",
        ],
      },
      en: {
        title: "What's new in Gastrometrics: drinks and bar",
        items: [
          "Cost your bar the way you cost your kitchen: new ingredient categories (spirits, wine, draft and bottled beer, soft drinks and mixers) with their typical loss, and “Bar · Cocktails / Wine / Beer / Non-alcoholic / Coffee & tea” classifications in the Recipe Sheet.",
          "When you pick a bar classification, the price is calculated with pour cost (typical: cocktails 20%, wine 30%, beer 24%), without touching your dishes' target.",
          "New “Sell by the glass or bottle” button in Ingredients: create a glass of wine, a shot or a bottle in seconds, with the cost per serving already calculated.",
          "Bar inventory: count bottles with decimals (2.3 = 2 full and 3 tenths of the open one) or with a scale, and see stock, minimum and shortfalls in bottles.",
          "Reports → Finance: kitchen and bar separately (sales, theoretical cost and actual cost for each) and Menu Engineering by area.",
          "The suggested price is now rounded to suit your currency (for example, to the next 0.50 in dollars or euros, instead of always to 5).",
          "Fixed inventory value and actual cost: they're now calculated with each container's price divided by its content.",
          "Delivery or card commission in the Recipe Sheet: enter the % the app or bank keeps and the suggested price covers it; you see the commission per dish and what you keep.",
          "Allergens: tick them on each ingredient and they show up automatically in your recipes, in the recipe PDFs and under each dish on the customer menu.",
          "New “Drinks menu” type, with Cocktails, Wines, Beers and Non-alcoholic drinks courses.",
          "Fixes: an inventory count now also updates products added by hand; prices per gram or milliliter show up to 4 decimals (they used to show 0.00); the course, classification, menu type and menu courses always appear in your language.",
        ],
      },
      da: {
        title: "Nyt i Gastrometrics: drikkevarer og bar",
        items: [
          "Kalkulér din bar, som du kalkulerer dit køkken: nye ingredienskategorier (spiritus, vin, fadøl og flaskeøl, sodavand og mixere) med deres typiske svind, og klassifikationerne “Bar · Cocktails / Vin / Øl / Alkoholfri / Kaffe og te” i Opskriftsarket.",
          "Når du vælger en barklassifikation, beregnes prisen med pour cost (typisk: cocktails 20 %, vin 30 %, øl 24 %), uden at ændre målet for dine retter.",
          "Ny knap “Sælg pr. glas eller flaske” i Ingredienser: opret et glas vin, en shot eller en flaske på sekunder med prisen pr. servering allerede beregnet.",
          "Barlager: tæl flasker med decimaler (2.3 = 2 hele og 3 tiendedele af den åbne) eller med vægt, og se lager, minimum og mangler i flasker.",
          "Rapporter → Økonomi: køkken og bar hver for sig (salg, teoretisk og faktisk omkostning for hver) og Menu Engineering pr. område.",
          "Den foreslåede pris afrundes nu efter din valuta (f.eks. til nærmeste 0.50 i dollar eller euro i stedet for altid til 5).",
          "Rettet lagerværdi og faktisk omkostning: de beregnes nu med hver beholders pris divideret med dens indhold.",
          "Provision til levering eller kort i Opskriftsarket: skriv den %, appen eller banken tager, og den foreslåede pris dækker den; du ser provisionen pr. ret, og hvad du har tilbage.",
          "Allergener: markér dem på hver ingrediens, så vises de automatisk i dine opskrifter, i opskriftens PDF'er og under hver ret på gæstemenuen.",
          "Ny menutype »Drikkekort« med serveringerne Cocktails, Vine, Øl og Alkoholfri drikke.",
          "Rettelser: en lageroptælling opdaterer nu også varer, der er tilføjet manuelt; priser pr. gram eller milliliter vises med op til 4 decimaler (før stod der 0.00); trin, klassifikation, menutype og serveringer vises altid på dit sprog.",
        ],
      },
      fr: {
        title: "Nouveautés de Gastrometrics : boissons et bar",
        items: [
          "Calculez les coûts de votre bar comme ceux de votre cuisine : nouvelles catégories d'ingrédients (spiritueux, vins, bière pression et en bouteille, sodas et mixers) avec leur perte typique, et classifications « Bar · Cocktails / Vins / Bières / Sans alcool / Café et thé » dans la Fiche technique.",
          "Quand vous choisissez une classification de bar, le prix est calculé avec le pour cost (typique : cocktails 20 %, vin 30 %, bière 24 %), sans toucher à l'objectif de vos plats.",
          "Nouveau bouton « Vendre au verre ou à la bouteille » dans Ingrédients : créez en quelques secondes la fiche d'un verre de vin, d'un shot ou d'une bouteille avec le coût par service déjà calculé.",
          "Inventaire du bar : comptez les bouteilles avec des décimales (2.3 = 2 pleines et 3 dixièmes de celle ouverte) ou à la balance, et voyez stock, minimum et manques en bouteilles.",
          "Rapports → Finances : cuisine et bar séparés (ventes, coût théorique et coût réel de chacun) et Menu Engineering par zone.",
          "Le prix suggéré est maintenant arrondi selon votre devise (par exemple au 0.50 supérieur en dollars ou en euros, au lieu de toujours à 5).",
          "Valeur d'inventaire et coût réel corrigés : ils sont désormais calculés avec le prix de chaque contenant divisé par son contenu.",
          "Commission de livraison ou de carte dans la Fiche Technique : indiquez le % que garde l'application ou la banque et le prix suggéré la couvre ; vous voyez la commission par plat et ce qu'il vous reste.",
          "Allergènes : cochez-les sur chaque ingrédient et ils apparaissent automatiquement dans vos recettes, dans les PDF de la fiche et sous chaque plat sur la carte client.",
          "Nouveau type de menu « Carte des boissons », avec les étapes Cocktails, Vins, Bières et Boissons sans alcool.",
          "Corrections : un comptage d'inventaire met désormais à jour aussi les produits ajoutés à la main ; les prix au gramme ou au millilitre affichent jusqu'à 4 décimales (avant : 0.00) ; l'étape, la classification, le type de menu et les étapes du menu s'affichent toujours dans votre langue.",
        ],
      },
      pt: {
        title: "Novidades no Gastrometrics: bebidas e bar",
        items: [
          "Custeie seu bar como custeia sua cozinha: novas categorias de ingrediente (destilados, vinhos, chope e cerveja engarrafada, refrigerantes e mixers) com sua perda típica, e classificações “Bar · Coquetéis / Vinhos / Cervejas / Sem álcool / Café e chá” na Ficha Técnica.",
          "Ao escolher uma classificação de bar, o preço é calculado com pour cost (o típico: drinks 20%, vinho 30%, cerveja 24%), sem mexer no objetivo dos seus pratos.",
          "Novo botão “Vender por taça ou garrafa” em Ingredientes: crie em segundos a ficha de uma taça de vinho, uma dose ou uma garrafa com o custo por dose já calculado.",
          "Inventário de bar: conte garrafas com decimais (2.3 = 2 inteiras e 3 décimos da aberta) ou com balança, e veja estoque, mínimo e faltas em garrafas.",
          "Relatórios → Finanças: cozinha e bar separados (vendas, custo teórico e custo real de cada um) e Menu Engineering por área.",
          "O preço sugerido agora é arredondado de acordo com sua moeda (por exemplo, para o próximo 0.50 em dólares ou euros, em vez de sempre para 5).",
          "Corrigidos o valor do inventário e o custo real: agora são calculados com o preço de cada embalagem dividido pelo seu conteúdo.",
          "Comissão de delivery ou cartão na Ficha Técnica: informe o % que o app ou o banco fica e o preço sugerido a cobre; você vê a comissão por prato e quanto sobra.",
          "Alergênicos: marque-os em cada ingrediente e eles aparecem sozinhos nas suas receitas, nos PDFs da ficha e embaixo de cada prato no cardápio do cliente.",
          "Novo tipo de cardápio «Carta de bebidas», com as etapas Coquetéis, Vinhos, Cervejas e Bebidas sem álcool.",
          "Correções: uma contagem de estoque agora também atualiza os produtos adicionados à mão; os preços por grama ou mililitro mostram até 4 casas decimais (antes apareciam como 0.00); a etapa, a classificação, o tipo de cardápio e as etapas do cardápio aparecem sempre no seu idioma.",
        ],
      },
      zh: {
        title: "Gastrometrics 新功能：饮品与酒吧",
        items: [
          "像核算厨房一样核算酒吧：新增食材分类（烈酒、葡萄酒、生啤与瓶装啤酒、软饮与调酒辅料）并带有典型损耗，配方表中新增“酒吧 · 鸡尾酒 / 葡萄酒 / 啤酒 / 无酒精饮品 / 咖啡与茶”分类。",
          "选择酒吧分类后，售价按酒水成本率计算（常见值：鸡尾酒 20%、葡萄酒 30%、啤酒 24%），不会改变菜品的目标值。",
          "食材页新增“按杯或按瓶销售”按钮：几秒内创建一杯葡萄酒、一口杯或一整瓶的配方，每份成本已自动计算。",
          "酒吧库存：可用小数按瓶盘点（2.3 = 2 瓶整瓶加开封那瓶的十分之三）或用秤称重，并以瓶为单位查看库存、最低量和短缺。",
          "报表 → 财务：厨房与酒吧分开显示（各自的销售额、理论成本和实际成本），菜单工程也可按区域查看。",
          "建议售价现在会按你的货币取整（例如美元或欧元取到下一个 0.50，而不再总是取到 5）。",
          "已修正库存价值和实际成本：现在按每个包装的价格除以其容量计算。",
          "技术配方表新增外卖或刷卡佣金：填写平台或银行抽取的百分比，建议售价会将其覆盖；你可以看到每道菜的佣金和实得金额。",
          "过敏原：在每种食材上勾选，它们会自动显示在你的配方、配方 PDF 以及客人菜单上每道菜的下方。",
          "新增“饮品单”菜单类型，包含 鸡尾酒、葡萄酒、啤酒 和 无酒精饮品 阶段。",
          "修复：库存盘点现在也会更新手动添加的产品；每克或每毫升的价格最多显示 4 位小数（以前显示为 0.00）；阶段、分类、菜单类型和菜单阶段始终以你的语言显示。",
        ],
      },
    },
  },
  {
    version: "2026-09-28",
    content: {
      es: {
        title: "Novedades en Gastrometrics",
        items: [
          "Tu receta ya no se pierde: mientras creas una receta en Ficha Técnica, se guarda sola por 24 horas. Si cierras la pestaña o te vas a otro módulo, al volver la encuentras tal como la dejaste, incluso desde otro dispositivo.",
          "Nuevo botón «Limpiar ficha» para dejar la Ficha Técnica en blanco y empezar una receta desde cero.",
          "Manual de usuario completamente rediseñado y reescrito en los 6 idiomas, con capturas nuevas, índice por capítulos y ejemplos paso a paso. Ábrelo desde Configuración → Manual de usuario (PDF).",
          "Recordatorios útiles por correo (opcionales): si llevas unos días sin entrar, te avisamos de una receta sin terminar, de tu próximo conteo de inventario, de revisar tus reportes o de actualizar precios. Nunca más de uno cada pocos días y con baja en un clic.",
          "Todos los correos y las fechas de la app ahora respetan siempre el idioma que tienes seleccionado.",
          "El plan Sous Chef ahora incluye Equipo: invita a 1 persona con permisos por función (Chef Ejecutivo, hasta 4).",
          "Nuevo en Inventario: stock teórico. Cada producto muestra cuánto debería quedar según tus ventas registradas y, al contar de nuevo, la diferencia con lo esperado para detectar mermas o faltantes.",
          "Las órdenes de compra generadas desde un menú o una receta ahora descuentan lo que ya tienes en inventario y calculan bien las cantidades de las sub-recetas.",
        ],
      },
      en: {
        title: "What's new in Gastrometrics",
        items: [
          "Your recipe is never lost: while you create a recipe in the Recipe Sheet, it's saved automatically for 24 hours. If you close the tab or go to another module, it's waiting for you exactly as you left it, even on another device.",
          "New “Clear sheet” button to reset the Recipe Sheet and start a recipe from scratch.",
          "The user manual has been completely redesigned and rewritten in all 6 languages, with new screenshots, chapter index and step-by-step examples. Open it from Settings → User manual (PDF).",
          "Helpful email reminders (optional): if you haven't signed in for a few days, we'll remind you about an unfinished recipe, your next inventory count, checking your reports or updating prices. Never more than one every few days, with one-click unsubscribe.",
          "All emails and dates in the app now always follow the language you have selected.",
          "The Sous Chef plan now includes Team: invite 1 person with per-tool permissions (Chef Ejecutivo, up to 4).",
          "New in Inventory: theoretical stock. Each item shows how much should be left based on your recorded sales and, when you count again, the difference from what was expected, so you can spot waste or missing stock.",
          "Purchase orders generated from a menu or recipe now subtract what you already have in inventory and calculate sub-recipe quantities correctly.",
        ],
      },
      da: {
        title: "Nyheder i Gastrometrics",
        items: [
          "Din opskrift går aldrig tabt: mens du opretter en opskrift i Opskriftsark, gemmes den automatisk i 24 timer. Lukker du fanen eller går til et andet modul, venter den på dig præcis som du forlod den, også på en anden enhed.",
          "Ny knap »Ryd arket« til at nulstille Opskriftsark og starte en opskrift forfra.",
          "Brugermanualen er fuldstændig redesignet og omskrevet på alle 6 sprog med nye skærmbilleder, kapitelindeks og eksempler trin for trin. Åbn den fra Indstillinger → Brugermanual (PDF).",
          "Nyttige påmindelser via e-mail (valgfrit): har du ikke været logget ind i nogle dage, minder vi dig om en ufærdig opskrift, din næste lageroptælling, at se dine rapporter eller at opdatere priser. Aldrig mere end én med få dages mellemrum og med afmelding med ét klik.",
          "Alle e-mails og datoer i appen følger nu altid det sprog, du har valgt.",
          "Sous Chef-planen inkluderer nu Team: invitér 1 person med rettigheder pr. værktøj (Chef Ejecutivo: op til 4).",
          "Nyt i Lager: teoretisk lager. Hver vare viser, hvor meget der burde være tilbage ud fra dine registrerede salg, og ved næste optælling afvigelsen fra det forventede, så du kan opdage svind eller manko.",
          "Indkøbsordrer genereret fra en menu eller opskrift trækker nu det fra, du allerede har på lager, og beregner mængderne for underopskrifter korrekt.",
        ],
      },
      fr: {
        title: "Nouveautés de Gastrometrics",
        items: [
          "Votre recette n'est plus jamais perdue : pendant que vous créez une recette dans la Fiche Technique, elle est enregistrée automatiquement pendant 24 heures. Si vous fermez l'onglet ou passez à un autre module, vous la retrouvez telle quelle, même sur un autre appareil.",
          "Nouveau bouton « Vider la fiche » pour remettre la Fiche Technique à blanc et repartir de zéro.",
          "Le manuel utilisateur a été entièrement repensé et réécrit dans les 6 langues, avec de nouvelles captures, un sommaire par chapitres et des exemples pas à pas. Ouvrez-le depuis Paramètres → Manuel utilisateur (PDF).",
          "Des rappels utiles par e-mail (facultatifs) : si vous ne vous êtes pas connecté depuis quelques jours, nous vous rappelons une recette inachevée, votre prochain inventaire, la consultation de vos rapports ou la mise à jour de vos prix. Jamais plus d'un tous les quelques jours, avec désabonnement en un clic.",
          "Tous les e-mails et les dates de l'application respectent désormais toujours la langue que vous avez choisie.",
          "Le forfait Sous Chef inclut désormais l'Équipe : invitez 1 personne avec des droits par outil (Chef Ejecutivo : jusqu'à 4).",
          "Nouveau dans Inventaire : le stock théorique. Chaque produit indique ce qu'il devrait rester d'après vos ventes enregistrées et, au comptage suivant, l'écart avec ce qui était attendu pour repérer pertes ou manquants.",
          "Les commandes d'achat générées depuis un menu ou une recette déduisent désormais ce que vous avez déjà en stock et calculent correctement les quantités des sous-recettes.",
        ],
      },
      pt: {
        title: "Novidades na Gastrometrics",
        items: [
          "Sua receita não se perde mais: enquanto você cria uma receita na Ficha Técnica, ela é salva automaticamente por 24 horas. Se fechar a aba ou for para outro módulo, ela espera por você do jeito que deixou, até em outro dispositivo.",
          "Novo botão «Limpar ficha» para deixar a Ficha Técnica em branco e começar uma receita do zero.",
          "O manual do usuário foi totalmente redesenhado e reescrito nos 6 idiomas, com novas capturas de tela, sumário por capítulos e exemplos passo a passo. Abra em Configurações → Manual do usuário (PDF).",
          "Lembretes úteis por e-mail (opcionais): se você passar alguns dias sem entrar, avisamos sobre uma receita não finalizada, sua próxima contagem de estoque, revisar seus relatórios ou atualizar preços. Nunca mais de um a cada poucos dias, com cancelamento em um clique.",
          "Todos os e-mails e datas do app agora seguem sempre o idioma que você selecionou.",
          "O plano Sous Chef agora inclui Equipe: convide 1 pessoa com permissões por ferramenta (Chef Ejecutivo: até 4).",
          "Novo no Estoque: estoque teórico. Cada produto mostra quanto deveria sobrar segundo as vendas registradas e, na próxima contagem, a diferença em relação ao esperado, para detectar perdas ou faltas.",
          "Os pedidos de compra gerados a partir de um cardápio ou receita agora descontam o que você já tem em estoque e calculam corretamente as quantidades das sub-receitas.",
        ],
      },
      zh: {
        title: "Gastrometrics 新功能",
        items: [
          "配方不再丢失：在技术配方表中创建配方时，内容会自动保存 24 小时。即使你关闭标签页或切换到其他模块，回来时也会原样恢复，在其他设备上同样可以找到。",
          "新增“清空技术配方表”按钮，可一键清空并从头开始新配方。",
          "用户手册已全面重新设计，并用 6 种语言重写，配有全新截图、章节目录和分步示例。可在 设置 → 用户手册（PDF）中打开。",
          "实用的邮件提醒（可选）：如果你几天没有登录，我们会提醒你未完成的配方、下一次库存盘点、查看报表或更新价格。每隔几天最多一封，并可一键退订。",
          "应用中的所有邮件和日期现在都会始终使用你所选择的语言。",
          "Sous Chef 套餐现已包含团队功能：可邀请 1 人并按工具分配权限（Chef Ejecutivo 套餐最多 4 人）。",
          "库存新功能：理论库存。每个产品会根据已登记的销售显示应剩数量，再次盘点时显示与预期的差异，帮助发现损耗或短缺。",
          "从菜单或配方生成的采购订单现在会扣除已有库存，并正确计算子配方的用量。",
        ],
      },
    },
  },
  {
    version: "2026-09-22",
    content: {
      es: {
        title: "Novedades en GastroMetrics",
        items: [
          "En la ventana de Ventas ahora hay un historial completo de tus ventas — agrupado por día, semana, mes o año, con un rango de fechas personalizable, y con un botón para exportarlo a PDF.",
          "Facturación a clientes ahora vive dentro de Ventas (pestaña \"Facturas\"), junto al registro manual y la importación de tu POS — antes era una pantalla aparte.",
          "Los números siempre se muestran con punto decimal en toda la app, sin importar la moneda que uses.",
          "Nuevo en Configuración: puedes descargar un respaldo completo de todo tu contenido (recetas, ingredientes, menús, y más) como un solo archivo, o borrar todo el contenido de tu cuenta si lo necesitas.",
          "Las facturas ahora incluyen un aviso claro de que no son un comprobante fiscal oficial, para que sepas exactamente qué es y qué no es este documento.",
        ],
      },
      en: {
        title: "What's new in GastroMetrics",
        items: [
          "The Sales screen now has a full history of your sales — grouped by day, week, month or year, with a customizable date range, and a button to export it to PDF.",
          "Customer invoicing now lives inside Sales (the \"Invoices\" tab), next to manual entry and POS import — it used to be a separate screen.",
          "Numbers always show a decimal point throughout the app, no matter which currency you use.",
          "New in Settings: you can download a complete backup of all your content (recipes, ingredients, menus, and more) as a single file, or delete all your account's content if you need to.",
          "Invoices now include a clear notice that they're not an official tax document, so you know exactly what this document is and isn't.",
        ],
      },
      da: {
        title: "Nyheder i GastroMetrics",
        items: [
          "Salg-skærmen har nu en fuld historik over dine salg — grupperet efter dag, uge, måned eller år, med et brugerdefinerbart datointerval, og en knap til at eksportere det til PDF.",
          "Fakturering til kunder findes nu inde i Salg (fanen \"Fakturering\"), ved siden af manuel registrering og POS-import — det var tidligere en separat skærm.",
          "Tal viser altid punktum som decimaltegn i hele appen, uanset hvilken valuta du bruger.",
          "Nyt i Indstillinger: du kan downloade en komplet sikkerhedskopi af alt dit indhold (opskrifter, ingredienser, menuer og mere) som én fil, eller slette alt indhold på din konto, hvis du har brug for det.",
          "Fakturaer indeholder nu en tydelig besked om, at de ikke er et officielt skattebilag, så du ved præcis, hvad dokumentet er — og ikke er.",
        ],
      },
      fr: {
        title: "Nouveautés de GastroMetrics",
        items: [
          "L'écran Ventes affiche maintenant un historique complet de vos ventes — regroupé par jour, semaine, mois ou année, avec une période personnalisable, et un bouton pour l'exporter en PDF.",
          "La facturation aux clients vit maintenant dans Ventes (onglet \"Factures\"), à côté de la saisie manuelle et de l'import POS — c'était auparavant un écran séparé.",
          "Les nombres affichent toujours un point comme séparateur décimal dans toute l'application, quelle que soit la devise utilisée.",
          "Nouveau dans Paramètres : vous pouvez télécharger une sauvegarde complète de tout votre contenu (recettes, ingrédients, menus, et plus) en un seul fichier, ou supprimer tout le contenu de votre compte si besoin.",
          "Les factures incluent désormais un avis clair indiquant qu'elles ne sont pas un document fiscal officiel, pour que vous sachiez exactement ce qu'est ce document — et ce qu'il n'est pas.",
        ],
      },
      pt: {
        title: "Novidades no GastroMetrics",
        items: [
          "A tela de Vendas agora tem um histórico completo das suas vendas — agrupado por dia, semana, mês ou ano, com um período personalizável, e um botão para exportar em PDF.",
          "O faturamento a clientes agora vive dentro de Vendas (aba \"Faturas\"), junto ao registro manual e à importação do seu PDV — antes era uma tela separada.",
          "Os números sempre mostram ponto decimal em todo o app, não importa qual moeda você use.",
          "Novo em Configurações: você pode baixar um backup completo de todo o seu conteúdo (receitas, ingredientes, cardápios e mais) em um único arquivo, ou apagar todo o conteúdo da sua conta se precisar.",
          "As faturas agora incluem um aviso claro de que não são um comprovante fiscal oficial, para que você saiba exatamente o que este documento é — e o que não é.",
        ],
      },
      zh: {
        title: "GastroMetrics 更新内容",
        items: [
          "销售界面现在有完整的销售历史记录——可以按日、周、月或年分组，支持自定义日期范围，还可以一键导出为PDF。",
          "客户开票功能现已并入销售模块（“发票”标签页），和手动登记、POS导入放在一起——以前是单独的一个页面。",
          "无论使用哪种货币，全应用的数字始终使用小数点显示。",
          "设置中的新功能：你可以将全部内容（配方、食材、菜单等）一键下载为一个完整的备份文件，也可以在需要时删除账户中的全部内容。",
          "发票现在会清楚提示这不是官方税务凭证，让你准确了解这份文件是什么、不是什么。",
        ],
      },
    },
  },
  {
    version: "2026-09-21b",
    content: {
      es: {
        title: "Novedades en GastroMetrics",
        items: [
          "El manual de usuario (Configuración → Manual de usuario) se rehízo por completo, con capturas reales de la app tal como se ve hoy — antes tenía pantallas viejas de hace varias actualizaciones.",
          "El manual ahora también explica el candado por plan en el menú y cómo instalar GastroMetrics como app en tu celular, dos cosas que no existían cuando se escribió la versión anterior.",
        ],
      },
      en: {
        title: "What's new in GastroMetrics",
        items: [
          "The user manual (Settings → User manual) was completely rebuilt, with real screenshots of the app as it looks today — the old version had screens from several updates ago.",
          "The manual now also explains the plan lock in the menu and how to install GastroMetrics as an app on your phone, two things that didn't exist when the previous version was written.",
        ],
      },
      da: {
        title: "Nyheder i GastroMetrics",
        items: [
          "Brugermanualen (Indstillinger → Brugermanual) blev bygget helt om, med rigtige skærmbilleder af appen, som den ser ud i dag — den gamle version havde skærme fra flere opdateringer siden.",
          "Manualen forklarer nu også hængelåsen pr. plan i menuen, og hvordan du installerer GastroMetrics som en app på din telefon — to ting, der ikke fandtes, da den forrige version blev skrevet.",
        ],
      },
      fr: {
        title: "Nouveautés de GastroMetrics",
        items: [
          "Le manuel de l'utilisateur (Paramètres → Manuel utilisateur) a été entièrement refait, avec de vraies captures d'écran de l'application telle qu'elle est aujourd'hui — l'ancienne version montrait des écrans datant de plusieurs mises à jour.",
          "Le manuel explique maintenant aussi le cadenas par forfait dans le menu et comment installer GastroMetrics comme application sur votre téléphone, deux choses qui n'existaient pas quand la version précédente a été écrite.",
        ],
      },
      pt: {
        title: "Novidades no GastroMetrics",
        items: [
          "O manual do usuário (Configurações → Manual do usuário) foi totalmente refeito, com capturas reais do app como ele é hoje — a versão antiga tinha telas de várias atualizações atrás.",
          "O manual agora também explica o cadeado por plano no menu e como instalar o GastroMetrics como app no seu celular, duas coisas que não existiam quando a versão anterior foi escrita.",
        ],
      },
      zh: {
        title: "GastroMetrics 更新内容",
        items: [
          "用户手册（设置 → 用户手册）已经完全重做，使用了应用当前真实界面的截图——旧版本里的截图还是好几次更新之前的。",
          "手册现在还说明了菜单中按套餐显示的锁定状态，以及如何将 GastroMetrics 安装到手机上作为应用使用——这两项功能在上一版手册编写时还不存在。",
        ],
      },
    },
  },
  {
    version: "2026-09-21",
    content: {
      es: {
        title: "Novedades en GastroMetrics",
        items: [
          "Ahora se ve claramente qué partes de la app están disponibles en tu plan: los módulos que tu plan no incluye aparecen \"apagados\" en el menú, con un mensaje que explica desde qué plan se desbloquean — en vez de descubrirlo recién al entrar.",
          "El tutorial de bienvenida ahora te guía paso a paso la primera vez: te lleva a cargar tus ingredientes y, al terminar, un botón te lleva directo a crear tu primera Ficha Técnica.",
          "Corregimos un error real en Inventario: editar un producto directo en la tabla (categoría, nombre, stock mínimo, precio) parecía guardarse pero el cambio se perdía en silencio. Ahora sí se guarda.",
          "Los campos de precio y cantidad de Ingredientes, Órdenes de Compra y Menús ya no aceptan números negativos por error.",
          "Si usas la app en otro idioma, el nombre de tu país en Configuración → Regional ahora se traduce de verdad (antes siempre aparecía en español).",
          "Corregimos la pantalla negra al abrir la app instalada en tu celular — ahora abre en blanco, como el resto de la marca. También aclaramos en la portada que GastroMetrics se puede instalar como app en tu celular.",
        ],
      },
      en: {
        title: "What's new in GastroMetrics",
        items: [
          "It's now clear which parts of the app your plan includes: modules your plan doesn't cover show up \"dimmed\" in the menu, with a message explaining which plan unlocks them — instead of finding out only after clicking in.",
          "The welcome tutorial now guides you step by step the first time: it takes you to load your ingredients, and when you finish, a button takes you straight to creating your first Recipe Sheet.",
          "Fixed a real bug in Inventory: editing a product directly in the table (category, name, minimum stock, price) looked like it saved, but the change was silently lost. It now saves correctly.",
          "Price and quantity fields in Ingredients, Purchase Orders, and Menus no longer accept negative numbers by mistake.",
          "If you use the app in another language, your country's name in Settings → Regional is now actually translated (it used to always show in Spanish).",
          "Fixed the black screen when opening the installed app on your phone — it now opens on white, matching the rest of the brand. We also made it clearer on the homepage that GastroMetrics can be installed as an app on your phone.",
        ],
      },
      da: {
        title: "Nyheder i GastroMetrics",
        items: [
          "Det er nu tydeligt, hvilke dele af appen din plan inkluderer: moduler din plan ikke dækker, vises \"nedtonet\" i menuen, med en besked, der forklarer hvilken plan der låser dem op — i stedet for først at opdage det efter at have klikket ind.",
          "Velkomst-tutorialen guider dig nu trin for trin første gang: den fører dig til at indlæse dine ingredienser, og når du er færdig, fører en knap dig direkte til at oprette dit første Opskriftsark.",
          "Rettet en reel fejl i Lager: at redigere et produkt direkte i tabellen (kategori, navn, minimumslager, pris) så ud til at gemme, men ændringen gik tabt i stilhed. Det gemmes nu korrekt.",
          "Pris- og mængdefelter i Ingredienser, Indkøbsordrer og Menuer accepterer ikke længere negative tal ved en fejl.",
          "Hvis du bruger appen på et andet sprog, bliver dit lands navn i Indstillinger → Regional nu rent faktisk oversat (det viste tidligere altid på spansk).",
          "Rettet den sorte skærm, når du åbner den installerede app på din telefon — den åbner nu i hvidt, ligesom resten af brandet. Vi har også gjort det tydeligere på forsiden, at GastroMetrics kan installeres som en app på din telefon.",
        ],
      },
      fr: {
        title: "Nouveautés de GastroMetrics",
        items: [
          "On voit désormais clairement quelles parties de l'application votre plan inclut : les modules que votre plan ne couvre pas apparaissent \"grisés\" dans le menu, avec un message expliquant à partir de quel plan ils se débloquent — au lieu de le découvrir seulement en cliquant dessus.",
          "Le tutoriel de bienvenue vous guide maintenant pas à pas la première fois : il vous amène à charger vos ingrédients, puis, à la fin, un bouton vous mène directement à la création de votre première Fiche Technique.",
          "Correction d'un vrai bug dans Inventaire : modifier un produit directement dans le tableau (catégorie, nom, stock minimum, prix) semblait s'enregistrer, mais le changement était perdu silencieusement. Cela s'enregistre maintenant correctement.",
          "Les champs de prix et de quantité dans Ingrédients, Commandes d'achat et Menus n'acceptent plus les nombres négatifs par erreur.",
          "Si vous utilisez l'application dans une autre langue, le nom de votre pays dans Paramètres → Régional est maintenant vraiment traduit (il s'affichait toujours en espagnol auparavant).",
          "Correction de l'écran noir à l'ouverture de l'application installée sur votre téléphone — elle s'ouvre maintenant en blanc, comme le reste de la marque. Nous avons aussi précisé sur la page d'accueil que GastroMetrics peut être installée comme application sur votre téléphone.",
        ],
      },
      pt: {
        title: "Novidades no GastroMetrics",
        items: [
          "Agora fica claro quais partes do app o seu plano inclui: os módulos que seu plano não cobre aparecem \"apagados\" no menu, com uma mensagem explicando a partir de qual plano eles são desbloqueados — em vez de descobrir isso só depois de clicar.",
          "O tutorial de boas-vindas agora te guia passo a passo na primeira vez: ele te leva a cadastrar seus ingredientes e, ao terminar, um botão te leva direto para criar sua primeira Ficha Técnica.",
          "Corrigimos um bug real no Inventário: editar um produto direto na tabela (categoria, nome, estoque mínimo, preço) parecia salvar, mas a mudança era perdida em silêncio. Agora salva corretamente.",
          "Os campos de preço e quantidade em Ingredientes, Ordens de Compra e Menus não aceitam mais números negativos por engano.",
          "Se você usa o app em outro idioma, o nome do seu país em Configurações → Regional agora é traduzido de verdade (antes sempre aparecia em espanhol).",
          "Corrigimos a tela preta ao abrir o app instalado no seu celular — agora ele abre em branco, como o resto da marca. Também deixamos mais claro na página inicial que o GastroMetrics pode ser instalado como app no seu celular.",
        ],
      },
      zh: {
        title: "GastroMetrics 更新内容",
        items: [
          "现在可以清楚地看到你的套餐包含哪些功能：套餐未包含的模块会在菜单中显示为“变暗”状态，并提示需要升级到哪个套餐才能解锁——不用点进去才发现打不开。",
          "首次使用时，欢迎教程现在会一步步引导你：先带你去录入食材，完成后有一个按钮直接带你创建第一份技术配方表。",
          "修复了库存模块的一个真实问题：直接在表格中编辑产品（分类、名称、最低库存、价格）看起来保存了，但改动其实被悄悄丢失了。现在可以正确保存。",
          "食材、采购订单和菜单中的价格与数量字段，不再会因误操作而接受负数。",
          "如果你使用其他语言，现在“设置 → 地区”中的国家名称会真正被翻译（以前一直显示西班牙语）。",
          "修复了打开手机上已安装的应用时出现黑屏的问题——现在会以白色背景打开，与品牌其余部分保持一致。我们还在首页更清楚地说明了 GastroMetrics 可以作为应用安装到手机上。",
        ],
      },
    },
  },
  {
    version: "2026-09-15",
    content: {
      es: {
        title: "Novedades en GastroMetrics",
        items: [
          "La app está más traducida que nunca: se corrigieron textos que quedaban en español sin importar el idioma elegido (menú inferior en el celular, actividad reciente, plantilla de importación de ingredientes, y más).",
          "El manual de usuario completo ahora se puede ver y descargar en PDF directo desde Configuración, sin salir de tu cuenta.",
          "Si tu cuenta ya existía antes de que pudieras elegir recibir novedades por correo, ahora las recibes por default — puedes desactivarlo en cualquier momento desde Configuración → Notificaciones.",
          "Se quitó el interruptor de \"Notificaciones SMS\" de Configuración: nunca hizo nada, así que no tenía sentido dejarlo.",
        ],
      },
      en: {
        title: "What's new in GastroMetrics",
        items: [
          "The app is more translated than ever: fixed text that stayed in Spanish no matter which language you picked (mobile bottom navigation, recent activity, ingredient import template, and more).",
          "The full user manual can now be viewed and downloaded as a PDF right from Settings, without leaving your account.",
          "If your account existed before you could choose to receive product updates by email, you now receive them by default — you can turn it off anytime from Settings → Notifications.",
          "Removed the \"SMS notifications\" toggle from Settings: it never actually did anything, so there was no point keeping it.",
        ],
      },
      da: {
        title: "Nyheder i GastroMetrics",
        items: [
          "Appen er mere oversat end nogensinde: rettet tekst, der blev på spansk uanset hvilket sprog du valgte (bundnavigation på mobil, seneste aktivitet, skabelon til import af ingredienser, og mere).",
          "Hele brugermanualen kan nu ses og downloades som PDF direkte fra Indstillinger, uden at forlade din konto.",
          "Hvis din konto eksisterede, før du kunne vælge at få produktnyheder via e-mail, får du dem nu som standard — du kan slå det fra når som helst fra Indstillinger → Notifikationer.",
          "Fjernet \"SMS-notifikationer\"-kontakten fra Indstillinger: den gjorde faktisk aldrig noget, så der var ingen grund til at beholde den.",
        ],
      },
      fr: {
        title: "Nouveautés de GastroMetrics",
        items: [
          "L'application est plus traduite que jamais : correction de textes qui restaient en espagnol quelle que soit la langue choisie (navigation mobile en bas d'écran, activité récente, modèle d'importation d'ingrédients, et plus encore).",
          "Le manuel utilisateur complet peut désormais être consulté et téléchargé en PDF directement depuis Paramètres, sans quitter votre compte.",
          "Si votre compte existait avant que vous puissiez choisir de recevoir les nouveautés par e-mail, vous les recevez maintenant par défaut — vous pouvez désactiver cela à tout moment depuis Paramètres → Notifications.",
          "Suppression du bouton \"Notifications SMS\" dans Paramètres : il ne faisait en réalité rien, donc il n'y avait aucune raison de le garder.",
        ],
      },
      pt: {
        title: "Novidades no GastroMetrics",
        items: [
          "O app está mais traduzido do que nunca: corrigimos textos que ficavam em espanhol independente do idioma escolhido (navegação inferior no celular, atividade recente, modelo de importação de ingredientes, e mais).",
          "O manual do usuário completo agora pode ser visualizado e baixado em PDF direto em Configurações, sem sair da sua conta.",
          "Se sua conta já existia antes de você poder escolher receber novidades por e-mail, agora você as recebe por padrão — pode desativar isso a qualquer momento em Configurações → Notificações.",
          "Removemos o botão \"Notificações por SMS\" de Configurações: ele nunca fazia nada de fato, então não fazia sentido mantê-lo.",
        ],
      },
      zh: {
        title: "GastroMetrics 更新内容",
        items: [
          "应用的多语言支持比以往更完善：修复了之前无论选择哪种语言都仍显示西班牙语的文字（手机底部导航栏、最近活动记录、食材导入模板等）。",
          "现在可以直接在“设置”中在线查看并下载完整的PDF用户手册，无需离开你的账户。",
          "如果你的账户是在可以选择接收产品更新邮件功能上线之前创建的，现在会默认为你开启此功能——你可以随时在“设置 → 通知”中关闭。",
          "移除了“设置”中的“短信通知”开关：它其实从未真正起作用，留着也没有意义。",
        ],
      },
    },
  },
  {
    version: "2026-09-14",
    content: {
      es: {
        title: "Novedades en GastroMetrics",
        items: [
          "El Dashboard ahora te dice qué hacer hoy: ingredientes bajo mínimo, recetas sin precio de venta y tu margen promedio — un clic te lleva directo a cada uno.",
          "Las sub-recetas ya no muestran precio de venta ni desglose de ganancia en su ficha — solo el costo real, que es lo único que les aplica.",
          "La Ficha Técnica avisa cuando un dato parece un error (por ejemplo, una cantidad muy alta comparada con el rendimiento) antes de que llegue a un PDF.",
          "Nueva variante \"Ficha Rápida\" para compartir con un proveedor o socio, sin costos ni precios.",
          "Puedes elegir si quieres recibir estas novedades por correo desde Configuración → Notificaciones.",
        ],
      },
      en: {
        title: "What's new in GastroMetrics",
        items: [
          "The Dashboard now tells you what to do today: ingredients below minimum, recipes with no sale price, and your average margin — one click takes you to each.",
          "Sub-recipes no longer show a sale price or profit breakdown on their sheet — just the real cost, which is the only thing that applies to them.",
          "The recipe sheet warns you when a number looks like a mistake (for example, a quantity far too high for the declared yield) before it reaches a PDF.",
          "New \"Quick Sheet\" variant for sharing with a supplier or partner, with no costs or prices.",
          "You can choose whether to receive these updates by email from Settings → Notifications.",
        ],
      },
      da: {
        title: "Nyheder i GastroMetrics",
        items: [
          "Dashboardet fortæller dig nu, hvad du skal gøre i dag: ingredienser under minimum, opskrifter uden salgspris og din gennemsnitlige avance — et klik fører dig direkte til hver.",
          "Delopskrifter viser ikke længere salgspris eller avancefordeling på deres blad — kun den rigtige omkostning, som er det eneste, der gælder for dem.",
          "Det tekniske blad advarer, når et tal ser ud som en fejl (for eksempel en mængde, der er alt for høj i forhold til det angivne udbytte), inden det når en PDF.",
          "Ny variant \"Hurtigt Ark\" til at dele med en leverandør eller partner, uden omkostninger eller priser.",
          "Du kan vælge, om du vil have disse nyheder via e-mail, fra Indstillinger → Notifikationer.",
        ],
      },
      fr: {
        title: "Nouveautés de GastroMetrics",
        items: [
          "Le tableau de bord vous dit maintenant quoi faire aujourd'hui : ingrédients sous le minimum, recettes sans prix de vente et votre marge moyenne — un clic vous mène directement à chacun.",
          "Les sous-recettes n'affichent plus de prix de vente ni de répartition du profit sur leur fiche — seulement le coût réel, la seule chose qui les concerne.",
          "La fiche technique vous alerte quand un chiffre semble être une erreur (par exemple, une quantité bien trop élevée par rapport au rendement déclaré) avant qu'il n'arrive dans un PDF.",
          "Nouvelle variante \"Fiche Rapide\" pour partager avec un fournisseur ou un partenaire, sans coûts ni prix.",
          "Vous pouvez choisir de recevoir ou non ces nouveautés par e-mail depuis Paramètres → Notifications.",
        ],
      },
      pt: {
        title: "Novidades no GastroMetrics",
        items: [
          "O Dashboard agora te diz o que fazer hoje: ingredientes abaixo do mínimo, receitas sem preço de venda e sua margem média — um clique leva direto a cada um.",
          "As sub-receitas não mostram mais preço de venda nem detalhamento de lucro na sua ficha — só o custo real, que é o único que se aplica a elas.",
          "A Ficha Técnica avisa quando um dado parece um erro (por exemplo, uma quantidade muito alta comparada com o rendimento) antes de chegar a um PDF.",
          "Nova variante \"Ficha Rápida\" para compartilhar com um fornecedor ou sócio, sem custos nem preços.",
          "Você pode escolher se quer receber essas novidades por e-mail em Configurações → Notificações.",
        ],
      },
      zh: {
        title: "GastroMetrics 更新内容",
        items: [
          "仪表盘现在会告诉你今天该做什么：低于最低库存的食材、没有销售价格的配方，以及你的平均利润率——点击即可直达每一项。",
          "子配方的页面不再显示销售价格或利润明细——只显示真实成本，这才是唯一适用于它们的信息。",
          "技术配方表会在数据看起来像错误时提前提醒你（例如某个用量相对产量明显过高），避免它出现在 PDF 里。",
          "新增“快速单据”版本，用于与供应商或合伙人分享，不含成本和价格。",
          "你可以在“设置 → 通知”中选择是否要通过邮件接收这些更新。",
        ],
      },
    },
  },
]

export const LATEST_CHANGELOG_VERSION = CHANGELOG[0].version

export function getChangelogContent(language: LanguageCode) {
  const entry = CHANGELOG[0]
  return entry.content[language] || entry.content.es
}

/** Enlace al tutorial de la última novedad (docs/167). */
export function getLatestTutorialHref(): string | null {
  return CHANGELOG[0].tutorialHref ?? null
}

/**
 * Entradas para el correo de novedades (docs/142): de la más reciente hasta
 * `sinceVersion` incluida. Antes el correo llevaba solo la última entrada, así que si
 * se publicaban varias antes de enviar, las anteriores nunca llegaban a nadie.
 * Versión desconocida o vacía → solo la última.
 */
export function getChangelogEntriesSince(sinceVersion?: string | null): ChangelogEntry[] {
  const index = sinceVersion ? CHANGELOG.findIndex((e) => e.version === sinceVersion) : -1
  return index >= 0 ? CHANGELOG.slice(0, index + 1) : CHANGELOG.slice(0, 1)
}

/** Por defecto el correo incluye todas las entradas del mismo día que la última. */
export function getDefaultEmailSinceVersion(): string {
  const day = CHANGELOG[0].version.slice(0, 10)
  let since = CHANGELOG[0].version
  for (const entry of CHANGELOG) {
    if (entry.version.slice(0, 10) !== day) break
    since = entry.version
  }
  return since
}
