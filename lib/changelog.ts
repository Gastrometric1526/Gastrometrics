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
    version: "2026-09-14",
    content: {
      es: {
        title: "Novedades en GastroMetrics",
        items: [
          "Al crear un negocio nuevo, puedes cargar un plato de ejemplo ya costeado para ver el cálculo real antes de escribir tus propias recetas.",
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
          "When you create a new business, you can load an already-costed example dish to see a real calculation before writing your own recipes.",
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
          "Når du opretter en ny forretning, kan du indlæse en allerede beregnet eksempelret for at se en rigtig beregning, før du skriver dine egne opskrifter.",
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
          "En créant un nouveau commerce, vous pouvez charger un plat d'exemple déjà chiffré pour voir un calcul réel avant d'écrire vos propres recettes.",
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
          "Ao criar um novo negócio, você pode carregar um prato de exemplo já custeado para ver um cálculo real antes de escrever suas próprias receitas.",
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
          "创建新商家时，可以加载一个已经算好成本的示例菜品，在写自己的配方之前先看看真实的计算效果。",
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
