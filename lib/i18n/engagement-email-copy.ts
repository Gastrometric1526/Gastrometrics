/**
 * Textos de los 7 correos de valor (docs/144): resumen semanal, stock bajo, platos que
 * pierden margen, funciones del plan sin usar, logros, invitación sin aceptar y negocio
 * vacío. Cada tipo tiene 3 versiones por idioma (rotan con cada envío, igual que los
 * recordatorios de docs/139). Español con "tú" (docs/86).
 *
 * Variables: {count}, {feature}, {plan}, {milestone}, {invitee}, {days}, {business}.
 * Las listas (productos, platos) y la tabla del resumen las arma notify-engagement.ts
 * con ENGAGEMENT_SHARED.
 */

import type { EmailLang } from "./email-labels"

export type EngagementType =
  | "weekly_summary"
  | "low_stock"
  | "margin_alert"
  | "unused_feature"
  | "milestone"
  | "invite_pending"
  | "empty_business"

export const ENGAGEMENT_TYPES: EngagementType[] = [
  "weekly_summary",
  "low_stock",
  "margin_alert",
  "unused_feature",
  "milestone",
  "invite_pending",
  "empty_business",
]

export interface EngagementVariant {
  subject: string
  preheader: string
  heading: string
  body: string
  cta: string
}

export interface EngagementTypeCopy {
  eyebrow: string
  variants: [EngagementVariant, EngagementVariant, EngagementVariant]
}

export interface EngagementShared {
  weeklyRecipes: string
  weeklyFoodCost: string
  weeklyInventory: string
  weeklyLowStock: string
  weeklyMargin: string
  lowStockItem: string // {name} {current} {min} {unit}
  marginItem: string // {name} {actual} {target}
  belowCostItem: string // {name}
  andMore: string // {n}
  milestones: Record<"recipes_10" | "recipes_25" | "recipes_50" | "recipes_100" | "first_menu" | "first_count", string>
}

export const ENGAGEMENT_SHARED: Record<EmailLang, EngagementShared> = {
  es: {
    weeklyRecipes: "Recetas",
    weeklyFoodCost: "Food cost promedio",
    weeklyInventory: "Valor de inventario",
    weeklyLowStock: "Productos bajo mínimo",
    weeklyMargin: "Platos con margen bajo",
    lowStockItem: "<strong>{name}</strong>: quedan {current} {unit} (mínimo {min})",
    marginItem: "<strong>{name}</strong>: food cost {actual} % (meta {target} %)",
    belowCostItem: "<strong>{name}</strong>: cuesta más de lo que se vende",
    andMore: "y {n} más",
    milestones: {
      recipes_10: "10 recetas costeadas",
      recipes_25: "25 recetas costeadas",
      recipes_50: "50 recetas costeadas",
      recipes_100: "100 recetas costeadas",
      first_menu: "tu primer menú",
      first_count: "tu primer conteo de inventario",
    },
  },
  en: {
    weeklyRecipes: "Recipes",
    weeklyFoodCost: "Average food cost",
    weeklyInventory: "Inventory value",
    weeklyLowStock: "Items below minimum",
    weeklyMargin: "Dishes with low margin",
    lowStockItem: "<strong>{name}</strong>: {current} {unit} left (minimum {min})",
    marginItem: "<strong>{name}</strong>: food cost {actual}% (target {target}%)",
    belowCostItem: "<strong>{name}</strong>: costs more than it sells for",
    andMore: "and {n} more",
    milestones: {
      recipes_10: "10 costed recipes",
      recipes_25: "25 costed recipes",
      recipes_50: "50 costed recipes",
      recipes_100: "100 costed recipes",
      first_menu: "your first menu",
      first_count: "your first inventory count",
    },
  },
  da: {
    weeklyRecipes: "Opskrifter",
    weeklyFoodCost: "Gns. food cost",
    weeklyInventory: "Lagerværdi",
    weeklyLowStock: "Varer under minimum",
    weeklyMargin: "Retter med lav margin",
    lowStockItem: "<strong>{name}</strong>: {current} {unit} tilbage (minimum {min})",
    marginItem: "<strong>{name}</strong>: food cost {actual} % (mål {target} %)",
    belowCostItem: "<strong>{name}</strong>: koster mere, end den sælges for",
    andMore: "og {n} mere",
    milestones: {
      recipes_10: "10 kalkulerede opskrifter",
      recipes_25: "25 kalkulerede opskrifter",
      recipes_50: "50 kalkulerede opskrifter",
      recipes_100: "100 kalkulerede opskrifter",
      first_menu: "din første menu",
      first_count: "din første lageroptælling",
    },
  },
  fr: {
    weeklyRecipes: "Recettes",
    weeklyFoodCost: "Food cost moyen",
    weeklyInventory: "Valeur du stock",
    weeklyLowStock: "Produits sous le minimum",
    weeklyMargin: "Plats à faible marge",
    lowStockItem: "<strong>{name}</strong> : il reste {current} {unit} (minimum {min})",
    marginItem: "<strong>{name}</strong> : food cost {actual} % (objectif {target} %)",
    belowCostItem: "<strong>{name}</strong> : coûte plus cher qu'il ne se vend",
    andMore: "et {n} de plus",
    milestones: {
      recipes_10: "10 recettes chiffrées",
      recipes_25: "25 recettes chiffrées",
      recipes_50: "50 recettes chiffrées",
      recipes_100: "100 recettes chiffrées",
      first_menu: "votre premier menu",
      first_count: "votre premier inventaire",
    },
  },
  pt: {
    weeklyRecipes: "Receitas",
    weeklyFoodCost: "Food cost médio",
    weeklyInventory: "Valor do estoque",
    weeklyLowStock: "Produtos abaixo do mínimo",
    weeklyMargin: "Pratos com margem baixa",
    lowStockItem: "<strong>{name}</strong>: restam {current} {unit} (mínimo {min})",
    marginItem: "<strong>{name}</strong>: food cost {actual} % (meta {target} %)",
    belowCostItem: "<strong>{name}</strong>: custa mais do que é vendido",
    andMore: "e mais {n}",
    milestones: {
      recipes_10: "10 receitas custeadas",
      recipes_25: "25 receitas custeadas",
      recipes_50: "50 receitas custeadas",
      recipes_100: "100 receitas custeadas",
      first_menu: "seu primeiro cardápio",
      first_count: "sua primeira contagem de estoque",
    },
  },
  zh: {
    weeklyRecipes: "配方",
    weeklyFoodCost: "平均食材成本率",
    weeklyInventory: "库存价值",
    weeklyLowStock: "低于最低库存的产品",
    weeklyMargin: "毛利偏低的菜品",
    lowStockItem: "<strong>{name}</strong>：剩余 {current} {unit}（最低 {min}）",
    marginItem: "<strong>{name}</strong>：食材成本率 {actual}%（目标 {target}%）",
    belowCostItem: "<strong>{name}</strong>：成本高于售价",
    andMore: "还有 {n} 项",
    milestones: {
      recipes_10: "10 个已核算成本的配方",
      recipes_25: "25 个已核算成本的配方",
      recipes_50: "50 个已核算成本的配方",
      recipes_100: "100 个已核算成本的配方",
      first_menu: "你的第一份菜单",
      first_count: "你的第一次库存盘点",
    },
  },
}

