/**
 * Textos de los 5 correos de recordatorio / re-enganche (ver
 * lib/services/notify-reengagement.ts y docs/131). Archivo aparte de email-labels.ts a
 * propósito: son 5 mensajes × 8 textos × 6 idiomas — meterlos ahí duplicaría el tamaño
 * de un archivo que ya comparten los 11 correos transaccionales.
 *
 * Variables que se reemplazan con fillLabel(): {name} (primer nombre), {recipe}
 * (nombre de la receta a medias), {days}, {count}. Todo lo que venga del usuario
 * (nombre, receta) se escapa ANTES de llegar acá — ver notify-reengagement.ts.
 *
 * Español con voseo, igual que el resto de los correos (email-labels.ts).
 */

import type { EmailLang } from "./email-labels"

export type ReengagementType = "unfinished_recipe" | "inventory_count" | "review_reports" | "update_prices" | "we_miss_you"

export interface ReengagementCopy {
  subject: string
  preheader: string
  eyebrow: string
  heading: string
  body: string
  statLabel: string
  statValue: string
  cta: string
}

export interface ReengagementShared {
  hello: string
  helloNoName: string
  statNever: string
  footnote: string
  unsubscribe: string
  footer2: string
}

export const REENGAGEMENT_SHARED: Record<EmailLang, ReengagementShared> = {
  es: {
    hello: "Hola {name},",
    helloNoName: "Hola,",
    statNever: "Todavía ninguno",
    footnote: "Te mandamos este recordatorio porque activaste recibir información de Gastrometrics. Nunca más de uno cada pocos días.",
    unsubscribe: "Dejar de recibir estos correos",
    footer2: "Recordatorio de tu cuenta Gastrometrics.",
  },
  en: {
    hello: "Hi {name},",
    helloNoName: "Hi there,",
    statNever: "None yet",
    footnote: "You're getting this reminder because you opted in to receive updates from Gastrometrics. Never more than one every few days.",
    unsubscribe: "Stop receiving these emails",
    footer2: "Reminder from your Gastrometrics account.",
  },
  da: {
    hello: "Hej {name},",
    helloNoName: "Hej,",
    statNever: "Ingen endnu",
    footnote: "Du får denne påmindelse, fordi du har valgt at modtage information fra Gastrometrics. Aldrig mere end én med få dages mellemrum.",
    unsubscribe: "Stop med at modtage disse e-mails",
    footer2: "Påmindelse fra din Gastrometrics-konto.",
  },
  fr: {
    hello: "Bonjour {name},",
    helloNoName: "Bonjour,",
    statNever: "Aucun pour l'instant",
    footnote: "Tu reçois ce rappel parce que tu as choisi de recevoir des informations de Gastrometrics. Jamais plus d'un tous les quelques jours.",
    unsubscribe: "Ne plus recevoir ces e-mails",
    footer2: "Rappel de ton compte Gastrometrics.",
  },
  pt: {
    hello: "Olá {name},",
    helloNoName: "Olá,",
    statNever: "Nenhum ainda",
    footnote: "Você está recebendo este lembrete porque ativou receber informações da Gastrometrics. Nunca mais de um a cada poucos dias.",
    unsubscribe: "Parar de receber estes e-mails",
    footer2: "Lembrete da sua conta Gastrometrics.",
  },
  zh: {
    hello: "{name}，你好：",
    helloNoName: "你好：",
    statNever: "尚无记录",
    footnote: "你收到这封提醒，是因为你选择了接收 Gastrometrics 的信息。每隔几天最多一封。",
    unsubscribe: "不再接收此类邮件",
    footer2: "来自你的 Gastrometrics 账户的提醒。",
  },
}

