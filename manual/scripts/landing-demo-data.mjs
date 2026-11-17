/**
 * Restaurante de demostración para las capturas de la landing (docs/193). Solo vive en el
 * navegador de Puppeteer: scripts/landing-media.mjs lo sirve como si viniera de la base de
 * datos y nunca se escribe en ningún lado. Mismos formatos que lib/services/seed-example-
 * recipe.ts y lib/landing-demo-carryover.ts (filas de Supabase con el objeto en `data`).
 */

// Ingredientes: [clave, categoría, unidad, precio de compra en L, contenido neto, nombres por idioma]
const INGREDIENTS = [
  ["chicken", "AVES", "kilogramos", 135, 1, { es: "Pechuga de pollo", en: "Chicken breast", da: "Kyllingebryst", fr: "Blanc de poulet", pt: "Peito de frango", zh: "鸡胸肉" }],
  ["beef", "RES", "kilogramos", 260, 1, { es: "Carne molida de res", en: "Ground beef", da: "Hakket oksekød", fr: "Bœuf haché", pt: "Carne moída", zh: "牛肉末" }],
  ["pasta", "FIDEOS", "kilogramos", 58, 1, { es: "Pasta fettuccine", en: "Fettuccine pasta", da: "Fettuccine", fr: "Fettuccine", pt: "Massa fettuccine", zh: "意大利宽面" }],
  ["cream", "LÁCTEOS Y DERIVADOS", "litros", 96, 1, { es: "Crema de leche", en: "Heavy cream", da: "Piskefløde", fr: "Crème liquide", pt: "Creme de leite", zh: "淡奶油" }],
  ["parmesan", "LÁCTEOS Y DERIVADOS", "kilogramos", 620, 1, { es: "Queso parmesano", en: "Parmesan cheese", da: "Parmesan", fr: "Parmesan", pt: "Queijo parmesão", zh: "帕玛森芝士" }],
  ["butter", "LÁCTEOS Y DERIVADOS", "kilogramos", 210, 1, { es: "Mantequilla", en: "Butter", da: "Smør", fr: "Beurre", pt: "Manteiga", zh: "黄油" }],
  ["tomato", "VEGETAL", "kilogramos", 32, 1, { es: "Tomate", en: "Tomato", da: "Tomat", fr: "Tomate", pt: "Tomate", zh: "番茄" }],
  ["lettuce", "VEGETAL", "unidad", 28, 1, { es: "Lechuga romana", en: "Romaine lettuce", da: "Romainesalat", fr: "Laitue romaine", pt: "Alface romana", zh: "罗马生菜" }],
  ["onion", "VEGETAL", "kilogramos", 26, 1, { es: "Cebolla", en: "Onion", da: "Løg", fr: "Oignon", pt: "Cebola", zh: "洋葱" }],
  ["garlic", "VEGETAL", "kilogramos", 120, 1, { es: "Ajo", en: "Garlic", da: "Hvidløg", fr: "Ail", pt: "Alho", zh: "大蒜" }],
  ["zucchini", "VEGETAL", "kilogramos", 38, 1, { es: "Zucchini", en: "Zucchini", da: "Squash", fr: "Courgette", pt: "Abobrinha", zh: "西葫芦" }],
  ["bun", "HARINA", "unidad", 54, 6, { es: "Pan de hamburguesa", en: "Burger bun", da: "Burgerbolle", fr: "Pain burger", pt: "Pão de hambúrguer", zh: "汉堡面包" }],
  ["cheddar", "LÁCTEOS Y DERIVADOS", "unidad", 95, 12, { es: "Queso cheddar en lonchas", en: "Sliced cheddar", da: "Cheddar i skiver", fr: "Cheddar en tranches", pt: "Cheddar fatiado", zh: "切达芝士片" }],
  ["oil", "ACEITES", "litros", 72, 1, { es: "Aceite de oliva", en: "Olive oil", da: "Olivenolie", fr: "Huile d'olive", pt: "Azeite", zh: "橄榄油" }],
  ["lemon", "FRUTA", "kilogramos", 30, 1, { es: "Limón", en: "Lime", da: "Lime", fr: "Citron vert", pt: "Limão", zh: "青柠" }],
  ["mint", "HIERBAS", "unidad", 15, 1, { es: "Hierbabuena (manojo)", en: "Mint (bunch)", da: "Mynte (bundt)", fr: "Menthe (botte)", pt: "Hortelã (maço)", zh: "薄荷（一把）" }],
  ["sugar", "DULCE", "kilogramos", 24, 1, { es: "Azúcar", en: "Sugar", da: "Sukker", fr: "Sucre", pt: "Açúcar", zh: "白糖" }],
  ["bread", "HARINA", "kilogramos", 70, 1, { es: "Pan para crutones", en: "Bread for croutons", da: "Brød til croutoner", fr: "Pain pour croûtons", pt: "Pão para croutons", zh: "面包丁用面包" }],
  ["salt", "SAL", "kilogramos", 12, 1, { es: "Sal", en: "Salt", da: "Salt", fr: "Sel", pt: "Sal", zh: "盐" }],
  ["potato", "VEGETAL", "kilogramos", 28, 1, { es: "Papa", en: "Potato", da: "Kartoffel", fr: "Pomme de terre", pt: "Batata", zh: "土豆" }],
]