const v = (subject: string, preheader: string, heading: string, body: string, cta: string): EngagementVariant => ({
  subject,
  preheader,
  heading,
  body,
  cta,
})

export const ENGAGEMENT_COPY: Record<EmailLang, Record<EngagementType, EngagementTypeCopy>> = {
  es: {
    weekly_summary: {
      eyebrow: "Tu semana",
      variants: [
        v("Tu cocina esta semana, en números", "Food cost, inventario y alertas en un vistazo.", "Así está tu cocina esta semana", "Te dejamos el resumen de tu cuenta para empezar la semana con los números claros.", "Ver mis reportes"),
        v("Lo que tienes que saber de tu cocina hoy", "Tus números de la semana, sin abrir el Excel.", "Tu resumen semanal", "Un vistazo rápido a lo más importante de tu cuenta: costos, inventario y lo que conviene revisar.", "Abrir Gastrometrics"),
        v("Lunes de números: tu resumen semanal", "Cinco datos para decidir mejor esta semana.", "Empieza la semana con tus números", "Esto es lo que dice tu cuenta hoy. Si algo está en rojo, es un buen momento para revisarlo.", "Revisar mi cocina"),
      ],
    },
    low_stock: {
      eyebrow: "Inventario",
      variants: [
        v("{count} productos están por acabarse", "Repón antes de quedarte sin un plato en pleno servicio.", "Hay productos bajo su mínimo", "Según tu inventario, estos productos ya llegaron a su mínimo o están por debajo:", "Ver inventario"),
        v("Antes del servicio: revisa estos {count} productos", "Tu stock está bajo el mínimo que definiste.", "Tu bodega necesita atención", "Estos productos están en su mínimo o por debajo. Desde Gastrometrics puedes armar la orden de compra en un par de clics.", "Armar orden de compra"),
        v("Alerta de stock: {count} productos en el mínimo", "Que no te tome por sorpresa un faltante.", "Se te están acabando estos productos", "Para que no te falte nada esta semana, revisa estos productos que ya llegaron a su mínimo:", "Revisar stock"),
      ],
    },
    margin_alert: {
      eyebrow: "Margen",
      variants: [
        v("{count} platos ya no te dejan lo que crees", "Su costo subió y el precio quedó igual.", "Estos platos están perdiendo margen", "El costo de estos platos ya supera la meta con la que los costeaste. Quizá subió algún insumo y el precio quedó igual:", "Revisar precios"),
        v("Revisa el precio de estos {count} platos", "Tu food cost real está por encima de tu meta.", "Tu margen se está achicando", "Con los precios actuales de tus ingredientes, estos platos dejan menos de lo que planeaste:", "Ajustar mis platos"),
        v("Ojo con el margen de {count} platos", "Pequeñas diferencias por plato se vuelven mucho al mes.", "Hay platos que conviene ajustar", "Una diferencia pequeña por plato, multiplicada por todo el mes, es dinero que se va. Estos son los que más se alejaron de tu meta:", "Ver mis recetas"),
      ],
    },
    unused_feature: {
      eyebrow: "Tu plan",
      variants: [
        v("Tu plan incluye {feature} y aún no lo usas", "Ya lo tienes: solo falta probarlo.", "Tienes {feature} esperándote", "Tu plan {plan} incluye <strong>{feature}</strong> y todavía no lo has abierto. Es una de las partes que más tiempo ahorra en la cocina.", "Probarlo ahora"),
        v("¿Ya probaste {feature}?", "Está incluido en tu plan {plan}.", "Saca más provecho de tu plan", "Con tu plan {plan} ya tienes <strong>{feature}</strong>. Si no sabes por dónde empezar, el tutorial de esa sección te guía paso a paso.", "Abrir {feature}"),
        v("Una función de tu plan que te puede ahorrar horas", "{feature}, incluido en {plan}.", "Lo tienes, pero no lo has usado", "Muchos dueños descubren <strong>{feature}</strong> tarde y desearían haberlo usado antes. Ya está en tu plan {plan}, listo para cuando quieras.", "Ver {feature}"),
      ],
    },
    milestone: {
      eyebrow: "Logro",
      variants: [
        v("¡Llegaste a {milestone}!", "Cada paso te da números más claros.", "¡Felicidades: {milestone}!", "Ya lograste <strong>{milestone}</strong> en Gastrometrics. Cada receta e inventario que cargas hace que tus costos sean más reales.", "Seguir avanzando"),
        v("Un logro para tu cocina: {milestone}", "Vas muy bien.", "Lo lograste: {milestone}", "Queríamos celebrarlo contigo: ya tienes <strong>{milestone}</strong>. Eso ya es una base sólida para decidir precios con datos.", "Ver mi cocina"),
        v("{milestone}: buen trabajo", "Tu cocina está cada vez más ordenada.", "Buen trabajo con {milestone}", "Llegar a <strong>{milestone}</strong> no es poca cosa. Sigue así: con tus datos al día, cada decisión de precio es más fácil.", "Abrir Gastrometrics"),
      ],
    },
    invite_pending: {
      eyebrow: "Equipo",
      variants: [
        v("{invitee} todavía no acepta tu invitación", "Hace {days} días que la enviaste.", "Tu invitación sigue pendiente", "Invitaste a <strong>{invitee}</strong> a tu equipo hace {days} días y aún no ha entrado. Quizá el correo se fue a spam: puedes reenviarla desde Equipo.", "Ir a Equipo"),
        v("¿Le recuerdas a {invitee} que entre?", "Tu invitación no se ha usado todavía.", "Falta que {invitee} entre", "<strong>{invitee}</strong> todavía no acepta la invitación que le mandaste hace {days} días. Si cambió de correo, puedes invitarlo de nuevo.", "Revisar invitación"),
        v("Tu equipo te espera: {invitee} no ha entrado", "Reenvía la invitación en un clic.", "Una invitación sin aceptar", "Hace {days} días invitaste a <strong>{invitee}</strong>. Hasta que acepte, no puede ver ni editar nada de tu negocio.", "Abrir Equipo"),
      ],
    },
    empty_business: {
      eyebrow: "Tu negocio",
      variants: [
        v("{business} todavía no tiene recetas", "Empieza con tu plato más vendido.", "Tu negocio está listo para su primera receta", "Creaste <strong>{business}</strong> hace {days} días, pero todavía no tiene recetas. Carga tu plato más vendido y en unos minutos ves su costo real.", "Agregar una receta"),
        v("¿Seguimos con {business}?", "Una receta y ya ves el costo real.", "Falta poco para tener números", "<strong>{business}</strong> sigue vacío. Si ya tienes recetas en tu Dashboard, puedes pasarlas a este negocio con sus ingredientes.", "Abrir {business}"),
        v("{business} te está esperando", "Tus recetas, costos y menús en un solo lugar.", "Dale vida a {business}", "Hace {days} días creaste <strong>{business}</strong>. Empieza por una receta: es el primer paso para costear todo tu menú.", "Empezar ahora"),
      ],
    },
  },
  en: {
    weekly_summary: {
      eyebrow: "Your week",
      variants: [
        v("Your kitchen this week, in numbers", "Food cost, inventory and alerts at a glance.", "Here's your kitchen this week", "Here's your account summary so you can start the week with clear numbers.", "See my reports"),
        v("What you need to know about your kitchen today", "Your weekly numbers, no spreadsheet needed.", "Your weekly summary", "A quick look at what matters most in your account: costs, inventory and what's worth reviewing.", "Open Gastrometrics"),
        v("Numbers Monday: your weekly summary", "Five figures to decide better this week.", "Start the week with your numbers", "This is what your account says today. If something is in the red, it's a good time to check it.", "Review my kitchen"),
      ],
    },
    low_stock: {
      eyebrow: "Inventory",
      variants: [
        v("{count} items are running out", "Restock before you run out of a dish mid-service.", "Some items are below minimum", "According to your inventory, these items have reached their minimum or gone below it:", "See inventory"),
        v("Before service: check these {count} items", "Your stock is below the minimum you set.", "Your storeroom needs attention", "These items are at or below their minimum. In Gastrometrics you can build the purchase order in a couple of clicks.", "Build purchase order"),
        v("Stock alert: {count} items at minimum", "Don't let a shortage catch you off guard.", "You're running low on these", "So nothing runs out this week, check these items that have reached their minimum:", "Check stock"),
      ],
    },
    margin_alert: {
      eyebrow: "Margin",
      variants: [
        v("{count} dishes no longer make what you think", "Their cost went up and the price stayed the same.", "These dishes are losing margin", "The cost of these dishes is now above the target you costed them with. Maybe an ingredient went up and the price stayed the same:", "Review prices"),
        v("Check the price of these {count} dishes", "Your real food cost is above your target.", "Your margin is shrinking", "At your current ingredient prices, these dishes make less than you planned:", "Adjust my dishes"),
        v("Watch the margin on {count} dishes", "Small differences per dish add up every month.", "Some dishes are worth adjusting", "A small difference per dish, multiplied over a month, is money walking out the door. These drifted furthest from your target:", "See my recipes"),
      ],
    },
    unused_feature: {
      eyebrow: "Your plan",
      variants: [
        v("Your plan includes {feature} and you haven't used it yet", "You already have it: just try it.", "{feature} is waiting for you", "Your {plan} plan includes <strong>{feature}</strong> and you haven't opened it yet. It's one of the biggest time savers in the kitchen.", "Try it now"),
        v("Have you tried {feature}?", "It's included in your {plan} plan.", "Get more out of your plan", "With your {plan} plan you already have <strong>{feature}</strong>. If you're not sure where to start, that section's tutorial walks you through it.", "Open {feature}"),
        v("A feature in your plan that can save you hours", "{feature}, included in {plan}.", "You have it, but haven't used it", "Many owners discover <strong>{feature}</strong> late and wish they'd used it sooner. It's already in your {plan} plan, ready whenever you are.", "See {feature}"),
      ],
    },
    milestone: {
      eyebrow: "Milestone",
      variants: [
        v("You reached {milestone}!", "Every step gives you clearer numbers.", "Congratulations: {milestone}!", "You've reached <strong>{milestone}</strong> in Gastrometrics. Every recipe and count you add makes your costs more real.", "Keep going"),
        v("A milestone for your kitchen: {milestone}", "You're doing great.", "You did it: {milestone}", "We wanted to celebrate with you: you now have <strong>{milestone}</strong>. That's a solid base for pricing with data.", "See my kitchen"),
        v("{milestone}: nice work", "Your kitchen is getting more organized.", "Nice work on {milestone}", "Reaching <strong>{milestone}</strong> is no small thing. Keep it up: with your data up to date, every pricing decision gets easier.", "Open Gastrometrics"),
      ],
    },
    invite_pending: {
      eyebrow: "Team",
      variants: [
        v("{invitee} hasn't accepted your invitation yet", "You sent it {days} days ago.", "Your invitation is still pending", "You invited <strong>{invitee}</strong> to your team {days} days ago and they haven't joined yet. The email may have gone to spam: you can resend it from Team.", "Go to Team"),
        v("Remind {invitee} to join?", "Your invitation hasn't been used yet.", "{invitee} still needs to join", "<strong>{invitee}</strong> hasn't accepted the invitation you sent {days} days ago. If they changed email, you can invite them again.", "Review invitation"),
        v("Your team is waiting: {invitee} hasn't joined", "Resend the invitation in one click.", "An unaccepted invitation", "{days} days ago you invited <strong>{invitee}</strong>. Until they accept, they can't see or edit anything in your business.", "Open Team"),
      ],
    },
    empty_business: {
      eyebrow: "Your business",
      variants: [
        v("{business} doesn't have any recipes yet", "Start with your best-selling dish.", "Your business is ready for its first recipe", "You created <strong>{business}</strong> {days} days ago, but it has no recipes yet. Add your best-selling dish and see its real cost in minutes.", "Add a recipe"),
        v("Shall we continue with {business}?", "One recipe and you'll see the real cost.", "You're close to having numbers", "<strong>{business}</strong> is still empty. If you already have recipes in your Dashboard, you can move them to this business with their ingredients.", "Open {business}"),
        v("{business} is waiting for you", "Your recipes, costs and menus in one place.", "Bring {business} to life", "{days} days ago you created <strong>{business}</strong>. Start with one recipe: it's the first step to costing your whole menu.", "Start now"),
      ],
    },
  },
  da: {
    weekly_summary: {
      eyebrow: "Din uge",
      variants: [
        v("Dit køkken denne uge i tal", "Food cost, lager og advarsler på ét blik.", "Sådan står dit køkken denne uge", "Her er din kontooversigt, så du kan starte ugen med klare tal.", "Se mine rapporter"),
        v("Det du skal vide om dit køkken i dag", "Ugens tal uden regneark.", "Din ugentlige oversigt", "Et hurtigt kig på det vigtigste i din konto: omkostninger, lager og det, der er værd at tjekke.", "Åbn Gastrometrics"),
        v("Tal-mandag: din ugentlige oversigt", "Fem tal til bedre beslutninger denne uge.", "Start ugen med dine tal", "Sådan ser din konto ud i dag. Er noget i rødt, er det et godt tidspunkt at tjekke det.", "Tjek mit køkken"),
      ],
    },
    low_stock: {
      eyebrow: "Lager",
      variants: [
        v("{count} varer er ved at slippe op", "Fyld op, før en ret slipper op midt i servicen.", "Nogle varer er under minimum", "Ifølge dit lager har disse varer nået deres minimum eller er under det:", "Se lager"),
        v("Før servicen: tjek disse {count} varer", "Din beholdning er under det minimum, du har sat.", "Dit lager kræver opmærksomhed", "Disse varer er på eller under minimum. I Gastrometrics kan du lave indkøbsordren med et par klik.", "Lav indkøbsordre"),
        v("Lageradvarsel: {count} varer på minimum", "Lad ikke en mangel overraske dig.", "Disse varer er ved at slippe op", "Så intet slipper op denne uge, tjek disse varer, der har nået deres minimum:", "Tjek lager"),
      ],
    },
    margin_alert: {
      eyebrow: "Margin",
      variants: [
        v("{count} retter giver ikke længere det, du tror", "Kostprisen steg, og prisen blev den samme.", "Disse retter mister margin", "Kostprisen på disse retter ligger nu over det mål, du kalkulerede med. Måske steg en ingrediens, og prisen blev den samme:", "Tjek priser"),
        v("Tjek prisen på disse {count} retter", "Din reelle food cost er over dit mål.", "Din margin bliver mindre", "Med dine nuværende ingredienspriser giver disse retter mindre, end du planlagde:", "Justér mine retter"),
        v("Hold øje med marginen på {count} retter", "Små forskelle pr. ret bliver til meget om måneden.", "Nogle retter bør justeres", "En lille forskel pr. ret, ganget med en hel måned, er penge, der forsvinder. Disse er gledet længst fra dit mål:", "Se mine opskrifter"),
      ],
    },
    unused_feature: {
      eyebrow: "Din plan",
      variants: [
        v("Din plan omfatter {feature}, og du har ikke brugt det endnu", "Du har det allerede: prøv det.", "{feature} venter på dig", "Din {plan}-plan omfatter <strong>{feature}</strong>, og du har ikke åbnet det endnu. Det er en af de største tidsbesparelser i køkkenet.", "Prøv det nu"),
        v("Har du prøvet {feature}?", "Det er inkluderet i din {plan}-plan.", "Få mere ud af din plan", "Med din {plan}-plan har du allerede <strong>{feature}</strong>. Er du i tvivl om, hvor du skal starte, guider sektionens vejledning dig.", "Åbn {feature}"),
        v("En funktion i din plan, der kan spare dig timer", "{feature}, inkluderet i {plan}.", "Du har det, men har ikke brugt det", "Mange ejere opdager <strong>{feature}</strong> sent og ville ønske, de havde brugt det før. Det er allerede i din {plan}-plan, klar når du er.", "Se {feature}"),
      ],
    },
    milestone: {
      eyebrow: "Milepæl",
      variants: [
        v("Du har nået {milestone}!", "Hvert skridt giver dig klarere tal.", "Tillykke: {milestone}!", "Du har nået <strong>{milestone}</strong> i Gastrometrics. Hver opskrift og optælling gør dine omkostninger mere virkelige.", "Fortsæt"),
        v("En milepæl for dit køkken: {milestone}", "Det går rigtig godt.", "Du klarede det: {milestone}", "Vi ville fejre det med dig: du har nu <strong>{milestone}</strong>. Det er et solidt grundlag for at sætte priser med data.", "Se mit køkken"),
        v("{milestone}: godt arbejde", "Dit køkken bliver mere og mere organiseret.", "Godt arbejde med {milestone}", "At nå <strong>{milestone}</strong> er ikke småting. Fortsæt sådan: med opdaterede data bliver hver prisbeslutning lettere.", "Åbn Gastrometrics"),
      ],
    },
    invite_pending: {
      eyebrow: "Team",
      variants: [
        v("{invitee} har ikke accepteret din invitation endnu", "Du sendte den for {days} dage siden.", "Din invitation venter stadig", "Du inviterede <strong>{invitee}</strong> til dit team for {days} dage siden, og vedkommende er ikke kommet ind endnu. Måske er mailen havnet i spam: du kan sende den igen fra Team.", "Gå til Team"),
        v("Skal vi minde {invitee} om at logge ind?", "Din invitation er ikke brugt endnu.", "{invitee} mangler at logge ind", "<strong>{invitee}</strong> har ikke accepteret invitationen, du sendte for {days} dage siden. Har vedkommende skiftet e-mail, kan du invitere igen.", "Se invitation"),
        v("Dit team venter: {invitee} er ikke logget ind", "Send invitationen igen med ét klik.", "En invitation uden svar", "For {days} dage siden inviterede du <strong>{invitee}</strong>. Indtil invitationen accepteres, kan vedkommende ikke se eller redigere noget i din virksomhed.", "Åbn Team"),
      ],
    },
    empty_business: {
      eyebrow: "Din virksomhed",
      variants: [
        v("{business} har endnu ingen opskrifter", "Start med din bedst sælgende ret.", "Din virksomhed er klar til sin første opskrift", "Du oprettede <strong>{business}</strong> for {days} dage siden, men den har endnu ingen opskrifter. Tilføj din bedst sælgende ret og se den reelle kostpris på få minutter.", "Tilføj en opskrift"),
        v("Skal vi fortsætte med {business}?", "Én opskrift, og du ser den reelle kostpris.", "Du er tæt på at have tal", "<strong>{business}</strong> er stadig tom. Har du allerede opskrifter i dit Dashboard, kan du flytte dem til denne virksomhed med ingredienser.", "Åbn {business}"),
        v("{business} venter på dig", "Opskrifter, omkostninger og menuer samlet.", "Giv liv til {business}", "For {days} dage siden oprettede du <strong>{business}</strong>. Start med én opskrift: det er første skridt til at kalkulere hele din menu.", "Start nu"),
      ],
    },
  },
  fr: {
    weekly_summary: {
      eyebrow: "Votre semaine",
      variants: [
        v("Votre cuisine cette semaine, en chiffres", "Food cost, stock et alertes en un coup d'œil.", "Voici votre cuisine cette semaine", "Voici le résumé de votre compte pour commencer la semaine avec des chiffres clairs.", "Voir mes rapports"),
        v("Ce qu'il faut savoir sur votre cuisine aujourd'hui", "Vos chiffres de la semaine, sans tableur.", "Votre résumé hebdomadaire", "Un aperçu rapide de l'essentiel de votre compte : coûts, stock et ce qui mérite d'être vérifié.", "Ouvrir Gastrometrics"),
        v("Lundi des chiffres : votre résumé hebdomadaire", "Cinq chiffres pour mieux décider cette semaine.", "Commencez la semaine avec vos chiffres", "Voici ce que dit votre compte aujourd'hui. Si quelque chose est dans le rouge, c'est le bon moment pour le vérifier.", "Vérifier ma cuisine"),
      ],
    },
    low_stock: {
      eyebrow: "Stock",
      variants: [
        v("{count} produits sont presque épuisés", "Réapprovisionnez avant de manquer d'un plat en plein service.", "Des produits sont sous leur minimum", "D'après votre stock, ces produits ont atteint leur minimum ou sont en dessous :", "Voir le stock"),
        v("Avant le service : vérifiez ces {count} produits", "Votre stock est sous le minimum que vous avez fixé.", "Votre réserve a besoin d'attention", "Ces produits sont à leur minimum ou en dessous. Dans Gastrometrics, vous pouvez préparer le bon de commande en quelques clics.", "Préparer la commande"),
        v("Alerte stock : {count} produits au minimum", "Ne vous laissez pas surprendre par une rupture.", "Ces produits arrivent à leur fin", "Pour ne manquer de rien cette semaine, vérifiez ces produits qui ont atteint leur minimum :", "Vérifier le stock"),
      ],
    },
    margin_alert: {
      eyebrow: "Marge",
      variants: [
        v("{count} plats ne rapportent plus ce que vous pensez", "Leur coût a augmenté et le prix est resté le même.", "Ces plats perdent de la marge", "Le coût de ces plats dépasse désormais l'objectif avec lequel vous les avez chiffrés. Un ingrédient a peut-être augmenté sans que le prix change :", "Vérifier les prix"),
        v("Vérifiez le prix de ces {count} plats", "Votre food cost réel dépasse votre objectif.", "Votre marge se réduit", "Aux prix actuels de vos ingrédients, ces plats rapportent moins que prévu :", "Ajuster mes plats"),
        v("Attention à la marge de {count} plats", "De petits écarts par plat font beaucoup sur un mois.", "Certains plats méritent un ajustement", "Un petit écart par plat, multiplié sur tout le mois, c'est de l'argent qui part. Voici ceux qui se sont le plus éloignés de votre objectif :", "Voir mes recettes"),
      ],
    },
    unused_feature: {
      eyebrow: "Votre forfait",
      variants: [
        v("Votre forfait inclut {feature} et vous ne l'utilisez pas encore", "Vous l'avez déjà : il suffit d'essayer.", "{feature} vous attend", "Votre forfait {plan} inclut <strong>{feature}</strong> et vous ne l'avez pas encore ouvert. C'est l'un des plus grands gains de temps en cuisine.", "L'essayer maintenant"),
        v("Avez-vous essayé {feature} ?", "C'est inclus dans votre forfait {plan}.", "Tirez davantage de votre forfait", "Avec votre forfait {plan}, vous avez déjà <strong>{feature}</strong>. Si vous ne savez pas par où commencer, le tutoriel de cette section vous guide pas à pas.", "Ouvrir {feature}"),
        v("Une fonction de votre forfait qui peut vous faire gagner des heures", "{feature}, inclus dans {plan}.", "Vous l'avez, mais ne l'avez pas utilisé", "Beaucoup de patrons découvrent <strong>{feature}</strong> tard et regrettent de ne pas l'avoir utilisé plus tôt. C'est déjà dans votre forfait {plan}, prêt quand vous voulez.", "Voir {feature}"),
      ],
    },
    milestone: {
      eyebrow: "Étape",
      variants: [
        v("Vous avez atteint {milestone} !", "Chaque étape rend vos chiffres plus clairs.", "Félicitations : {milestone} !", "Vous avez atteint <strong>{milestone}</strong> dans Gastrometrics. Chaque recette et chaque inventaire rendent vos coûts plus réels.", "Continuer"),
        v("Une étape pour votre cuisine : {milestone}", "Vous êtes sur la bonne voie.", "Vous l'avez fait : {milestone}", "Nous voulions le fêter avec vous : vous avez maintenant <strong>{milestone}</strong>. C'est une base solide pour fixer vos prix avec des données.", "Voir ma cuisine"),
        v("{milestone} : beau travail", "Votre cuisine est de plus en plus organisée.", "Beau travail pour {milestone}", "Atteindre <strong>{milestone}</strong>, ce n'est pas rien. Continuez : avec des données à jour, chaque décision de prix devient plus simple.", "Ouvrir Gastrometrics"),
      ],
    },
    invite_pending: {
      eyebrow: "Équipe",
      variants: [
        v("{invitee} n'a pas encore accepté votre invitation", "Vous l'avez envoyée il y a {days} jours.", "Votre invitation est toujours en attente", "Vous avez invité <strong>{invitee}</strong> dans votre équipe il y a {days} jours et cette personne n'est pas encore entrée. L'e-mail est peut-être dans les spams : vous pouvez le renvoyer depuis Équipe.", "Aller à Équipe"),
        v("Rappeler à {invitee} de se connecter ?", "Votre invitation n'a pas encore été utilisée.", "{invitee} doit encore se connecter", "<strong>{invitee}</strong> n'a pas accepté l'invitation envoyée il y a {days} jours. Si l'adresse a changé, vous pouvez l'inviter à nouveau.", "Voir l'invitation"),
        v("Votre équipe attend : {invitee} n'est pas entré", "Renvoyez l'invitation en un clic.", "Une invitation sans réponse", "Il y a {days} jours, vous avez invité <strong>{invitee}</strong>. Tant que l'invitation n'est pas acceptée, cette personne ne peut rien voir ni modifier.", "Ouvrir Équipe"),
      ],
    },
    empty_business: {
      eyebrow: "Votre entreprise",
      variants: [
        v("{business} n'a encore aucune recette", "Commencez par votre plat le plus vendu.", "Votre entreprise est prête pour sa première recette", "Vous avez créé <strong>{business}</strong> il y a {days} jours, mais elle n'a encore aucune recette. Ajoutez votre plat le plus vendu et voyez son coût réel en quelques minutes.", "Ajouter une recette"),
        v("On continue avec {business} ?", "Une recette et vous voyez le coût réel.", "Vous êtes près d'avoir vos chiffres", "<strong>{business}</strong> est toujours vide. Si vous avez déjà des recettes dans votre Dashboard, vous pouvez les déplacer vers cette entreprise avec leurs ingrédients.", "Ouvrir {business}"),
        v("{business} vous attend", "Recettes, coûts et menus au même endroit.", "Donnez vie à {business}", "Il y a {days} jours, vous avez créé <strong>{business}</strong>. Commencez par une recette : c'est la première étape pour chiffrer tout votre menu.", "Commencer"),
      ],
    },
  },
  pt: {
    weekly_summary: {
      eyebrow: "Sua semana",
      variants: [
        v("Sua cozinha nesta semana, em números", "Food cost, estoque e alertas num relance.", "Assim está sua cozinha nesta semana", "Aqui está o resumo da sua conta para começar a semana com os números claros.", "Ver meus relatórios"),
        v("O que você precisa saber da sua cozinha hoje", "Seus números da semana, sem planilha.", "Seu resumo semanal", "Uma olhada rápida no mais importante da sua conta: custos, estoque e o que vale revisar.", "Abrir a Gastrometrics"),
        v("Segunda dos números: seu resumo semanal", "Cinco dados para decidir melhor nesta semana.", "Comece a semana com seus números", "É isto que sua conta diz hoje. Se algo estiver no vermelho, é um bom momento para revisar.", "Revisar minha cozinha"),
      ],
    },
    low_stock: {
      eyebrow: "Estoque",
      variants: [
        v("{count} produtos estão acabando", "Reponha antes de ficar sem um prato em pleno serviço.", "Há produtos abaixo do mínimo", "Segundo seu estoque, estes produtos chegaram ao mínimo ou estão abaixo dele:", "Ver estoque"),
        v("Antes do serviço: confira estes {count} produtos", "Seu estoque está abaixo do mínimo que você definiu.", "Seu estoque precisa de atenção", "Estes produtos estão no mínimo ou abaixo. Na Gastrometrics você monta o pedido de compra em poucos cliques.", "Montar pedido de compra"),
        v("Alerta de estoque: {count} produtos no mínimo", "Não seja pego de surpresa por uma falta.", "Estes produtos estão acabando", "Para não faltar nada nesta semana, confira estes produtos que já chegaram ao mínimo:", "Conferir estoque"),
      ],
    },
    margin_alert: {
      eyebrow: "Margem",
      variants: [
        v("{count} pratos já não deixam o que você imagina", "O custo subiu e o preço ficou igual.", "Estes pratos estão perdendo margem", "O custo destes pratos já passa da meta com que você os custeou. Talvez algum insumo tenha subido e o preço ficou igual:", "Revisar preços"),
        v("Revise o preço destes {count} pratos", "Seu food cost real está acima da meta.", "Sua margem está diminuindo", "Com os preços atuais dos seus ingredientes, estes pratos deixam menos do que você planejou:", "Ajustar meus pratos"),
        v("Atenção à margem de {count} pratos", "Pequenas diferenças por prato viram muito no mês.", "Há pratos que vale ajustar", "Uma diferença pequena por prato, multiplicada pelo mês inteiro, é dinheiro que vai embora. Estes são os que mais se afastaram da sua meta:", "Ver minhas receitas"),
      ],
    },
    unused_feature: {
      eyebrow: "Seu plano",
      variants: [
        v("Seu plano inclui {feature} e você ainda não usa", "Você já tem: só falta experimentar.", "{feature} está te esperando", "Seu plano {plan} inclui <strong>{feature}</strong> e você ainda não abriu. É uma das partes que mais economizam tempo na cozinha.", "Experimentar agora"),
        v("Já experimentou {feature}?", "Está incluído no seu plano {plan}.", "Aproveite mais o seu plano", "Com o plano {plan} você já tem <strong>{feature}</strong>. Se não sabe por onde começar, o tutorial dessa seção te guia passo a passo.", "Abrir {feature}"),
        v("Uma função do seu plano que pode te poupar horas", "{feature}, incluído no {plan}.", "Você tem, mas ainda não usou", "Muitos donos descobrem <strong>{feature}</strong> tarde e queriam ter usado antes. Já está no seu plano {plan}, pronto quando quiser.", "Ver {feature}"),
      ],
    },
    milestone: {
      eyebrow: "Conquista",
      variants: [
        v("Você chegou a {milestone}!", "Cada passo deixa seus números mais claros.", "Parabéns: {milestone}!", "Você alcançou <strong>{milestone}</strong> na Gastrometrics. Cada receita e contagem que você registra deixa seus custos mais reais.", "Continuar avançando"),
        v("Uma conquista para sua cozinha: {milestone}", "Você está indo muito bem.", "Você conseguiu: {milestone}", "Queríamos comemorar com você: agora você tem <strong>{milestone}</strong>. Essa já é uma base sólida para definir preços com dados.", "Ver minha cozinha"),
        v("{milestone}: bom trabalho", "Sua cozinha está cada vez mais organizada.", "Bom trabalho com {milestone}", "Chegar a <strong>{milestone}</strong> não é pouca coisa. Continue assim: com seus dados em dia, cada decisão de preço fica mais fácil.", "Abrir a Gastrometrics"),
      ],
    },
    invite_pending: {
      eyebrow: "Equipe",
      variants: [
        v("{invitee} ainda não aceitou seu convite", "Você enviou há {days} dias.", "Seu convite continua pendente", "Você convidou <strong>{invitee}</strong> para sua equipe há {days} dias e a pessoa ainda não entrou. Talvez o e-mail tenha ido para o spam: você pode reenviar em Equipe.", "Ir para Equipe"),
        v("Lembrar {invitee} de entrar?", "Seu convite ainda não foi usado.", "Falta {invitee} entrar", "<strong>{invitee}</strong> ainda não aceitou o convite que você enviou há {days} dias. Se mudou de e-mail, você pode convidar de novo.", "Revisar convite"),
        v("Sua equipe te espera: {invitee} não entrou", "Reenvie o convite com um clique.", "Um convite sem resposta", "Há {days} dias você convidou <strong>{invitee}</strong>. Enquanto não aceitar, a pessoa não pode ver nem editar nada do seu negócio.", "Abrir Equipe"),
      ],
    },
    empty_business: {
      eyebrow: "Seu negócio",
      variants: [
        v("{business} ainda não tem receitas", "Comece pelo seu prato mais vendido.", "Seu negócio está pronto para a primeira receita", "Você criou <strong>{business}</strong> há {days} dias, mas ele ainda não tem receitas. Cadastre seu prato mais vendido e veja o custo real em poucos minutos.", "Adicionar uma receita"),
        v("Vamos continuar com {business}?", "Uma receita e você já vê o custo real.", "Falta pouco para ter números", "<strong>{business}</strong> continua vazio. Se você já tem receitas no Dashboard, pode passá-las para este negócio com os ingredientes.", "Abrir {business}"),
        v("{business} está te esperando", "Receitas, custos e cardápios num só lugar.", "Dê vida a {business}", "Há {days} dias você criou <strong>{business}</strong>. Comece por uma receita: é o primeiro passo para custear todo o seu cardápio.", "Começar agora"),
      ],
    },
  },
  zh: {
    weekly_summary: {
      eyebrow: "本周",
      variants: [
        v("本周你的厨房数据一览", "食材成本率、库存和提醒，一目了然。", "这是你本周的厨房状况", "这是你的账户摘要，帮你用清晰的数字开始新的一周。", "查看我的报表"),
        v("今天你需要了解的厨房情况", "本周数字，无需电子表格。", "你的每周摘要", "快速了解账户中最重要的内容：成本、库存以及值得检查的地方。", "打开 Gastrometrics"),
        v("周一看数字：你的每周摘要", "五个数字，帮你本周做出更好的决定。", "用数字开启新的一周", "这是你的账户今天的情况。如果有标红的项目，现在正是检查的好时机。", "检查我的厨房"),
      ],
    },
    low_stock: {
      eyebrow: "库存",
      variants: [
        v("{count} 种产品快用完了", "在出餐高峰缺货之前及时补货。", "有产品低于最低库存", "根据你的库存，以下产品已达到或低于最低库存：", "查看库存"),
        v("出餐前：检查这 {count} 种产品", "你的库存低于设定的最低值。", "你的库房需要关注", "以下产品处于或低于最低库存。在 Gastrometrics 中只需几次点击即可生成采购单。", "生成采购单"),
        v("库存提醒：{count} 种产品已到最低值", "别让缺货打你个措手不及。", "这些产品快用完了", "为了本周不缺货，请检查以下已达到最低库存的产品：", "检查库存"),
      ],
    },
    margin_alert: {
      eyebrow: "毛利",
      variants: [
        v("{count} 道菜赚得没有你想的多", "成本上涨了，价格却没变。", "这些菜品的毛利正在流失", "这些菜品的成本已超过你核算时设定的目标。可能某种原料涨价了，而售价没变：", "检查价格"),
        v("请检查这 {count} 道菜的价格", "你的实际食材成本率高于目标。", "你的毛利在缩小", "按照当前原料价格，这些菜品赚得比你计划的少：", "调整我的菜品"),
        v("注意 {count} 道菜的毛利", "每道菜的小差距，一个月就是一大笔。", "有些菜品值得调整", "每道菜的小差距乘以整个月，就是流失的钱。以下是偏离目标最多的菜品：", "查看我的配方"),
      ],
    },
    unused_feature: {
      eyebrow: "你的方案",
      variants: [
        v("你的方案包含{feature}，但你还没用过", "你已经拥有它，只差试一试。", "{feature}在等你", "你的 {plan} 方案包含<strong>{feature}</strong>，但你还没打开过。它是厨房里最省时间的功能之一。", "立即试用"),
        v("你试过{feature}了吗？", "它已包含在你的 {plan} 方案中。", "充分利用你的方案", "使用 {plan} 方案，你已经拥有<strong>{feature}</strong>。如果不知道从哪里开始，该部分的教程会一步步引导你。", "打开{feature}"),
        v("你方案中能为你节省数小时的功能", "{feature}，已包含在 {plan} 中。", "你拥有它，但还没用过", "很多老板很晚才发现<strong>{feature}</strong>，希望早点用上。它已经在你的 {plan} 方案中，随时可用。", "查看{feature}"),
      ],
    },
    milestone: {
      eyebrow: "里程碑",
      variants: [
        v("你达成了{milestone}！", "每一步都让你的数字更清晰。", "恭喜：{milestone}！", "你已在 Gastrometrics 中达成<strong>{milestone}</strong>。你录入的每个配方和每次盘点都让成本更真实。", "继续前进"),
        v("你厨房的一个里程碑：{milestone}", "你做得很好。", "你做到了：{milestone}", "我们想和你一起庆祝：你现在已经拥有<strong>{milestone}</strong>。这是用数据定价的坚实基础。", "查看我的厨房"),
        v("{milestone}：干得好", "你的厨房越来越有条理了。", "{milestone}，干得好", "达成<strong>{milestone}</strong>可不简单。继续保持：数据保持最新，每个定价决定都会更容易。", "打开 Gastrometrics"),
      ],
    },
    invite_pending: {
      eyebrow: "团队",
      variants: [
        v("{invitee} 还没有接受你的邀请", "你在 {days} 天前发出了邀请。", "你的邀请仍在等待中", "你在 {days} 天前邀请了<strong>{invitee}</strong>加入团队，但对方还没有进入。邮件可能进了垃圾箱：你可以在“团队”中重新发送。", "前往团队"),
        v("提醒 {invitee} 登录？", "你的邀请还没有被使用。", "还差 {invitee} 加入", "<strong>{invitee}</strong> 还没有接受你在 {days} 天前发出的邀请。如果对方换了邮箱，你可以重新邀请。", "查看邀请"),
        v("你的团队在等待：{invitee} 还没加入", "一键重新发送邀请。", "一个未被接受的邀请", "{days} 天前你邀请了<strong>{invitee}</strong>。在接受邀请之前，对方无法查看或编辑你商户中的任何内容。", "打开团队"),
      ],
    },
    empty_business: {
      eyebrow: "你的商户",
      variants: [
        v("{business} 还没有配方", "从你最畅销的菜开始。", "你的商户已准备好迎接第一个配方", "你在 {days} 天前创建了<strong>{business}</strong>，但它还没有配方。添加你最畅销的菜，几分钟内就能看到真实成本。", "添加配方"),
        v("继续完善 {business} 吗？", "一个配方就能看到真实成本。", "离拥有数据只差一步", "<strong>{business}</strong> 仍然是空的。如果你的仪表板中已有配方，可以连同原料一起迁移到这个商户。", "打开 {business}"),
        v("{business} 在等你", "配方、成本和菜单集中在一处。", "让 {business} 动起来", "{days} 天前你创建了<strong>{business}</strong>。从一个配方开始：这是核算整份菜单成本的第一步。", "立即开始"),
      ],
    },
  },
}
