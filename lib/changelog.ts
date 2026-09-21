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
 */

import type { LanguageCode } from "@/lib/i18n/translations"

export interface ChangelogEntry {
  /** Fecha ISO (YYYY-MM-DD) — también funciona como identificador único de versión. */
  version: string
  content: Record<LanguageCode, { title: string; items: string[] }>
}

// Más reciente primero.
export const CHANGELOG: ChangelogEntry[] = [
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
          "手册现在还说明了菜单中按方案显示的锁定状态，以及如何将 GastroMetrics 安装到手机上作为应用使用——这两项功能在上一版手册编写时还不存在。",
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
          "现在可以清楚地看到你的方案包含哪些功能：方案未包含的模块会在菜单中显示为“变暗”状态，并提示需要升级到哪个方案才能解锁——不用点进去才发现打不开。",
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
          "技术单会在数据看起来像错误时提前提醒你（例如某个用量相对产量明显过高），避免它出现在 PDF 里。",
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