// Recetas: [clave, clasificación, paso, porciones, líneas [ingrediente, cantidad en su unidad], nombres, pasos]
const RECIPES = [
  [
    "grilled-chicken", "Carnes y asados (Rôtisseur)", "Plato fuerte", 1,
    [["chicken", 0.22], ["zucchini", 0.12], ["potato", 0.18], ["oil", 0.015], ["garlic", 0.005], ["salt", 0.003]],
    { es: "Pollo a la plancha con vegetales", en: "Grilled chicken with vegetables", da: "Grillet kylling med grøntsager", fr: "Poulet grillé et légumes", pt: "Frango grelhado com legumes", zh: "香煎鸡胸配时蔬" },
    {
      es: ["Sazonar la pechuga con sal y ajo.", "Cocinar a la plancha 6 minutos por lado.", "Saltear el zucchini y servir con papas asadas."],
      en: ["Season the chicken with salt and garlic.", "Grill 6 minutes per side.", "Sauté the zucchini and serve with roasted potatoes."],
      da: ["Krydr kyllingen med salt og hvidløg.", "Grill 6 minutter på hver side.", "Steg squashen og server med ovnkartofler."],
      fr: ["Assaisonner le poulet avec sel et ail.", "Griller 6 minutes de chaque côté.", "Faire sauter la courgette et servir avec des pommes de terre rôties."],
      pt: ["Tempere o frango com sal e alho.", "Grelhe 6 minutos de cada lado.", "Salteie a abobrinha e sirva com batatas assadas."],
      zh: ["鸡胸用盐和蒜调味。", "每面煎 6 分钟。", "炒西葫芦，配烤土豆上桌。"],
    },
  ],
  [
    "alfredo", "Línea caliente (Cuisine chaude)", "Pasta", 1,
    [["pasta", 0.12], ["cream", 0.12], ["parmesan", 0.03], ["butter", 0.02], ["garlic", 0.004], ["salt", 0.002]],
    { es: "Fettuccine Alfredo", en: "Fettuccine Alfredo", da: "Fettuccine Alfredo", fr: "Fettuccine Alfredo", pt: "Fettuccine Alfredo", zh: "阿尔弗雷多宽面" },
    {
      es: ["Cocinar la pasta al dente.", "Reducir la crema con mantequilla y ajo.", "Mezclar con parmesano y servir."],
      en: ["Cook the pasta al dente.", "Reduce the cream with butter and garlic.", "Toss with parmesan and serve."],
      da: ["Kog pastaen al dente.", "Reducer fløden med smør og hvidløg.", "Vend med parmesan og server."],
      fr: ["Cuire les pâtes al dente.", "Réduire la crème avec le beurre et l'ail.", "Mélanger au parmesan et servir."],
      pt: ["Cozinhe a massa al dente.", "Reduza o creme com manteiga e alho.", "Misture o parmesão e sirva."],
      zh: ["意面煮至弹牙。", "奶油加黄油和蒜收汁。", "拌入帕玛森芝士后上桌。"],
    },
  ],
  [
    "burger", "Parrilla (Grillardin)", "Plato fuerte", 1,
    [["beef", 0.16], ["bun", 1], ["cheddar", 1], ["tomato", 0.04], ["lettuce", 0.08], ["onion", 0.02], ["potato", 0.2], ["oil", 0.03]],
    { es: "Hamburguesa clásica con papas", en: "Classic burger with fries", da: "Klassisk burger med pommes frites", fr: "Burger classique et frites", pt: "Hambúrguer clássico com fritas", zh: "经典汉堡配薯条" },
    {
      es: ["Formar la carne de 160 g y asar al punto.", "Fundir el cheddar y armar con vegetales.", "Servir con papas fritas."],
      en: ["Shape a 160 g patty and grill to taste.", "Melt the cheddar and build with vegetables.", "Serve with fries."],
      da: ["Form en bøf på 160 g og grill den.", "Smelt cheddaren og byg burgeren med grønt.", "Server med pommes frites."],
      fr: ["Former un steak de 160 g et le griller.", "Faire fondre le cheddar et monter avec les légumes.", "Servir avec des frites."],
      pt: ["Modele um hambúrguer de 160 g e grelhe.", "Derreta o cheddar e monte com os legumes.", "Sirva com batatas fritas."],
      zh: ["做成 160 克肉饼并煎至所需熟度。", "融化切达芝士，夹入蔬菜。", "配薯条上桌。"],
    },
  ],
  [
    "caesar", "Línea fría (Garde-manger / Cuisine froide)", "Entrada", 1,
    [["lettuce", 0.5], ["chicken", 0.1], ["parmesan", 0.02], ["bread", 0.04], ["oil", 0.02], ["lemon", 0.02], ["garlic", 0.003]],
    { es: "Ensalada César con pollo", en: "Chicken Caesar salad", da: "Cæsarsalat med kylling", fr: "Salade César au poulet", pt: "Salada Caesar com frango", zh: "鸡肉凯撒沙拉" },
    {
      es: ["Lavar y cortar la lechuga.", "Tostar los crutones con ajo.", "Mezclar con aderezo, pollo y parmesano."],
      en: ["Wash and cut the lettuce.", "Toast the croutons with garlic.", "Toss with dressing, chicken and parmesan."],
      da: ["Skyl og skær salaten.", "Rist croutonerne med hvidløg.", "Vend med dressing, kylling og parmesan."],
      fr: ["Laver et couper la laitue.", "Griller les croûtons à l'ail.", "Mélanger avec la sauce, le poulet et le parmesan."],
      pt: ["Lave e corte a alface.", "Toste os croutons com alho.", "Misture com molho, frango e parmesão."],
      zh: ["生菜洗净切块。", "面包丁加蒜烤香。", "拌入酱汁、鸡肉和帕玛森芝士。"],
    },
  ],
  [
    "lemonade", "Barra - Sin alcohol (Bar)", "Bebidas sin alcohol", 1,
    [["lemon", 0.08], ["mint", 0.15], ["sugar", 0.03]],
    { es: "Limonada con hierbabuena", en: "Mint limeade", da: "Limonade med mynte", fr: "Citronnade à la menthe", pt: "Limonada com hortelã", zh: "薄荷青柠水" },
    {
      es: ["Exprimir los limones.", "Licuar con hierbabuena, azúcar y hielo."],
      en: ["Squeeze the limes.", "Blend with mint, sugar and ice."],
      da: ["Pres limefrugterne.", "Blend med mynte, sukker og is."],
      fr: ["Presser les citrons verts.", "Mixer avec la menthe, le sucre et la glace."],
      pt: ["Esprema os limões.", "Bata com hortelã, açúcar e gelo."],
      zh: ["榨青柠汁。", "加薄荷、糖和冰块打匀。"],
    },
  ],
  [
    "tomato-soup", "Salsas y fondos (Saucier)", "Sopa", 4,
    [["tomato", 0.8], ["onion", 0.15], ["garlic", 0.01], ["cream", 0.1], ["butter", 0.03], ["salt", 0.008]],
    { es: "Crema de tomate", en: "Cream of tomato soup", da: "Tomatsuppe", fr: "Velouté de tomate", pt: "Creme de tomate", zh: "番茄浓汤" },
    {
      es: ["Sofreír cebolla y ajo en mantequilla.", "Agregar el tomate y cocinar 20 minutos.", "Licuar, añadir la crema y rectificar sal."],
      en: ["Sweat onion and garlic in butter.", "Add the tomato and cook 20 minutes.", "Blend, add the cream and season."],
      da: ["Svits løg og hvidløg i smør.", "Tilsæt tomat og kog i 20 minutter.", "Blend, tilsæt fløde og smag til."],
      fr: ["Faire suer l'oignon et l'ail au beurre.", "Ajouter la tomate et cuire 20 minutes.", "Mixer, ajouter la crème et rectifier."],
      pt: ["Refogue cebola e alho na manteiga.", "Junte o tomate e cozinhe 20 minutos.", "Bata, junte o creme e acerte o sal."],
      zh: ["黄油炒香洋葱和蒜。", "加入番茄煮 20 分钟。", "打成泥，加奶油并调味。"],
    },
  ],
]