export const REENGAGEMENT_COPY: Record<EmailLang, Record<ReengagementType, ReengagementCopy>> = {
  es: {
    unfinished_recipe: {
      subject: "Tu receta «{recipe}» quedó a medias",
      preheader: "La guardamos por ti — sigue donde la dejaste antes de que venza el borrador.",
      eyebrow: "Receta sin terminar",
      heading: "Tu receta te está esperando",
      body: "Empezaste a armar la ficha técnica de <strong>{recipe}</strong> y no llegaste a guardarla. No te preocupes: guardamos el borrador automáticamente durante 24 horas desde tu último cambio. Entra y termínala en un par de minutos — el costo y el precio sugerido se calculan solos.",
      statLabel: "Borrador guardado",
      statValue: "{recipe}",
      cta: "Terminar mi receta",
    },
    inventory_count: {
      subject: "¿Cuándo fue tu último conteo de inventario?",
      preheader: "Un conteo rápido hoy te evita compras de más y faltantes el fin de semana.",
      eyebrow: "Inventario",
      heading: "Es buen momento para contar tu inventario",
      body: "Hace <strong>{days} días</strong> que no registras un conteo de inventario. Contar seguido es la forma más simple de detectar mermas, evitar comprar de más y saber qué pedir antes de quedarte sin nada en pleno servicio. Te toma unos minutos desde el celular.",
      statLabel: "Último conteo",
      statValue: "hace {days} días",
      cta: "Registrar inventario",
    },
    review_reports: {
      subject: "Tus números de la semana te están esperando",
      preheader: "Mira qué platos te están dejando plata y cuáles no.",
      eyebrow: "Reportes",
      heading: "¿Ya viste cómo te fue esta semana?",
      body: "Registraste ventas pero hace <strong>{days} días</strong> que no revisas tus reportes. Ahí vas a ver qué platos realmente te dejan ganancia, cuáles tienen el food cost más alto y dónde conviene ajustar precios.",
      statLabel: "Última revisión de reportes",
      statValue: "hace {days} días",
      cta: "Ver mis reportes",
    },
    update_prices: {
      subject: "Tus costos pueden estar desactualizados",
      preheader: "Si tus proveedores subieron precios, tu margen real ya no es el que ves.",
      eyebrow: "Precios de ingredientes",
      heading: "¿Siguen vigentes los precios de tus ingredientes?",
      body: "Tienes <strong>{count} ingredientes</strong> cuyo precio no se actualiza hace más de 30 días. Si algún proveedor subió precios, el costo de tus recetas — y tu margen — ya no es el real. Actualízalos y Gastrometrics recalcula todas tus recetas automáticamente.",
      statLabel: "Ingredientes sin actualizar",
      statValue: "{count}",
      cta: "Actualizar precios",
    },
    we_miss_you: {
      subject: "Tu cocina en Gastrometrics te extraña",
      preheader: "Todo sigue ahí, tal como lo dejaste.",
      eyebrow: "Te extrañamos",
      heading: "Hace rato que no pasas por tu cocina",
      body: "Hace <strong>{days} días</strong> que no entras a Gastrometrics. Tus recetas, ingredientes e inventario siguen ahí tal como los dejaste. Date una vuelta: revisa tus costos, actualiza un precio o arma esa receta nueva que tenías pendiente.",
      statLabel: "Recetas guardadas",
      statValue: "{count}",
      cta: "Volver a Gastrometrics",
    },
  },
  en: {
    unfinished_recipe: {
      subject: "Your recipe “{recipe}” is half-finished",
      preheader: "We saved it for you — pick up where you left off before the draft expires.",
      eyebrow: "Unfinished recipe",
      heading: "Your recipe is waiting for you",
      body: "You started building the recipe sheet for <strong>{recipe}</strong> but didn't save it. No worries: we automatically keep the draft for 24 hours after your last change. Jump back in and finish it in a couple of minutes — cost and suggested price are calculated for you.",
      statLabel: "Saved draft",
      statValue: "{recipe}",
      cta: "Finish my recipe",
    },
    inventory_count: {
      subject: "When was your last inventory count?",
      preheader: "A quick count today saves you from over-ordering and running out this weekend.",
      eyebrow: "Inventory",
      heading: "It's a good time to count your inventory",
      body: "It's been <strong>{days} days</strong> since your last inventory count. Counting regularly is the simplest way to spot waste, avoid over-ordering and know what to buy before you run out mid-service. It takes a few minutes from your phone.",
      statLabel: "Last count",
      statValue: "{days} days ago",
      cta: "Count inventory",
    },
    review_reports: {
      subject: "Your numbers for the week are waiting",
      preheader: "See which dishes are making you money and which aren't.",
      eyebrow: "Reports",
      heading: "Have you seen how this week went?",
      body: "You've recorded sales but haven't checked your reports in <strong>{days} days</strong>. That's where you'll see which dishes really make a profit, which have the highest food cost, and where it's worth adjusting prices.",
      statLabel: "Last time you checked reports",
      statValue: "{days} days ago",
      cta: "View my reports",
    },
    update_prices: {
      subject: "Your costs may be out of date",
      preheader: "If your suppliers raised prices, your real margin isn't the one you see.",
      eyebrow: "Ingredient prices",
      heading: "Are your ingredient prices still current?",
      body: "You have <strong>{count} ingredients</strong> whose price hasn't been updated in over 30 days. If a supplier raised prices, your recipe costs — and your margin — are no longer accurate. Update them and Gastrometrics recalculates every recipe automatically.",
      statLabel: "Ingredients not updated",
      statValue: "{count}",
      cta: "Update prices",
    },
    we_miss_you: {
      subject: "Your kitchen on Gastrometrics misses you",
      preheader: "Everything is right where you left it.",
      eyebrow: "We miss you",
      heading: "It's been a while since you visited your kitchen",
      body: "You haven't opened Gastrometrics in <strong>{days} days</strong>. Your recipes, ingredients and inventory are right where you left them. Come take a look: check your costs, update a price or build that new recipe you had in mind.",
      statLabel: "Saved recipes",
      statValue: "{count}",
      cta: "Back to Gastrometrics",
    },
  },
  da: {
    unfinished_recipe: {
      subject: "Din opskrift »{recipe}« er ikke færdig",
      preheader: "Vi har gemt den for dig — fortsæt, hvor du slap, før kladden udløber.",
      eyebrow: "Ufærdig opskrift",
      heading: "Din opskrift venter på dig",
      body: "Du begyndte på opskriftskortet til <strong>{recipe}</strong>, men nåede ikke at gemme det. Bare rolig: vi gemmer automatisk kladden i 24 timer efter din seneste ændring. Gå ind og gør den færdig på et par minutter — kostpris og foreslået pris beregnes automatisk.",
      statLabel: "Gemt kladde",
      statValue: "{recipe}",
      cta: "Gør min opskrift færdig",
    },
    inventory_count: {
      subject: "Hvornår talte du sidst dit lager?",
      preheader: "En hurtig optælling i dag sparer dig for overindkøb og mangler i weekenden.",
      eyebrow: "Lager",
      heading: "Det er et godt tidspunkt at tælle dit lager",
      body: "Der er gået <strong>{days} dage</strong>, siden du sidst registrerede en lageroptælling. At tælle ofte er den nemmeste måde at opdage spild, undgå overindkøb og vide, hvad du skal bestille, før du løber tør midt i servicen. Det tager få minutter fra mobilen.",
      statLabel: "Seneste optælling",
      statValue: "for {days} dage siden",
      cta: "Registrer lager",
    },
    review_reports: {
      subject: "Ugens tal venter på dig",
      preheader: "Se hvilke retter der tjener penge, og hvilke der ikke gør.",
      eyebrow: "Rapporter",
      heading: "Har du set, hvordan ugen gik?",
      body: "Du har registreret salg, men har ikke kigget på dine rapporter i <strong>{days} dage</strong>. Dér kan du se, hvilke retter der reelt giver overskud, hvilke der har den højeste food cost, og hvor det kan betale sig at justere priserne.",
      statLabel: "Seneste gennemgang af rapporter",
      statValue: "for {days} dage siden",
      cta: "Se mine rapporter",
    },
    update_prices: {
      subject: "Dine omkostninger er måske forældede",
      preheader: "Hvis dine leverandører har hævet priserne, er din reelle margin ikke den, du ser.",
      eyebrow: "Ingredienspriser",
      heading: "Er dine ingredienspriser stadig gældende?",
      body: "Du har <strong>{count} ingredienser</strong>, hvis pris ikke er opdateret i over 30 dage. Hvis en leverandør har hævet priserne, er dine opskrifters kostpris — og din margin — ikke længere korrekt. Opdater dem, så genberegner Gastrometrics alle dine opskrifter automatisk.",
      statLabel: "Ingredienser ikke opdateret",
      statValue: "{count}",
      cta: "Opdater priser",
    },
    we_miss_you: {
      subject: "Dit køkken i Gastrometrics savner dig",
      preheader: "Alt er, som du efterlod det.",
      eyebrow: "Vi savner dig",
      heading: "Det er et stykke tid siden, du kiggede forbi dit køkken",
      body: "Du har ikke åbnet Gastrometrics i <strong>{days} dage</strong>. Dine opskrifter, ingredienser og dit lager er, som du efterlod dem. Kig forbi: tjek dine omkostninger, opdater en pris eller lav den nye opskrift, du havde i tankerne.",
      statLabel: "Gemte opskrifter",
      statValue: "{count}",
      cta: "Tilbage til Gastrometrics",
    },
  },
  fr: {
    unfinished_recipe: {
      subject: "Ta recette « {recipe} » est restée inachevée",
      preheader: "On l'a gardée pour toi — reprends là où tu t'es arrêté avant que le brouillon expire.",
      eyebrow: "Recette inachevée",
      heading: "Ta recette t'attend",
      body: "Tu as commencé la fiche technique de <strong>{recipe}</strong> sans l'enregistrer. Pas d'inquiétude : on conserve automatiquement le brouillon pendant 24 heures après ta dernière modification. Reviens la terminer en quelques minutes — le coût et le prix suggéré se calculent tout seuls.",
      statLabel: "Brouillon enregistré",
      statValue: "{recipe}",
      cta: "Terminer ma recette",
    },
    inventory_count: {
      subject: "À quand remonte ton dernier inventaire ?",
      preheader: "Un comptage rapide aujourd'hui t'évite les surachats et les ruptures ce week-end.",
      eyebrow: "Inventaire",
      heading: "C'est le bon moment pour compter ton inventaire",
      body: "Cela fait <strong>{days} jours</strong> que tu n'as pas enregistré d'inventaire. Compter régulièrement est le moyen le plus simple de repérer les pertes, d'éviter les surachats et de savoir quoi commander avant d'être à court en plein service. Quelques minutes depuis ton téléphone suffisent.",
      statLabel: "Dernier comptage",
      statValue: "il y a {days} jours",
      cta: "Enregistrer l'inventaire",
    },
    review_reports: {
      subject: "Tes chiffres de la semaine t'attendent",
      preheader: "Vois quels plats te rapportent de l'argent et lesquels non.",
      eyebrow: "Rapports",
      heading: "As-tu vu comment s'est passée ta semaine ?",
      body: "Tu as enregistré des ventes mais tu n'as pas consulté tes rapports depuis <strong>{days} jours</strong>. C'est là que tu verras quels plats sont vraiment rentables, lesquels ont le food cost le plus élevé et où il vaut la peine d'ajuster les prix.",
      statLabel: "Dernière consultation des rapports",
      statValue: "il y a {days} jours",
      cta: "Voir mes rapports",
    },
    update_prices: {
      subject: "Tes coûts ne sont peut-être plus à jour",
      preheader: "Si tes fournisseurs ont augmenté leurs prix, ta vraie marge n'est plus celle que tu vois.",
      eyebrow: "Prix des ingrédients",
      heading: "Les prix de tes ingrédients sont-ils toujours valables ?",
      body: "Tu as <strong>{count} ingrédients</strong> dont le prix n'a pas été mis à jour depuis plus de 30 jours. Si un fournisseur a augmenté ses prix, le coût de tes recettes — et ta marge — ne sont plus exacts. Mets-les à jour et Gastrometrics recalcule toutes tes recettes automatiquement.",
      statLabel: "Ingrédients non mis à jour",
      statValue: "{count}",
      cta: "Mettre à jour les prix",
    },
    we_miss_you: {
      subject: "Ta cuisine sur Gastrometrics s'ennuie de toi",
      preheader: "Tout est encore là, comme tu l'as laissé.",
      eyebrow: "Tu nous manques",
      heading: "Ça fait un moment que tu n'es pas passé en cuisine",
      body: "Tu n'as pas ouvert Gastrometrics depuis <strong>{days} jours</strong>. Tes recettes, ingrédients et inventaire sont toujours là, comme tu les as laissés. Passe faire un tour : vérifie tes coûts, mets à jour un prix ou crée cette nouvelle recette que tu avais en tête.",
      statLabel: "Recettes enregistrées",
      statValue: "{count}",
      cta: "Revenir sur Gastrometrics",
    },
  },
  pt: {
    unfinished_recipe: {
      subject: "Sua receita “{recipe}” ficou pela metade",
      preheader: "Guardamos para você — continue de onde parou antes que o rascunho expire.",
      eyebrow: "Receita não finalizada",
      heading: "Sua receita está esperando por você",
      body: "Você começou a ficha técnica de <strong>{recipe}</strong> e não chegou a salvar. Sem problema: guardamos o rascunho automaticamente por 24 horas desde a sua última alteração. Entre e termine em poucos minutos — o custo e o preço sugerido são calculados sozinhos.",
      statLabel: "Rascunho salvo",
      statValue: "{recipe}",
      cta: "Terminar minha receita",
    },
    inventory_count: {
      subject: "Quando foi sua última contagem de estoque?",
      preheader: "Uma contagem rápida hoje evita compras a mais e faltas no fim de semana.",
      eyebrow: "Estoque",
      heading: "É um bom momento para contar seu estoque",
      body: "Faz <strong>{days} dias</strong> que você não registra uma contagem de estoque. Contar com frequência é a forma mais simples de detectar perdas, evitar comprar demais e saber o que pedir antes de ficar sem nada em pleno serviço. Leva poucos minutos pelo celular.",
      statLabel: "Última contagem",
      statValue: "há {days} dias",
      cta: "Registrar estoque",
    },
    review_reports: {
      subject: "Seus números da semana estão esperando",
      preheader: "Veja quais pratos estão dando lucro e quais não.",
      eyebrow: "Relatórios",
      heading: "Você já viu como foi sua semana?",
      body: "Você registrou vendas, mas faz <strong>{days} dias</strong> que não revisa seus relatórios. Lá você vê quais pratos realmente dão lucro, quais têm o food cost mais alto e onde vale a pena ajustar preços.",
      statLabel: "Última revisão dos relatórios",
      statValue: "há {days} dias",
      cta: "Ver meus relatórios",
    },
    update_prices: {
      subject: "Seus custos podem estar desatualizados",
      preheader: "Se seus fornecedores subiram os preços, sua margem real não é a que você vê.",
      eyebrow: "Preços dos ingredientes",
      heading: "Os preços dos seus ingredientes continuam valendo?",
      body: "Você tem <strong>{count} ingredientes</strong> cujo preço não é atualizado há mais de 30 dias. Se algum fornecedor subiu os preços, o custo das suas receitas — e sua margem — já não é o real. Atualize-os e a Gastrometrics recalcula todas as suas receitas automaticamente.",
      statLabel: "Ingredientes sem atualizar",
      statValue: "{count}",
      cta: "Atualizar preços",
    },
    we_miss_you: {
      subject: "Sua cozinha na Gastrometrics sente sua falta",
      preheader: "Tudo continua lá, do jeito que você deixou.",
      eyebrow: "Sentimos sua falta",
      heading: "Faz tempo que você não passa pela sua cozinha",
      body: "Faz <strong>{days} dias</strong> que você não entra na Gastrometrics. Suas receitas, ingredientes e estoque continuam lá do jeito que você deixou. Dê uma passada: revise seus custos, atualize um preço ou monte aquela receita nova que estava pendente.",
      statLabel: "Receitas salvas",
      statValue: "{count}",
      cta: "Voltar para a Gastrometrics",
    },
  },
  zh: {
    unfinished_recipe: {
      subject: "你的食谱「{recipe}」还没完成",
      preheader: "我们已为你保存——在草稿过期前从上次停下的地方继续。",
      eyebrow: "未完成的食谱",
      heading: "你的食谱正在等你",
      body: "你开始制作 <strong>{recipe}</strong> 的技术卡，但还没有保存。别担心：从你最后一次修改起，我们会自动保存草稿 24 小时。回来花几分钟完成它——成本和建议售价会自动计算。",
      statLabel: "已保存的草稿",
      statValue: "{recipe}",
      cta: "完成我的食谱",
    },
    inventory_count: {
      subject: "你上次盘点库存是什么时候？",
      preheader: "今天快速盘点一下，周末就不会多买或缺货。",
      eyebrow: "库存",
      heading: "现在是盘点库存的好时机",
      body: "你已经 <strong>{days} 天</strong>没有登记库存盘点了。定期盘点是发现损耗、避免多买、在营业高峰缺货前知道该订什么的最简单方法。用手机几分钟就能完成。",
      statLabel: "上次盘点",
      statValue: "{days} 天前",
      cta: "登记库存",
    },
    review_reports: {
      subject: "你本周的数据正在等你",
      preheader: "看看哪些菜品在赚钱，哪些没有。",
      eyebrow: "报表",
      heading: "你看过这周的经营情况了吗？",
      body: "你已登记了销售，但已经 <strong>{days} 天</strong>没有查看报表了。在报表中你能看到哪些菜品真正盈利、哪些食材成本率最高，以及哪里值得调整价格。",
      statLabel: "上次查看报表",
      statValue: "{days} 天前",
      cta: "查看我的报表",
    },
    update_prices: {
      subject: "你的成本可能已经过时",
      preheader: "如果供应商涨价了，你看到的利润率就不是真实的。",
      eyebrow: "食材价格",
      heading: "你的食材价格还有效吗？",
      body: "你有 <strong>{count} 种食材</strong>的价格超过 30 天没有更新。如果有供应商涨价，你的食谱成本和利润率就不再准确。更新价格后，Gastrometrics 会自动重新计算你所有的食谱。",
      statLabel: "未更新的食材",
      statValue: "{count}",
      cta: "更新价格",
    },
    we_miss_you: {
      subject: "你在 Gastrometrics 的厨房想你了",
      preheader: "一切都还在，和你离开时一样。",
      eyebrow: "我们想你",
      heading: "你已经有一段时间没来厨房了",
      body: "你已经 <strong>{days} 天</strong>没有打开 Gastrometrics 了。你的食谱、食材和库存都还在，和你离开时一样。回来看看吧：检查成本、更新一个价格，或者做那道你一直想做的新食谱。",
      statLabel: "已保存的食谱",
      statValue: "{count}",
      cta: "返回 Gastrometrics",
    },
  },
}
