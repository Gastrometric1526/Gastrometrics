/**
 * Variantes de los 5 correos de recordatorio (docs/139) para que no lleguen siempre con el
 * mismo texto. La variante 0 es REENGAGEMENT_COPY (reengagement-email-labels.ts); acá están
 * la 1 y la 2 de cada tipo, en los 6 idiomas. Solo cambian asunto, preheader, título, cuerpo
 * y botón — la etiqueta, el dato destacado y el color son los del tipo.
 *
 * Qué variante recibe cada persona lo decide notify-reengagement.ts: rota con cada envío del
 * mismo tipo (no repite hasta haber pasado por las tres) y arranca en un punto distinto por
 * cuenta. Mismas variables que la variante 0: {name}, {recipe}, {days}, {count}.
 * Español con "tú" (como toda la app, docs/86).
 */

import type { EmailLang } from "./email-labels"
import type { ReengagementType } from "./reengagement-email-labels"

export interface ReengagementVariantCopy {
  subject: string
  preheader: string
  heading: string
  body: string
  cta: string
}

export const REENGAGEMENT_VARIANTS: Record<EmailLang, Record<ReengagementType, ReengagementVariantCopy[]>> = {
  es: {
    unfinished_recipe: [
      {
        subject: "Te faltó poco para terminar «{recipe}»",
        preheader: "Tu borrador sigue guardado, pero no por mucho tiempo.",
        heading: "Ya hiciste la parte difícil",
        body: "La ficha de <strong>{recipe}</strong> quedó casi lista. Solo falta revisarla y guardarla para tener su costo real y su precio sugerido. El borrador se guarda 24 horas desde tu último cambio: aprovéchalo.",
        cta: "Retomar la ficha",
      },
      {
        subject: "¿Guardamos «{recipe}» o la dejamos ir?",
        preheader: "Un par de minutos y tu receta queda costeada para siempre.",
        heading: "Tu borrador vence pronto",
        body: "Dejaste <strong>{recipe}</strong> a medias en la Ficha Técnica. Si la terminas hoy, queda guardada con su costo, su margen y su PDF listo para la cocina. Si no, el borrador se borra solo a las 24 horas.",
        cta: "Guardar mi receta",
      },
    ],
    inventory_count: [
      {
        subject: "Llevas {days} días sin contar tu inventario",
        preheader: "Contar seguido es la forma más barata de encontrar mermas.",
        heading: "¿Cuánto hay realmente en tu bodega?",
        body: "Tu último conteo fue hace <strong>{days} días</strong>. Desde entonces seguramente vendiste, compraste y botaste cosas. Un conteo rápido te muestra la diferencia entre lo que debería quedar y lo que hay de verdad.",
        cta: "Hacer un conteo",
      },
      {
        subject: "Un conteo de 10 minutos te puede ahorrar mucho",
        preheader: "Detecta faltantes antes de que te dejen sin un plato en pleno servicio.",
        heading: "Tu inventario te está esperando",
        body: "Hace <strong>{days} días</strong> que no actualizas tu stock. Con un conteo nuevo, Gastrometrics compara lo que contaste con lo que tus ventas dicen que debería quedar y te avisa qué está bajo el mínimo.",
        cta: "Contar ahora",
      },
    ],
    review_reports: [
      {
        subject: "¿Qué plato te dejó más ganancia esta semana?",
        preheader: "La respuesta está en tus reportes, y quizá te sorprenda.",
        heading: "Tus ventas ya tienen historia",
        body: "Hace <strong>{days} días</strong> que no abres tus reportes. Con las ventas que registraste ya puedes ver qué platos son tus estrellas, cuáles se venden mucho pero dejan poco y dónde se te va el margen.",
        cta: "Abrir mis reportes",
      },
      {
        subject: "Tus números tienen algo que contarte",
        preheader: "Food cost real, margen por plato y Menu Engineering, en una pantalla.",
        heading: "Cinco minutos con tus reportes",
        body: "Registrar ventas es la mitad del trabajo; la otra mitad es mirarlas. Hace <strong>{days} días</strong> que no revisas tus reportes: ahí está tu food cost real frente al teórico y qué platos conviene subir de precio.",
        cta: "Revisar mis números",
      },
    ],
    update_prices: [
      {
        subject: "{count} ingredientes con precios de hace más de un mes",
        preheader: "Un precio viejo hace que tu margen se vea mejor de lo que es.",
        heading: "¿Tu proveedor subió algo?",
        body: "Tienes <strong>{count} ingredientes</strong> sin actualizar hace más de 30 días. Cambia el precio de uno y Gastrometrics recalcula al instante todas las recetas que lo usan, con su costo y su precio sugerido.",
        cta: "Revisar precios",
      },
      {
        subject: "Tus recetas podrían estar costeadas con precios viejos",
        preheader: "Actualizar un precio recalcula todas tus recetas solas.",
        heading: "Pon tus costos al día",
        body: "Los precios cambian y tu Excel no se entera, pero Gastrometrics sí, si le cuentas. <strong>{count} ingredientes</strong> tienen el precio de hace más de 30 días. Actualízalos y mira cómo queda tu margen real.",
        cta: "Actualizar mis ingredientes",
      },
    ],
    we_miss_you: [
      {
        subject: "Tus recetas siguen donde las dejaste",
        preheader: "Vuelve cuando quieras: todo está guardado.",
        heading: "Tu cocina sigue aquí",
        body: "Hace <strong>{days} días</strong> que no pasas por Gastrometrics. Nada se perdió: tus recetas, ingredientes e inventario están tal como los dejaste. Un buen primer paso al volver: actualizar el precio de lo que más compras.",
        cta: "Entrar a mi cuenta",
      },
      {
        subject: "¿Cómo va la cocina?",
        preheader: "Te guardamos todo por si quieres retomar.",
        heading: "Hace tiempo que no te vemos",
        body: "Pasaron <strong>{days} días</strong> desde tu última visita. Si algo te frenó, cuéntanos respondiendo desde la app; y si solo fue falta de tiempo, tus fichas técnicas te esperan para seguir costeando.",
        cta: "Retomar donde lo dejé",
      },
    ],
  },
  en: {
    unfinished_recipe: [
      {
        subject: "You were close to finishing “{recipe}”",
        preheader: "Your draft is still saved, but not for long.",
        heading: "You've done the hard part",
        body: "The sheet for <strong>{recipe}</strong> is almost ready. You just need to review and save it to get its real cost and suggested price. The draft is kept for 24 hours after your last change — make the most of it.",
        cta: "Pick up the sheet",
      },
      {
        subject: "Should we keep “{recipe}” or let it go?",
        preheader: "A couple of minutes and your recipe is costed for good.",
        heading: "Your draft expires soon",
        body: "You left <strong>{recipe}</strong> half-done in the Recipe Sheet. Finish it today and it's saved with its cost, margin and a kitchen-ready PDF. Otherwise the draft deletes itself after 24 hours.",
        cta: "Save my recipe",
      },
    ],
    inventory_count: [
      {
        subject: "It's been {days} days since your last inventory count",
        preheader: "Counting often is the cheapest way to find shrinkage.",
        heading: "How much is really in your storeroom?",
        body: "Your last count was <strong>{days} days</strong> ago. Since then you've surely sold, bought and thrown things away. A quick count shows you the gap between what should be left and what's really there.",
        cta: "Do a count",
      },
      {
        subject: "A 10-minute count can save you a lot",
        preheader: "Spot shortages before they leave you without a dish mid-service.",
        heading: "Your inventory is waiting",
        body: "You haven't updated your stock in <strong>{days} days</strong>. With a new count, Gastrometrics compares what you counted with what your sales say should be left, and flags what's below minimum.",
        cta: "Count now",
      },
    ],
    review_reports: [
      {
        subject: "Which dish made you the most this week?",
        preheader: "The answer is in your reports — it might surprise you.",
        heading: "Your sales already tell a story",
        body: "You haven't opened your reports in <strong>{days} days</strong>. With the sales you've logged you can already see your star dishes, the ones that sell a lot but leave little, and where your margin is leaking.",
        cta: "Open my reports",
      },
      {
        subject: "Your numbers have something to tell you",
        preheader: "Real food cost, margin per dish and Menu Engineering on one screen.",
        heading: "Five minutes with your reports",
        body: "Logging sales is half the job; the other half is looking at them. It's been <strong>{days} days</strong> since you checked your reports: there's your real vs. theoretical food cost and which dishes deserve a price increase.",
        cta: "Check my numbers",
      },
    ],
    update_prices: [
      {
        subject: "{count} ingredients with prices older than a month",
        preheader: "An old price makes your margin look better than it is.",
        heading: "Did a supplier raise prices?",
        body: "You have <strong>{count} ingredients</strong> not updated in over 30 days. Change one price and Gastrometrics instantly recalculates every recipe that uses it, with its cost and suggested price.",
        cta: "Review prices",
      },
      {
        subject: "Your recipes may be costed with old prices",
        preheader: "Updating one price recalculates all your recipes automatically.",
        heading: "Bring your costs up to date",
        body: "Prices change and your spreadsheet never notices — Gastrometrics does, if you tell it. <strong>{count} ingredients</strong> have prices older than 30 days. Update them and see your real margin.",
        cta: "Update my ingredients",
      },
    ],
    we_miss_you: [
      {
        subject: "Your recipes are right where you left them",
        preheader: "Come back anytime: everything is saved.",
        heading: "Your kitchen is still here",
        body: "It's been <strong>{days} days</strong> since you last visited Gastrometrics. Nothing was lost: your recipes, ingredients and inventory are just as you left them. A good first step back: update the price of what you buy most.",
        cta: "Go to my account",
      },
      {
        subject: "How's the kitchen going?",
        preheader: "We kept everything in case you want to pick up again.",
        heading: "We haven't seen you in a while",
        body: "<strong>{days} days</strong> have passed since your last visit. If something held you back, tell us from the app; and if it was just lack of time, your recipe sheets are waiting for you to keep costing.",
        cta: "Pick up where I left off",
      },
    ],
  },
  da: {
    unfinished_recipe: [
      {
        subject: "Du var tæt på at gøre “{recipe}” færdig",
        preheader: "Dit udkast er stadig gemt, men ikke så længe.",
        heading: "Du har klaret det svære",
        body: "Arket for <strong>{recipe}</strong> er næsten klar. Du skal bare gennemgå og gemme det for at få den reelle kostpris og den foreslåede pris. Udkastet gemmes i 24 timer efter din seneste ændring — udnyt det.",
        cta: "Fortsæt med arket",
      },
      {
        subject: "Skal vi gemme “{recipe}” eller slippe den?",
        preheader: "Et par minutter, og din opskrift er kalkuleret for altid.",
        heading: "Dit udkast udløber snart",
        body: "Du lod <strong>{recipe}</strong> være halvfærdig i Opskriftsarket. Gør den færdig i dag, så gemmes den med kostpris, margin og en køkkenklar PDF. Ellers slettes udkastet af sig selv efter 24 timer.",
        cta: "Gem min opskrift",
      },
    ],
    inventory_count: [
      {
        subject: "Der er gået {days} dage siden din seneste lageroptælling",
        preheader: "At tælle ofte er den billigste måde at finde svind på.",
        heading: "Hvor meget står der egentlig på lageret?",
        body: "Din seneste optælling var for <strong>{days} dage</strong> siden. Siden da har du sikkert solgt, købt og smidt ud. En hurtig optælling viser forskellen mellem det, der burde være, og det, der faktisk er.",
        cta: "Lav en optælling",
      },
      {
        subject: "En optælling på 10 minutter kan spare dig meget",
        preheader: "Opdag mangler, før de efterlader dig uden en ret midt i servicen.",
        heading: "Dit lager venter",
        body: "Du har ikke opdateret din beholdning i <strong>{days} dage</strong>. Med en ny optælling sammenligner Gastrometrics det, du talte, med det, dit salg siger burde være tilbage, og markerer, hvad der er under minimum.",
        cta: "Tæl nu",
      },
    ],
    review_reports: [
      {
        subject: "Hvilken ret tjente mest i denne uge?",
        preheader: "Svaret står i dine rapporter — måske overrasker det dig.",
        heading: "Dit salg fortæller allerede en historie",
        body: "Du har ikke åbnet dine rapporter i <strong>{days} dage</strong>. Med det salg, du har registreret, kan du allerede se dine stjerneretter, dem der sælger meget men giver lidt, og hvor din margin forsvinder.",
        cta: "Åbn mine rapporter",
      },
      {
        subject: "Dine tal har noget at fortælle dig",
        preheader: "Reel food cost, margin pr. ret og Menu Engineering på én skærm.",
        heading: "Fem minutter med dine rapporter",
        body: "At registrere salg er halvdelen af arbejdet; den anden halvdel er at se på det. Der er gået <strong>{days} dage</strong>, siden du så dine rapporter: der står din reelle mod teoretiske food cost, og hvilke retter der fortjener en prisstigning.",
        cta: "Se mine tal",
      },
    ],
    update_prices: [
      {
        subject: "{count} ingredienser med priser ældre end en måned",
        preheader: "En gammel pris får din margin til at se bedre ud, end den er.",
        heading: "Har en leverandør hævet priserne?",
        body: "Du har <strong>{count} ingredienser</strong>, der ikke er opdateret i over 30 dage. Ændr én pris, og Gastrometrics genberegner straks alle opskrifter, der bruger den, med kostpris og foreslået pris.",
        cta: "Gennemgå priser",
      },
      {
        subject: "Dine opskrifter kan være kalkuleret med gamle priser",
        preheader: "Opdaterer du én pris, genberegnes alle dine opskrifter automatisk.",
        heading: "Få dine omkostninger ajour",
        body: "Priserne ændrer sig, og dit regneark opdager det aldrig — det gør Gastrometrics, hvis du fortæller det. <strong>{count} ingredienser</strong> har priser ældre end 30 dage. Opdatér dem, og se din reelle margin.",
        cta: "Opdatér mine ingredienser",
      },
    ],
    we_miss_you: [
      {
        subject: "Dine opskrifter ligger, hvor du efterlod dem",
        preheader: "Kom tilbage, når du vil: alt er gemt.",
        heading: "Dit køkken er her stadig",
        body: "Der er gået <strong>{days} dage</strong>, siden du sidst var på Gastrometrics. Intet er gået tabt: dine opskrifter, ingredienser og dit lager er, som du efterlod dem. Et godt første skridt: opdatér prisen på det, du køber mest.",
        cta: "Gå til min konto",
      },
      {
        subject: "Hvordan går det i køkkenet?",
        preheader: "Vi har gemt alt, hvis du vil fortsætte.",
        heading: "Vi har ikke set dig i et stykke tid",
        body: "Der er gået <strong>{days} dage</strong> siden dit seneste besøg. Hvis noget holdt dig tilbage, så fortæl os det fra appen; og hvis det bare var travlhed, venter dine opskriftsark på, at du kalkulerer videre.",
        cta: "Fortsæt hvor jeg slap",
      },
    ],
  },
  fr: {
    unfinished_recipe: [
      {
        subject: "Vous y étiez presque avec « {recipe} »",
        preheader: "Votre brouillon est encore enregistré, mais plus pour longtemps.",
        heading: "Vous avez fait le plus dur",
        body: "La fiche de <strong>{recipe}</strong> est presque prête. Il ne reste qu'à la vérifier et l'enregistrer pour obtenir son coût réel et son prix suggéré. Le brouillon est conservé 24 heures après votre dernière modification : profitez-en.",
        cta: "Reprendre la fiche",
      },
      {
        subject: "On garde « {recipe} » ou on la laisse filer ?",
        preheader: "Deux minutes et votre recette est chiffrée pour de bon.",
        heading: "Votre brouillon expire bientôt",
        body: "Vous avez laissé <strong>{recipe}</strong> à moitié dans la Fiche Technique. Terminez-la aujourd'hui et elle sera enregistrée avec son coût, sa marge et un PDF prêt pour la cuisine. Sinon, le brouillon s'efface tout seul au bout de 24 heures.",
        cta: "Enregistrer ma recette",
      },
    ],
    inventory_count: [
      {
        subject: "Cela fait {days} jours depuis votre dernier inventaire",
        preheader: "Compter souvent est le moyen le moins cher de repérer les pertes.",
        heading: "Qu'y a-t-il vraiment dans votre réserve ?",
        body: "Votre dernier comptage date d'il y a <strong>{days} jours</strong>. Depuis, vous avez sûrement vendu, acheté et jeté. Un comptage rapide vous montre l'écart entre ce qui devrait rester et ce qu'il y a réellement.",
        cta: "Faire un comptage",
      },
      {
        subject: "Un comptage de 10 minutes peut vous faire économiser beaucoup",
        preheader: "Repérez les manques avant qu'ils ne vous privent d'un plat en plein service.",
        heading: "Votre inventaire vous attend",
        body: "Vous n'avez pas mis à jour votre stock depuis <strong>{days} jours</strong>. Avec un nouveau comptage, Gastrometrics compare ce que vous avez compté à ce que vos ventes indiquent et signale ce qui est sous le minimum.",
        cta: "Compter maintenant",
      },
    ],
    review_reports: [
      {
        subject: "Quel plat vous a rapporté le plus cette semaine ?",
        preheader: "La réponse est dans vos rapports — elle pourrait vous surprendre.",
        heading: "Vos ventes racontent déjà une histoire",
        body: "Vous n'avez pas ouvert vos rapports depuis <strong>{days} jours</strong>. Avec les ventes enregistrées, vous voyez déjà vos plats vedettes, ceux qui se vendent beaucoup mais rapportent peu, et où votre marge s'échappe.",
        cta: "Ouvrir mes rapports",
      },
      {
        subject: "Vos chiffres ont quelque chose à vous dire",
        preheader: "Food cost réel, marge par plat et Menu Engineering sur un seul écran.",
        heading: "Cinq minutes avec vos rapports",
        body: "Enregistrer les ventes, c'est la moitié du travail ; l'autre moitié, c'est de les regarder. Cela fait <strong>{days} jours</strong> que vous n'avez pas consulté vos rapports : votre food cost réel face au théorique et les plats qui méritent une hausse de prix vous y attendent.",
        cta: "Voir mes chiffres",
      },
    ],
    update_prices: [
      {
        subject: "{count} ingrédients avec des prix vieux de plus d'un mois",
        preheader: "Un prix ancien fait paraître votre marge meilleure qu'elle ne l'est.",
        heading: "Un fournisseur a-t-il augmenté ses prix ?",
        body: "Vous avez <strong>{count} ingrédients</strong> non mis à jour depuis plus de 30 jours. Modifiez un prix et Gastrometrics recalcule aussitôt toutes les recettes qui l'utilisent, avec leur coût et leur prix suggéré.",
        cta: "Vérifier les prix",
      },
      {
        subject: "Vos recettes sont peut-être chiffrées avec d'anciens prix",
        preheader: "Mettre à jour un prix recalcule automatiquement toutes vos recettes.",
        heading: "Remettez vos coûts à jour",
        body: "Les prix changent et votre tableur ne s'en rend jamais compte — Gastrometrics oui, si vous le lui dites. <strong>{count} ingrédients</strong> ont des prix de plus de 30 jours. Mettez-les à jour et découvrez votre marge réelle.",
        cta: "Mettre à jour mes ingrédients",
      },
    ],
    we_miss_you: [
      {
        subject: "Vos recettes sont là où vous les avez laissées",
        preheader: "Revenez quand vous voulez : tout est enregistré.",
        heading: "Votre cuisine est toujours là",
        body: "Cela fait <strong>{days} jours</strong> que vous n'êtes pas passé sur Gastrometrics. Rien n'a été perdu : vos recettes, ingrédients et inventaire sont tels que vous les avez laissés. Un bon premier pas : mettre à jour le prix de ce que vous achetez le plus.",
        cta: "Accéder à mon compte",
      },
      {
        subject: "Comment ça se passe en cuisine ?",
        preheader: "Nous avons tout gardé au cas où vous voudriez reprendre.",
        heading: "Cela fait un moment",
        body: "<strong>{days} jours</strong> se sont écoulés depuis votre dernière visite. Si quelque chose vous a freiné, dites-le-nous depuis l'application ; et si c'était juste le manque de temps, vos fiches techniques vous attendent.",
        cta: "Reprendre où j'en étais",
      },
    ],
  },
  pt: {
    unfinished_recipe: [
      {
        subject: "Faltou pouco para terminar «{recipe}»",
        preheader: "Seu rascunho continua salvo, mas não por muito tempo.",
        heading: "Você já fez a parte difícil",
        body: "A ficha de <strong>{recipe}</strong> está quase pronta. Só falta revisar e salvar para ter o custo real e o preço sugerido. O rascunho fica guardado por 24 horas desde a sua última alteração: aproveite.",
        cta: "Retomar a ficha",
      },
      {
        subject: "Guardamos «{recipe}» ou deixamos pra lá?",
        preheader: "Uns minutinhos e sua receita fica custeada de vez.",
        heading: "Seu rascunho vence em breve",
        body: "Você deixou <strong>{recipe}</strong> pela metade na Ficha Técnica. Se terminar hoje, ela fica salva com custo, margem e PDF pronto para a cozinha. Se não, o rascunho se apaga sozinho em 24 horas.",
        cta: "Salvar minha receita",
      },
    ],
    inventory_count: [
      {
        subject: "Já são {days} dias sem contar seu estoque",
        preheader: "Contar com frequência é o jeito mais barato de achar perdas.",
        heading: "Quanto tem de verdade no seu estoque?",
        body: "Sua última contagem foi há <strong>{days} dias</strong>. Desde então você certamente vendeu, comprou e descartou coisas. Uma contagem rápida mostra a diferença entre o que deveria sobrar e o que realmente tem.",
        cta: "Fazer uma contagem",
      },
      {
        subject: "Uma contagem de 10 minutos pode te economizar muito",
        preheader: "Descubra faltas antes que te deixem sem um prato em pleno serviço.",
        heading: "Seu estoque está te esperando",
        body: "Faz <strong>{days} dias</strong> que você não atualiza o saldo. Com uma contagem nova, a Gastrometrics compara o que você contou com o que as vendas dizem que deveria sobrar e avisa o que está abaixo do mínimo.",
        cta: "Contar agora",
      },
    ],
    review_reports: [
      {
        subject: "Qual prato deu mais lucro esta semana?",
        preheader: "A resposta está nos seus relatórios — e pode te surpreender.",
        heading: "Suas vendas já contam uma história",
        body: "Faz <strong>{days} dias</strong> que você não abre seus relatórios. Com as vendas registradas você já vê seus pratos estrela, os que vendem muito mas deixam pouco e onde a margem está escapando.",
        cta: "Abrir meus relatórios",
      },
      {
        subject: "Seus números têm algo a te dizer",
        preheader: "Food cost real, margem por prato e Menu Engineering em uma tela.",
        heading: "Cinco minutos com seus relatórios",
        body: "Registrar vendas é metade do trabalho; a outra metade é olhar para elas. Faz <strong>{days} dias</strong> que você não confere seus relatórios: lá estão seu food cost real frente ao teórico e os pratos que merecem aumento de preço.",
        cta: "Ver meus números",
      },
    ],
    update_prices: [
      {
        subject: "{count} ingredientes com preços de mais de um mês",
        preheader: "Um preço antigo faz sua margem parecer melhor do que é.",
        heading: "Algum fornecedor aumentou o preço?",
        body: "Você tem <strong>{count} ingredientes</strong> sem atualizar há mais de 30 dias. Mude um preço e a Gastrometrics recalcula na hora todas as receitas que o usam, com custo e preço sugerido.",
        cta: "Revisar preços",
      },
      {
        subject: "Suas receitas podem estar custeadas com preços antigos",
        preheader: "Atualizar um preço recalcula todas as suas receitas sozinho.",
        heading: "Coloque seus custos em dia",
        body: "Os preços mudam e a planilha nunca percebe — a Gastrometrics percebe, se você contar. <strong>{count} ingredientes</strong> têm preços de mais de 30 dias. Atualize-os e veja sua margem real.",
        cta: "Atualizar meus ingredientes",
      },
    ],
    we_miss_you: [
      {
        subject: "Suas receitas continuam onde você deixou",
        preheader: "Volte quando quiser: está tudo salvo.",
        heading: "Sua cozinha continua aqui",
        body: "Faz <strong>{days} dias</strong> que você não passa pela Gastrometrics. Nada se perdeu: receitas, ingredientes e estoque estão como você deixou. Um bom primeiro passo ao voltar: atualizar o preço do que você mais compra.",
        cta: "Entrar na minha conta",
      },
      {
        subject: "Como vai a cozinha?",
        preheader: "Guardamos tudo caso você queira retomar.",
        heading: "Faz tempo que não te vemos",
        body: "Passaram-se <strong>{days} dias</strong> desde a sua última visita. Se algo te travou, conte pra gente pelo app; e se foi só falta de tempo, suas fichas técnicas estão te esperando.",
        cta: "Continuar de onde parei",
      },
    ],
  },
  zh: {
    unfinished_recipe: [
      {
        subject: "“{recipe}” 就差一点点了",
        preheader: "你的草稿仍然保存着，但不会太久。",
        heading: "最难的部分你已经完成了",
        body: "<strong>{recipe}</strong> 的配方表几乎完成了。只需检查并保存，就能得到它的真实成本和建议售价。草稿会在你最后一次修改后保留 24 小时，抓紧时间吧。",
        cta: "继续编辑配方表",
      },
      {
        subject: "要保存 “{recipe}” 还是放弃它？",
        preheader: "只要几分钟，你的配方就永久完成成本核算。",
        heading: "你的草稿即将过期",
        body: "你在技术配方表中留下了未完成的 <strong>{recipe}</strong>。今天完成它，就会连同成本、毛利和厨房用 PDF 一起保存。否则草稿会在 24 小时后自动删除。",
        cta: "保存我的配方",
      },
    ],
    inventory_count: [
      {
        subject: "距离你上次盘点库存已经 {days} 天了",
        preheader: "经常盘点是发现损耗最省钱的方法。",
        heading: "你的库房里到底还有多少？",
        body: "你上次盘点是在 <strong>{days} 天</strong>前。这段时间你一定卖出、买进也丢弃了一些东西。快速盘点一次，就能看到理论剩余和实际剩余之间的差距。",
        cta: "开始盘点",
      },
      {
        subject: "10 分钟的盘点能帮你省下不少",
        preheader: "在出餐高峰缺货之前发现短缺。",
        heading: "你的库存在等你",
        body: "你已经 <strong>{days} 天</strong>没有更新库存了。重新盘点后，Gastrometrics 会把你的盘点结果与销售推算的剩余量进行比较，并提醒你哪些低于最低库存。",
        cta: "立即盘点",
      },
    ],
    review_reports: [
      {
        subject: "本周哪道菜赚得最多？",
        preheader: "答案就在你的报表里，也许会让你惊讶。",
        heading: "你的销售已经在讲故事了",
        body: "你已经 <strong>{days} 天</strong>没有打开报表了。根据你录入的销售，你已经可以看到明星菜品、卖得多却赚得少的菜品，以及毛利从哪里流失。",
        cta: "打开我的报表",
      },
      {
        subject: "你的数字有话要说",
        preheader: "真实食材成本率、每道菜毛利和菜单工程，一屏看清。",
        heading: "花五分钟看看报表",
        body: "录入销售只是一半的工作，另一半是去看它们。你已经 <strong>{days} 天</strong>没有查看报表了：那里有你的真实与理论食材成本率，以及哪些菜值得涨价。",
        cta: "查看我的数字",
      },
    ],
    update_prices: [
      {
        subject: "{count} 种原料的价格已超过一个月未更新",
        preheader: "旧价格会让你的毛利看起来比实际更好。",
        heading: "供应商涨价了吗？",
        body: "你有 <strong>{count} 种原料</strong>超过 30 天没有更新。只要修改一个价格，Gastrometrics 就会立即重新计算所有用到它的配方，包括成本和建议售价。",
        cta: "检查价格",
      },
      {
        subject: "你的配方可能还在用旧价格核算",
        preheader: "更新一个价格，所有配方都会自动重新计算。",
        heading: "让你的成本保持最新",
        body: "价格在变，而电子表格永远察觉不到——只要你告诉 Gastrometrics，它就能察觉。<strong>{count} 种原料</strong>的价格已超过 30 天。更新它们，看看你的真实毛利。",
        cta: "更新我的原料",
      },
    ],
    we_miss_you: [
      {
        subject: "你的配方还在原来的地方",
        preheader: "随时回来：一切都保存着。",
        heading: "你的厨房还在这里",
        body: "你已经 <strong>{days} 天</strong>没有访问 Gastrometrics 了。什么都没丢：你的配方、原料和库存都保持原样。回来后的好第一步：更新你最常购买的原料价格。",
        cta: "进入我的账户",
      },
      {
        subject: "厨房最近怎么样？",
        preheader: "我们为你保留了一切，方便你随时继续。",
        heading: "好久不见",
        body: "距离你上次访问已经过去 <strong>{days} 天</strong>了。如果是遇到了什么问题，欢迎在应用中告诉我们；如果只是太忙，你的技术配方表还在等你继续核算。",
        cta: "从上次的地方继续",
      },
    ],
  },
}