const SUPPLIER = { es: "Distribuidora La Central", en: "Central Foods", da: "Centralen Engros", fr: "Grossiste Central", pt: "Distribuidora Central", zh: "中心食品批发" }
const ABBR = { kilogramos: "kg", litros: "L", unidad: "un" }

// Precios en lempiras; fuera del español se muestran en dólares (÷ 25).
export const CURRENCY = { es: "HNL", en: "USD", da: "USD", fr: "USD", pt: "USD", zh: "USD" }
const RATE = { HNL: 1, USD: 1 / 25 }
const STEP = { HNL: 5, USD: 0.5 }

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d

export function buildDemo(lang, ownerId) {
  const cur = CURRENCY[lang] || "USD"
  const rate = RATE[cur]
  const now = new Date()
  const iso = (d) => d.toISOString()
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000)
  const meta = { createdAt: iso(daysAgo(40)), updatedAt: iso(daysAgo(2)), version: 1 }

  const ing = {}
  const ingredientRows = INGREDIENTS.map(([key, category, unit, price, net, names], i) => {
    const purchasePrice = round(price * rate, 2)
    const id = `demo-ing-${key}`
    const data = {
      unit,
      supplier: SUPPLIER[lang] || SUPPLIER.en,
      pricing: { purchasePrice, netContent: net, pricePerUnit: round(purchasePrice / net, 6), lastUpdated: iso(daysAgo(2 + (i % 9))) },
      metadata: meta,
      ...(category === "VEGETAL" ? { merma: { enabled: true, useGlobal: true, globalPercentage: 10, customType: "percentage", customPercentage: 0, customValue: 0 } } : {}),
    }
    ing[key] = { id, name: names[lang] || names.en, category, unit, pricePerUnit: data.pricing.pricePerUnit, purchasePrice, net }
    return { id, business_id: null, owner_id: ownerId, name: ing[key].name, category, data, created_at: meta.createdAt, updated_at: meta.updatedAt }
  })

  const recipes = []
  const recipeRows = RECIPES.map(([key, classification, step, servings, lines, names, steps], ri) => {
    const items = lines.map(([k, qty], idx) => {
      const g = ing[k]
      const extension = round(qty * g.pricePerUnit, 4)
      return {
        id: `demo-line-${key}-${idx}`,
        ingredientId: g.id,
        name: g.name,
        category: g.category,
        quantity: qty,
        unit: g.unit,
        measure: ABBR[g.unit],
        cost: extension,
        unitCost: g.pricePerUnit,
        costPerMeasure: g.pricePerUnit,
        extension,
        originalIndex: idx,
      }
    })
    const totalCost = round(items.reduce((s, l) => s + l.extension, 0), 4)
    const costPerServing = round(totalCost / servings, 4)
    const price = Math.ceil(costPerServing / 0.3 / STEP[cur]) * STEP[cur]
    const id = `demo-recipe-${key}`
    const data = {
      unitPrice: price,
      plate: "INDIVIDUAL",
      step,
      servings,
      yieldAmount: servings,
      yieldUnit: "porciones",
      ingredients: items,
      procedure: steps[lang] || steps.en,
      totalCost,
      costPerServing,
      ingredientsCost: totalCost,
      pricingConfig: { publicServices: 10, marketing: 10, operationalCosts: 30, laborCosts: 25, netProfit: 30, isv: 0, isDefault: true },
      publicServices: 10,
      marketing: 10,
      operationalCosts: 30,
      laborCosts: 25,
      isv: 0,
      contributionMargin: 30,
      pricingMethod: "food_cost",
      targetFoodCostPercent: 30,
      businessId: "main",
      metadata: { createdAt: iso(daysAgo(30 - ri)), updatedAt: iso(daysAgo(1 + ri)), version: 2 },
    }
    recipes.push({ id, name: names[lang] || names.en, costPerServing, price })
    return { id, business_id: null, owner_id: ownerId, name: names[lang] || names.en, classification, is_sub_recipe: false, data, created_at: data.metadata.createdAt, updated_at: data.metadata.updatedAt }
  })

  // Inventario: el producto usa el id de su ingrediente (docs/190). Dos quedan bajos.
  const LOW = new Set(["cream", "lemon"])
  const inventoryRows = INGREDIENTS.map(([key], i) => {
    const g = ing[key]
    const minStock = g.unit === "unidad" ? 6 : 2
    const currentStock = LOW.has(key) ? round(minStock * 0.4, 2) : round(minStock * (1.6 + (i % 5) * 0.55), 2)
    const data = {
      id: g.id,
      name: g.name,
      category: g.category,
      currentStock,
      minStock,
      unit: g.unit,
      price: g.purchasePrice,
      netContent: g.net,
      supplier: SUPPLIER[lang] || SUPPLIER.en,
      lastUpdated: iso(daysAgo(1)),
      status: LOW.has(key) ? "low" : "normal",
      stockCountedAt: iso(daysAgo(1)),
    }
    return { id: g.id, business_id: null, owner_id: ownerId, data, created_at: meta.createdAt, updated_at: meta.updatedAt }
  })

  // Ventas de los últimos 30 días (registro manual), para Reportes.
  const salesLines = []
  const POP = [9, 7, 11, 5, 14, 3]
  for (let d = 29; d >= 0; d--) {
    const date = daysAgo(d)
    const weekend = [5, 6, 0].includes(date.getDay())
    recipes.forEach((r, i) => {
      const quantity = Math.max(1, Math.round(POP[i] * (weekend ? 1.45 : 1) * (0.8 + ((d * 7 + i * 13) % 10) / 25)))
      salesLines.push({
        id: `demo-sale-${d}-${i}`,
        rawDishName: r.name,
        recipeId: r.id,
        quantity,
        unitPrice: r.price,
        revenue: round(quantity * r.price, 2),
        theoreticalCost: round(quantity * r.costPerServing, 2),
        date: date.toISOString().slice(0, 10),
      })
    })
  }
  const totalRevenue = round(salesLines.reduce((s, l) => s + l.revenue, 0), 2)
  const totalTheoreticalCost = round(salesLines.reduce((s, l) => s + l.theoreticalCost, 0), 2)
  const sale = {
    id: "demo-sales-30d",
    businessId: "main",
    fileName: "ventas.csv",
    importedAt: iso(daysAgo(0)),
    periodStart: daysAgo(29).toISOString().slice(0, 10),
    periodEnd: now.toISOString().slice(0, 10),
    totalRevenue,
    totalTheoreticalCost,
    lineCount: salesLines.length,
    unmatchedDishNames: [],
    lines: salesLines,
    source: "pos_import",
  }
  const salesRows = [{ id: sale.id, business_id: null, owner_id: ownerId, data: sale, created_at: sale.importedAt }]


  // Menús (lib/types/menus.ts) y órdenes de compra (types/purchase-order.ts), para las páginas
  // de Características (docs/196).
  const MENU_NAMES = {
    lunch: { es: "Almuerzo ejecutivo", en: "Executive lunch", da: "Frokostmenu", fr: "Déjeuner du jour", pt: "Almoço executivo", zh: "商务午餐" },
    dinner: { es: "Cena del fin de semana", en: "Weekend dinner", da: "Weekendmiddag", fr: "Dîner du week-end", pt: "Jantar de fim de semana", zh: "周末晚餐" },
  }
  const STEP_NAMES = {
    starter: { es: "Entrada", en: "Starter", da: "Forret", fr: "Entrée", pt: "Entrada", zh: "前菜" },
    main: { es: "Plato fuerte", en: "Main course", da: "Hovedret", fr: "Plat principal", pt: "Prato principal", zh: "主菜" },
    drink: { es: "Bebida", en: "Drink", da: "Drik", fr: "Boisson", pt: "Bebida", zh: "饮品" },
  }
  const L = (o) => o[lang] || o.en
  const steps = [
    { id: "st-1", name: L(STEP_NAMES.starter), order: 1 },
    { id: "st-2", name: L(STEP_NAMES.main), order: 2 },
    { id: "st-3", name: L(STEP_NAMES.drink), order: 3 },
  ]
  const item = (id, recipeKey, stepId, section) => ({ id, recipeId: `demo-recipe-${recipeKey}`, stepId, section, enabled: true, priceOverride: null, plannedQuantity: 40 })
  const menus = [
    {
      id: "demo-menu-lunch",
      name: L(MENU_NAMES.lunch),
      menuType: "Almuerzo",
      serviceDate: daysAgo(-3).toISOString().slice(0, 10),
      plannedServings: 40,
      steps,
      items: [item("mi-1", "tomato-soup", "st-1", "entrada"), item("mi-2", "caesar", "st-1", "entrada"), item("mi-3", "grilled-chicken", "st-2", "fuerte"), item("mi-4", "alfredo", "st-2", "fuerte"), item("mi-5", "lemonade", "st-3", "bebida")],
      createdAt: iso(daysAgo(12)),
      updatedAt: iso(daysAgo(2)),
    },
    {
      id: "demo-menu-dinner",
      name: L(MENU_NAMES.dinner),
      menuType: "Cena",
      serviceDate: daysAgo(-5).toISOString().slice(0, 10),
      plannedServings: 60,
      steps,
      items: [item("md-1", "caesar", "st-1", "entrada"), item("md-2", "burger", "st-2", "fuerte"), item("md-3", "alfredo", "st-2", "fuerte"), item("md-4", "lemonade", "st-3", "bebida")],
      createdAt: iso(daysAgo(20)),
      updatedAt: iso(daysAgo(4)),
    },
  ]
  const menuRows = menus.map((m) => {
    const { id, name, ...rest } = m
    return { id, business_id: null, owner_id: ownerId, name, data: { ...rest, businessId: "main" }, created_at: m.createdAt, updated_at: m.updatedAt }
  })

  const orderItems = ["chicken", "cream", "lemon", "tomato", "parmesan"].map((k, i) => {
    const g = ing[k]
    const qty = [4, 3, 5, 6, 1][i]
    return {
      id: `poi-${k}`,
      ingredientId: g.id,
      name: g.name,
      totalQuantity: qty,
      unit: g.unit,
      costPerUnit: g.pricePerUnit,
      purchaseCost: round(qty * g.pricePerUnit, 2),
      quantityToBuy: qty,
      supplier: SUPPLIER[lang] || SUPPLIER.en,
    }
  })
  const subtotal = round(orderItems.reduce((sum, i) => sum + i.purchaseCost, 0), 2)
  const orders = [
    {
      id: "demo-po-1",
      name: L(MENU_NAMES.lunch),
      number: 12,
      date: daysAgo(1).toISOString().slice(0, 10),
      recipes: [{ id: "demo-recipe-grilled-chicken", name: recipes[0].name, yield: 40 }],
      items: orderItems,
      subtotal,
      tax: 0,
      total: subtotal,
      status: "pending",
      supplier: SUPPLIER[lang] || SUPPLIER.en,
      createdAt: iso(daysAgo(1)),
      expectedDeliveryDate: daysAgo(-1).toISOString().slice(0, 10),
    },
    {
      id: "demo-po-2",
      name: L(MENU_NAMES.dinner),
      number: 11,
      date: daysAgo(6).toISOString().slice(0, 10),
      recipes: [{ id: "demo-recipe-burger", name: recipes[2].name, yield: 60 }],
      items: orderItems.slice(0, 3),
      subtotal: round(orderItems.slice(0, 3).reduce((sum, i) => sum + i.purchaseCost, 0), 2),
      tax: 0,
      total: round(orderItems.slice(0, 3).reduce((sum, i) => sum + i.purchaseCost, 0), 2),
      status: "received",
      supplier: SUPPLIER[lang] || SUPPLIER.en,
      createdAt: iso(daysAgo(6)),
    },
  ]
  const orderRows = orders.map((o) => ({ id: o.id, business_id: null, owner_id: ownerId, data: o, created_at: o.createdAt }))

  // POS y horario del personal (docs/331): salón con mesas y pedidos abiertos, y la semana
  // del equipo, para las páginas de Ventas y POS y de Personal.
  const AREA = { es: "Salón", en: "Dining room", da: "Restaurant", fr: "Salle", pt: "Salão", zh: "大厅" }
  const tables = []
  for (let i = 0; i < 8; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    tables.push({ id: `demo-table-${i + 1}`, areaId: "demo-area", label: String(i + 1), shape: i % 3 === 1 ? "round" : "square", seats: i % 4 === 3 ? 6 : 4, x: 90 + col * 270, y: 110 + row * 260, w: 130, h: 120 })
  }
  const floor = { areas: [{ id: "demo-area", name: L(AREA) }], tables, updatedAt: iso(daysAgo(0)) }
  const r = (k) => recipes.find((x) => x.id === `demo-recipe-${k}`) || recipes[0]
  const posItem = (id, k, seat, quantity, status, minutes) => {
    const rc = r(k)
    const at = new Date(now.getTime() - minutes * 60000).toISOString()
    return { id, sourceType: "recipe", refId: rc.id, name: rc.name, seat, quantity, unitPrice: rc.price, unitCost: rc.costPerServing, extras: [], note: null, status, sentAt: status === "new" ? null : at, readyAt: status === "ready" || status === "served" ? at : null }
  }
  const posOrder = (n, tableNo, guests, items, minutes, status = "open") => ({
    id: `demo-order-${n}`,
    tableId: `demo-table-${tableNo}`,
    tableLabel: String(tableNo),
    areaName: L(AREA),
    channel: "dine_in",
    guests,
    waiter: ["Ana", "Luis", "Sofía"][n % 3],
    openedAt: new Date(now.getTime() - minutes * 60000).toISOString(),
    status,
    items,
    updatedAt: iso(daysAgo(0)),
    rev: 1,
  })
  const posOrders = [
    posOrder(1, 1, 2, [posItem("o1a", "burger", 1, 1, "served", 35), posItem("o1b", "caesar", 2, 1, "served", 35), posItem("o1c", "lemonade", null, 2, "served", 40)], 48, "bill"),
    posOrder(2, 3, 4, [posItem("o2a", "grilled-chicken", 1, 2, "sent", 12), posItem("o2b", "alfredo", 3, 1, "sent", 12), posItem("o2c", "tomato-soup", 4, 1, "ready", 6)], 25),
    posOrder(3, 4, 6, [posItem("o3a", "burger", null, 3, "sent", 8), posItem("o3b", "lemonade", null, 6, "served", 15)], 20),
    posOrder(4, 6, 2, [posItem("o4a", "caesar", 1, 1, "new", 0)], 4),
  ]
  const ROLES = {
    cook: { es: "Cocinero", en: "Cook", da: "Kok", fr: "Cuisinier", pt: "Cozinheiro", zh: "厨师" },
    server: { es: "Mesera", en: "Server", da: "Tjener", fr: "Serveuse", pt: "Garçonete", zh: "服务员" },
    bar: { es: "Barista", en: "Barista", da: "Barista", fr: "Barista", pt: "Barista", zh: "咖啡师" },
    dish: { es: "Ayudante", en: "Kitchen helper", da: "Køkkenhjælper", fr: "Commis", pt: "Ajudante", zh: "厨房帮手" },
  }
  // Pago por hora en lempiras; en dólares, ÷ 25, igual que los precios del ejemplo.
  const pay = (hnl) => (cur === "HNL" ? hnl : round(hnl / 25, 2))
  const staff = [
    { id: "st-ana", name: "Ana", role: L(ROLES.server), hourlyRate: pay(75), active: true, defaultStart: "11:00", defaultEnd: "19:00" },
    { id: "st-luis", name: "Luis", role: L(ROLES.cook), hourlyRate: pay(90), active: true, defaultStart: "10:00", defaultEnd: "18:00" },
    { id: "st-sofia", name: "Sofía", role: L(ROLES.server), hourlyRate: pay(75), active: true, defaultStart: "16:00", defaultEnd: "23:00" },
    { id: "st-carlos", name: "Carlos", role: L(ROLES.dish), hourlyRate: pay(60), active: true, defaultStart: "12:00", defaultEnd: "20:00" },
    { id: "st-maria", name: "María", role: L(ROLES.bar), hourlyRate: pay(70), active: true, defaultStart: "07:00", defaultEnd: "15:00" },
  ]
  const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const hoursOf = (a, b) => {
    const [ah, am] = a.split(":").map(Number)
    const [bh, bm] = b.split(":").map(Number)
    let h = bh + bm / 60 - (ah + am / 60)
    if (h <= 0) h += 24
    return h
  }
  const shifts = []
  const pattern = { "st-ana": [0, 1, 2, 4, 5], "st-luis": [0, 1, 3, 4, 5, 6], "st-sofia": [2, 3, 4, 5, 6], "st-carlos": [1, 2, 3, 5, 6], "st-maria": [0, 1, 2, 3, 4] }
  // Esta semana y las cuatro anteriores: así Finanzas tiene el costo de personal del mes.
  for (let w = -4; w <= 0; w++)
  for (const p of staff)
    for (const d of pattern[p.id]) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + d)
      shifts.push({ id: `sh-${p.id}-${w}-${d}`, staffId: p.id, date: local(date), start: p.defaultStart, end: p.defaultEnd, hours: hoursOf(p.defaultStart, p.defaultEnd), rate: p.hourlyRate })
    }
  const posRows = [
    { id: "main::floor", kind: "floor", business_id: null, owner_id: ownerId, data: floor, updated_at: iso(daysAgo(0)) },
    { id: "main::staff", kind: "config", business_id: null, owner_id: ownerId, data: { staff, shifts }, updated_at: iso(daysAgo(0)) },
    ...posOrders.map(({ id, ...o }) => ({ id, kind: "order", business_id: null, owner_id: ownerId, data: o, updated_at: iso(daysAgo(0)) })),
  ]

  // Conteos del período y compras del mes (docs/331): sin ellos Finanzas no puede mostrar el
  // costo real, el Prime Cost ni la utilidad. Food cost real ≈ 31 % (un poco más que el teórico).
  const snapItems = (factor) =>
    inventoryRows.map((row) => {
      const d = row.data
      const quantity = round(d.currentStock * factor, 2)
      return { id: d.id, name: d.name, category: d.category, quantity, unit: d.unit, price: d.price, netContent: d.netContent, totalPrice: round((quantity * d.price) / (d.netContent || 1), 2) }
    })
  const valueOf = (items) => items.reduce((sum, i) => sum + i.totalPrice, 0)
  const openingItems = snapItems(1.15)
  const closingItems = snapItems(1)
  const purchases = Math.max(0, round(totalRevenue * 0.31 - (valueOf(openingItems) - valueOf(closingItems)), 2))
  const snapshotRow = (id, date, items) => ({ id, business_id: null, owner_id: ownerId, date, data: { type: "final", modifiedItems: items.length, totalValue: round(valueOf(items), 2), items } })
  const snapshotRows = [
    snapshotRow("demo-snap-open", new Date(daysAgo(29).setHours(8, 0, 0, 0)).toISOString(), openingItems),
    snapshotRow("demo-snap-close", new Date(now.getTime() - 3600000).toISOString(), closingItems),
  ]
  const monthSubtotal = orderItems.reduce((sum, i) => sum + i.purchaseCost, 0)
  const k = monthSubtotal > 0 ? purchases / monthSubtotal : 0
  const monthItems = orderItems.map((i) => ({ ...i, id: `m-${i.id}`, totalQuantity: round(i.totalQuantity * k, 2), quantityToBuy: round(i.totalQuantity * k, 2), purchaseCost: round(i.purchaseCost * k, 2) }))
  const monthTotal = round(monthItems.reduce((sum, i) => sum + i.purchaseCost, 0), 2)
  orderRows.push({
    id: "demo-po-month",
    business_id: null,
    owner_id: ownerId,
    created_at: iso(daysAgo(15)),
    data: { id: "demo-po-month", name: SUPPLIER[lang] || SUPPLIER.en, number: 9, date: daysAgo(15).toISOString().slice(0, 10), recipes: [], items: monthItems, subtotal: monthTotal, tax: 0, total: monthTotal, status: "received", receivedAt: iso(daysAgo(14)), supplier: SUPPLIER[lang] || SUPPLIER.en, createdAt: iso(daysAgo(15)) },
  })

  return { currency: cur, tables: { ingredients: ingredientRows, recipes: recipeRows, inventory_items: inventoryRows, sales_imports: salesRows, menus: menuRows, purchase_orders: orderRows, pos_data: posRows, inventory_snapshots: snapshotRows } }
}
