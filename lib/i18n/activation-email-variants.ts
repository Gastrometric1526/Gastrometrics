/**
 * Variantes de los 4 correos de activación (docs/144). La variante 0 es el texto de
 * email-labels.ts (e07_* / e10_*); acá están la 1 y la 2. Cada cuenta recibe cada correo
 * de activación una sola vez, así que la variante se elige por cuenta (hash del id):
 * personas distintas reciben textos distintos. Español con "tú".
 */

import type { EmailLang } from "./email-labels"

export type ActivationVariantType = "first_recipe_reminder" | "day7_margin_checkin" | "first_sale_reinforcement" | "four_hour_experience"

export interface ActivationVariant {
  subject: string
  preheader: string
  heading: string
  body: string
  cta?: string
}

const a = (subject: string, preheader: string, heading: string, body: string, cta?: string): ActivationVariant => ({
  subject,
  preheader,
  heading,
  body,
  cta,
})

export const ACTIVATION_VARIANTS: Record<EmailLang, Record<ActivationVariantType, [ActivationVariant, ActivationVariant]>> = {
  es: {
    first_recipe_reminder: [
      a("Tu primera receta te toma 5 minutos", "Elige un plato y mira su costo real.", "¿Cuál es tu plato más vendido?", "Empieza por ese. Carga sus ingredientes con lo que pagas por ellos y Gastrometrics te dice cuánto te cuesta cada porción y a cuánto conviene venderlo.", "Costear mi primer plato"),
      a("Todavía no conoces el costo real de tus platos", "Una receta basta para empezar.", "Un plato, un número real", "Ya tienes tu cuenta lista. Lo que falta es tu primera receta: con una sola ya ves el costo por porción, la ganancia y un precio sugerido en tu moneda.", "Crear mi primera receta"),
    ],
    day7_margin_checkin: [
      a("¿Tus precios cubren tus costos?", "Una semana después, revisa tu margen.", "Revisemos tus números", "Ya llevas una semana con Gastrometrics. Abre Reportes y compara tu food cost real con tu meta: si algún plato se pasó, es el momento de ajustar su precio.", "Ver mis reportes"),
      a("Una semana costeando: ¿qué descubriste?", "Tu food cost promedio ya está calculado.", "Tu primera semana en números", "Con las recetas que cargaste ya puedes ver tu food cost promedio y qué platos te dejan más. Dale una mirada de dos minutos.", "Abrir Reportes"),
    ],
    first_sale_reinforcement: [
      a("Tu primera venta ya está en Gastrometrics", "Ahora tus reportes usan ventas reales.", "Ahora sí: ventas reales", "Registraste tu primera venta. Desde hoy, tus reportes comparan lo que vendes con lo que cuesta producirlo. Mientras más ventas registres, más claro verás qué platos te convienen.", "Ver mis ventas"),
      a("Buen comienzo: tu primera venta registrada", "Sigue así para ver tu Menu Engineering.", "Tu primera venta, registrada", "Con cada venta que registras, Gastrometrics descuenta ingredientes de tu inventario y te muestra qué platos son tus estrellas. Ya diste el primer paso.", "Registrar otra venta"),
    ],
    four_hour_experience: [
      a("Cuatro horas en Gastrometrics: ¿cómo te va?", "Tu opinión nos ayuda a mejorar.", "¿Qué tal tu experiencia?", "Ya llevas cuatro horas usando Gastrometrics. ¿Qué te gusta y qué cambiarías? Tu respuesta la leemos nosotros y nos ayuda a decidir qué mejorar."),
      a("¿Nos cuentas qué te parece Gastrometrics?", "Un minuto, y nos ayudas mucho.", "Queremos saber tu opinión", "Has usado Gastrometrics varias horas y tu opinión vale oro. Déjanos un comentario o una reseña: nos ayuda a mejorar y a que otras cocinas nos conozcan."),
    ],
  },
  en: {
    first_recipe_reminder: [
      a("Your first recipe takes 5 minutes", "Pick a dish and see its real cost.", "What's your best-selling dish?", "Start with that one. Add its ingredients with what you pay for them and Gastrometrics tells you what each portion costs and what to sell it for.", "Cost my first dish"),
      a("You still don't know the real cost of your dishes", "One recipe is enough to start.", "One dish, one real number", "Your account is ready. What's missing is your first recipe: with just one you'll see the cost per portion, the profit and a suggested price in your currency.", "Create my first recipe"),
    ],
    day7_margin_checkin: [
      a("Do your prices cover your costs?", "One week in, check your margin.", "Let's review your numbers", "You've been using Gastrometrics for a week. Open Reports and compare your real food cost with your target: if a dish went over, now's the time to adjust its price.", "See my reports"),
      a("One week of costing: what did you find?", "Your average food cost is already calculated.", "Your first week in numbers", "With the recipes you've added you can already see your average food cost and which dishes make you the most. Take a two-minute look.", "Open Reports"),
    ],
    first_sale_reinforcement: [
      a("Your first sale is in Gastrometrics", "Your reports now use real sales.", "Now with real sales", "You logged your first sale. From today, your reports compare what you sell with what it costs to make. The more sales you log, the clearer you'll see which dishes pay off.", "See my sales"),
      a("Great start: your first sale logged", "Keep going to unlock your Menu Engineering.", "Your first sale, logged", "With every sale you log, Gastrometrics deducts ingredients from your inventory and shows you your star dishes. You've taken the first step.", "Log another sale"),
    ],
    four_hour_experience: [
      a("Four hours on Gastrometrics: how's it going?", "Your opinion helps us improve.", "How's your experience so far?", "You've spent four hours on Gastrometrics. What do you like and what would you change? We read every answer ourselves and it helps us decide what to improve."),
      a("Tell us what you think of Gastrometrics?", "One minute, and it helps a lot.", "We'd love your opinion", "You've used Gastrometrics for several hours and your opinion is gold. Leave us a comment or a review: it helps us improve and helps other kitchens find us."),
    ],
  },
  da: {
    first_recipe_reminder: [
      a("Din første opskrift tager 5 minutter", "Vælg en ret og se dens reelle kostpris.", "Hvad er din bedst sælgende ret?", "Start med den. Tilføj ingredienserne med det, du betaler for dem, og Gastrometrics fortæller dig, hvad hver portion koster, og hvad du bør sælge den for.", "Kalkulér min første ret"),
      a("Du kender stadig ikke dine retters reelle kostpris", "Én opskrift er nok til at starte.", "Én ret, ét reelt tal", "Din konto er klar. Det, der mangler, er din første opskrift: med bare én ser du kostprisen pr. portion, fortjenesten og en foreslået pris i din valuta.", "Opret min første opskrift"),
    ],
    day7_margin_checkin: [
      a("Dækker dine priser dine omkostninger?", "Efter en uge: tjek din margin.", "Lad os se på dine tal", "Du har brugt Gastrometrics i en uge. Åbn Rapporter og sammenlign din reelle food cost med dit mål: er en ret gået over, er det tid til at justere prisen.", "Se mine rapporter"),
      a("En uge med kalkulation: hvad fandt du?", "Din gennemsnitlige food cost er allerede beregnet.", "Din første uge i tal", "Med de opskrifter, du har tilføjet, kan du allerede se din gennemsnitlige food cost, og hvilke retter der giver mest. Brug to minutter på at kigge.", "Åbn Rapporter"),
    ],
    first_sale_reinforcement: [
      a("Dit første salg er i Gastrometrics", "Dine rapporter bruger nu reelt salg.", "Nu med reelt salg", "Du har registreret dit første salg. Fra i dag sammenligner dine rapporter det, du sælger, med det, det koster at lave. Jo mere salg du registrerer, jo tydeligere ser du, hvilke retter der betaler sig.", "Se mit salg"),
      a("God start: dit første salg er registreret", "Fortsæt for at låse op for Menu Engineering.", "Dit første salg, registreret", "Med hvert salg du registrerer, trækker Gastrometrics ingredienser fra dit lager og viser dig dine stjerneretter. Du har taget første skridt.", "Registrér endnu et salg"),
    ],
    four_hour_experience: [
      a("Fire timer i Gastrometrics: hvordan går det?", "Din mening hjælper os med at blive bedre.", "Hvordan er din oplevelse?", "Du har brugt fire timer i Gastrometrics. Hvad kan du lide, og hvad ville du ændre? Vi læser selv hvert svar, og det hjælper os med at vælge, hvad vi forbedrer."),
      a("Vil du fortælle os, hvad du synes om Gastrometrics?", "Ét minut, og det hjælper meget.", "Vi vil gerne høre din mening", "Du har brugt Gastrometrics i flere timer, og din mening er guld værd. Skriv en kommentar eller en anmeldelse: det hjælper os med at blive bedre og andre køkkener med at finde os."),
    ],
  },
  fr: {
    first_recipe_reminder: [
      a("Votre première recette prend 5 minutes", "Choisissez un plat et voyez son coût réel.", "Quel est votre plat le plus vendu ?", "Commencez par celui-là. Ajoutez ses ingrédients avec ce que vous les payez et Gastrometrics vous dit combien coûte chaque portion et à quel prix la vendre.", "Chiffrer mon premier plat"),
      a("Vous ne connaissez pas encore le coût réel de vos plats", "Une recette suffit pour commencer.", "Un plat, un chiffre réel", "Votre compte est prêt. Il manque votre première recette : avec une seule, vous voyez le coût par portion, la marge et un prix suggéré dans votre devise.", "Créer ma première recette"),
    ],
    day7_margin_checkin: [
      a("Vos prix couvrent-ils vos coûts ?", "Une semaine plus tard, vérifiez votre marge.", "Revoyons vos chiffres", "Cela fait une semaine que vous utilisez Gastrometrics. Ouvrez Rapports et comparez votre food cost réel à votre objectif : si un plat dépasse, c'est le moment d'ajuster son prix.", "Voir mes rapports"),
      a("Une semaine de chiffrage : qu'avez-vous découvert ?", "Votre food cost moyen est déjà calculé.", "Votre première semaine en chiffres", "Avec les recettes ajoutées, vous voyez déjà votre food cost moyen et les plats qui rapportent le plus. Prenez deux minutes pour y jeter un œil.", "Ouvrir Rapports"),
    ],
    first_sale_reinforcement: [
      a("Votre première vente est dans Gastrometrics", "Vos rapports utilisent maintenant des ventes réelles.", "Désormais avec des ventes réelles", "Vous avez enregistré votre première vente. Dès aujourd'hui, vos rapports comparent ce que vous vendez à ce que cela coûte à produire. Plus vous enregistrez de ventes, plus vous voyez clairement quels plats sont rentables.", "Voir mes ventes"),
      a("Bon début : première vente enregistrée", "Continuez pour débloquer votre Menu Engineering.", "Votre première vente, enregistrée", "À chaque vente enregistrée, Gastrometrics déduit les ingrédients de votre stock et vous montre vos plats vedettes. Vous avez fait le premier pas.", "Enregistrer une autre vente"),
    ],
    four_hour_experience: [
      a("Quatre heures sur Gastrometrics : comment ça se passe ?", "Votre avis nous aide à nous améliorer.", "Comment se passe votre expérience ?", "Vous avez passé quatre heures sur Gastrometrics. Qu'est-ce qui vous plaît et que changeriez-vous ? Nous lisons nous-mêmes chaque réponse et cela nous aide à décider quoi améliorer."),
      a("Vous nous dites ce que vous pensez de Gastrometrics ?", "Une minute, et cela nous aide beaucoup.", "Nous aimerions votre avis", "Vous utilisez Gastrometrics depuis plusieurs heures et votre avis est précieux. Laissez-nous un commentaire ou un avis : cela nous aide à progresser et d'autres cuisines à nous découvrir."),
    ],
  },
  pt: {
    first_recipe_reminder: [
      a("Sua primeira receita leva 5 minutos", "Escolha um prato e veja o custo real.", "Qual é o seu prato mais vendido?", "Comece por ele. Cadastre os ingredientes com o que você paga e a Gastrometrics mostra quanto custa cada porção e por quanto vale vender.", "Custear meu primeiro prato"),
      a("Você ainda não sabe o custo real dos seus pratos", "Uma receita basta para começar.", "Um prato, um número real", "Sua conta está pronta. Falta sua primeira receita: com apenas uma você já vê o custo por porção, o lucro e um preço sugerido na sua moeda.", "Criar minha primeira receita"),
    ],
    day7_margin_checkin: [
      a("Seus preços cobrem seus custos?", "Uma semana depois, revise sua margem.", "Vamos revisar seus números", "Você já usa a Gastrometrics há uma semana. Abra Relatórios e compare seu food cost real com a meta: se algum prato passou, é hora de ajustar o preço.", "Ver meus relatórios"),
      a("Uma semana custeando: o que você descobriu?", "Seu food cost médio já está calculado.", "Sua primeira semana em números", "Com as receitas que cadastrou, você já vê seu food cost médio e quais pratos deixam mais. Tire dois minutos para olhar.", "Abrir Relatórios"),
    ],
    first_sale_reinforcement: [
      a("Sua primeira venda já está na Gastrometrics", "Agora seus relatórios usam vendas reais.", "Agora sim: vendas reais", "Você registrou sua primeira venda. A partir de hoje, seus relatórios comparam o que você vende com o que custa produzir. Quanto mais vendas registrar, mais claro vai ver quais pratos compensam.", "Ver minhas vendas"),
      a("Bom começo: primeira venda registrada", "Continue para desbloquear seu Menu Engineering.", "Sua primeira venda, registrada", "A cada venda registrada, a Gastrometrics desconta ingredientes do estoque e mostra seus pratos estrela. Você já deu o primeiro passo.", "Registrar outra venda"),
    ],
    four_hour_experience: [
      a("Quatro horas na Gastrometrics: como está indo?", "Sua opinião nos ajuda a melhorar.", "Como está sua experiência?", "Você já usou a Gastrometrics por quatro horas. Do que você gosta e o que mudaria? Nós mesmos lemos cada resposta, e isso nos ajuda a decidir o que melhorar."),
      a("Conta pra gente o que você acha da Gastrometrics?", "Um minuto, e ajuda muito.", "Queremos sua opinião", "Você usou a Gastrometrics por várias horas e sua opinião vale ouro. Deixe um comentário ou uma avaliação: nos ajuda a melhorar e outras cozinhas a nos conhecer."),
    ],
  },
  zh: {
    first_recipe_reminder: [
      a("你的第一个配方只需 5 分钟", "选一道菜，看看它的真实成本。", "你最畅销的菜是哪道？", "就从它开始。录入原料和你的采购价格，Gastrometrics 会告诉你每份的成本以及建议售价。", "核算我的第一道菜"),
      a("你还不知道菜品的真实成本", "一个配方就足以开始。", "一道菜，一个真实数字", "你的账户已准备好，只差第一个配方：只要一个，你就能看到每份成本、利润和以你的货币显示的建议售价。", "创建我的第一个配方"),
    ],
    day7_margin_checkin: [
      a("你的价格能覆盖成本吗？", "一周后，检查一下你的毛利。", "一起看看你的数字", "你已经使用 Gastrometrics 一周了。打开报表，将实际食材成本率与目标比较：如果某道菜超了，现在就是调整价格的时候。", "查看我的报表"),
      a("核算一周：你发现了什么？", "你的平均食材成本率已经算好了。", "你第一周的数字", "根据你录入的配方，你已经可以看到平均食材成本率以及哪些菜最赚钱。花两分钟看看吧。", "打开报表"),
    ],
    first_sale_reinforcement: [
      a("你的第一笔销售已记录在 Gastrometrics", "你的报表现在使用真实销售数据。", "现在有了真实销售", "你记录了第一笔销售。从今天起，你的报表会将销售额与制作成本进行比较。记录的销售越多，你就越清楚哪些菜品划算。", "查看我的销售"),
      a("好的开始：第一笔销售已记录", "继续记录即可解锁菜单工程。", "你的第一笔销售，已记录", "每记录一笔销售，Gastrometrics 都会从库存中扣除原料，并展示你的明星菜品。你已经迈出了第一步。", "再记录一笔销售"),
    ],
    four_hour_experience: [
      a("使用 Gastrometrics 四小时了：感觉如何？", "你的意见帮助我们改进。", "你的体验怎么样？", "你已经使用 Gastrometrics 四个小时了。你喜欢什么，又想改变什么？每条回复我们都会亲自阅读，帮助我们决定改进方向。"),
      a("能告诉我们你对 Gastrometrics 的看法吗？", "一分钟，帮助很大。", "我们想听听你的意见", "你已经使用 Gastrometrics 好几个小时了，你的意见非常宝贵。留下评论或评价：帮助我们改进，也让更多厨房认识我们。"),
    ],
  },
}
