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
