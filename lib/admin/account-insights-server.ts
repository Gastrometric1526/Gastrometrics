/**
 * Datos de la radiografía completa de una cuenta para /admin (docs/166): perfil, plan e historial
 * de planes, uso (días, horas, módulos, rachas), contenido creado, equipo, correos
 * recibidos, mensajes enviados y estado de facturación. Lo usa /api/admin/account-insights.
 */

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  computeUsageInsights,
  type ActivityRow,
} from "@/lib/admin/account-insights";
import { getPlanBySlug } from "@/lib/plans";
import { isTesterEmail } from "@/lib/tester-allowlist";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { CLICK_PREFIX } from "@/lib/email-tracking";
import type { FeatureKey } from "@/lib/plans";

async function allRows<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown; error: unknown }>,
  cap = 20000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error || !Array.isArray(data)) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function getAccountInsights(userId: string) {
  const admin = getSupabaseAdminClient();
  const [
    { data: authData },
    { data: profile },
    { data: plan },
    { data: presence },
    { data: businesses },
  ] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin
      .from("account_plans")
      .select("*")
      .eq("account_id", userId)
      .maybeSingle(),
    admin
      .from("user_presence")
      .select("last_seen_at, total_active_seconds")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("businesses")
      .select("id, name, created_at, data")
      .eq("owner_id", userId),
  ]);
  const authUser = authData?.user;
  if (!authUser) return null;
  const businessIds = (businesses ?? []).map((b) => b.id);

  const activity = await allRows<ActivityRow>((from, to) =>
    admin
      .from("activity_log")
      .select("module, action, created_at, business_id, metadata, entity_label")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .range(from, to),
  );

  // Contenido: lo de sus negocios más lo que tenga sin negocio a su nombre.
  const ownedOr = businessIds.length
    ? `owner_id.eq.${userId},business_id.in.(${businessIds.join(",")})`
    : `owner_id.eq.${userId}`;
  const countOwned = async (table: string) => {
    const { count } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .or(ownedOr);
    return count ?? 0;
  };
  const [
    recipes,
    ingredients,
    inventoryItems,
    inventorySnapshots,
    menus,
    purchaseOrders,
    invoices,
    trash,
    salesImports,
    recipeRows,
  ] = await Promise.all([
    countOwned("recipes"),
    countOwned("ingredients"),
    countOwned("inventory_items"),
    countOwned("inventory_snapshots"),
    countOwned("menus"),
    countOwned("purchase_orders"),
    countOwned("invoices"),
    countOwned("recipes_trash"),
    admin.from("sales_imports").select("data, created_at").or(ownedOr),
    admin
      .from("recipes")
      .select("id", { count: "exact", head: true })
      .or(ownedOr)
      .eq("is_sub_recipe", true),
  ]);
  const subRecipes = recipeRows.count ?? 0;
  let posImports = 0;
  let manualSales = 0;
  let lastSalesAt: string | null = null;
  for (const row of salesImports.data ?? []) {
    const info = row.data as { source?: string; importedAt?: string };
    if (info?.source === "manual") manualSales++;
    else posImports++;
    const at = info?.importedAt || row.created_at;
    if (at && (!lastSalesAt || at > lastSalesAt)) lastSalesAt = at;
  }

  const [
    team,
    memberships,
    drafts,
    activationEmails,
    engagementEmails,
    reengagementEmails,
    feedback,
  ] = await Promise.all([
    admin
      .from("team_members")
      .select("email, status, invited_at, data")
      .eq("owner_id", userId),
    admin.from("business_members").select("business_id").eq("user_id", userId),
    admin
      .from("recipe_drafts")
      .select("recipe_name, updated_at")
      .eq("user_id", userId),
    admin
      .from("activation_emails_sent")
      .select("email_type, sent_at")
      .eq("account_id", userId),
    admin.from("engagement_emails_sent").select("*").eq("account_id", userId),
    admin
      .from("reengagement_emails_sent")
      .select("email_type, sent_at")
      .eq("account_id", userId),
    authUser.email
      ? admin
          .from("feedback")
          .select("type, message, status, created_at, page")
          .eq("user_email", authUser.email)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const memberBusinessIds = (memberships.data ?? [])
    .map((m) => m.business_id)
    .filter((id) => !businessIds.includes(id));
  const memberOfBusinesses = memberBusinessIds.length
    ? ((
        await admin
          .from("businesses")
          .select("id, name")
          .in("id", memberBusinessIds)
      ).data ?? [])
    : [];

  const appMeta = (authUser.app_metadata || {}) as Record<string, any>;
  const usage = computeUsageInsights(activity);
  const planSlug = plan?.plan_slug || "foodie";
  const emails = [
    ...(activationEmails.data ?? []).map((e) => ({
      kind: "activation",
      type: e.email_type,
      at: e.sent_at,
      clicked: null as boolean | null,
    })),
    // Los clics («click:<campaña>») viven en la misma tabla: no son correos (docs/172).
    ...(engagementEmails.data ?? [])
      .filter((e: any) => !String(e.email_type).startsWith(CLICK_PREFIX))
      .map((e: any) => ({
        kind: "engagement",
        type: e.email_type,
        at: e.sent_at,
        clicked: null as boolean | null,
      })),
    ...(reengagementEmails.data ?? []).map((e) => ({
      kind: "reengagement",
      type: e.email_type,
      at: e.sent_at,
      clicked: null,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Clics desde correos (docs/172).
  const emailClicks = (engagementEmails.data ?? [])
    .filter((e: any) => String(e.email_type).startsWith(CLICK_PREFIX))
    .map((e: any) => ({ campaign: String(e.email_type).slice(CLICK_PREFIX.length), at: e.sent_at as string }))
    .sort((a, b) => b.at.localeCompare(a.at))

  // Uso del plan contra sus límites y funciones pagadas que nunca abrió (docs/172).
  const planDef = getPlanBySlug(planSlug)
  const visited = new Set(usage.moduleVisits.map((m) => m.module))
  const FEATURE_MODULE: Partial<Record<FeatureKey, string>> = {
    inventory: "inventario",
    menus: "menus",
    purchase_orders_manual: "ordenes_compra",
    team: "equipo",
    stats_panorama: "estadisticas",
  }
  const unusedFeatures = planDef.unlockedFeatures.filter((f) => FEATURE_MODULE[f] && !visited.has(FEATURE_MODULE[f]!))

  // Progreso de activación: los pasos que muestran que la cuenta adoptó la app (docs/172).
  const activation = [
    { key: "business", done: (businesses ?? []).length > 0 },
    { key: "ingredient", done: ingredients > 0 },
    { key: "recipe", done: recipes > 0 },
    { key: "sub_recipe", done: subRecipes > 0 },
    { key: "inventory", done: inventoryItems > 0 || inventorySnapshots > 0 },
    { key: "menu", done: menus > 0 },
    { key: "purchase_order", done: purchaseOrders > 0 },
    { key: "sales", done: posImports + manualSales > 0 },
    { key: "team", done: (team.data ?? []).length > 0 },
  ]

  // Actividad reciente para soporte: las últimas 25 acciones (sin el sistema).
  const recentActivity = activity
    .filter((a) => a.module !== "plan" && a.module !== "encuesta")
    .slice(-25)
    .reverse()
    .map((a) => ({ module: a.module, action: a.action, label: a.entity_label ?? null, at: a.created_at }))

  // Pagos en Stripe: total pagado, facturas, tarjeta y pagos fallidos (docs/172).
  let billing: {
    totalPaidCents: number
    currency: string
    invoices: { number: string | null; at: string; amountCents: number; status: string; url: string | null }[]
    failedPayments: number
    card: { brand: string; last4: string; expMonth: number; expYear: number } | null
    dashboardUrl: string | null
  } | null = null
  if (plan?.stripe_customer_id && isStripeConfigured()) {
    try {
      const stripe = getStripeClient()
      const [invoiceList, customer] = await Promise.all([
        stripe.invoices.list({ customer: plan.stripe_customer_id, limit: 24 }),
        stripe.customers.retrieve(plan.stripe_customer_id, { expand: ["invoice_settings.default_payment_method"] }),
      ])
      const invoices = invoiceList.data.map((inv) => ({
        number: inv.number ?? null,
        at: new Date((inv.created || 0) * 1000).toISOString(),
        amountCents: inv.status === "paid" ? inv.amount_paid : inv.amount_due,
        status: inv.status ?? "draft",
        url: inv.hosted_invoice_url ?? null,
      }))
      let card: { brand: string; last4: string; expMonth: number; expYear: number } | null = null
      const pm = !("deleted" in customer && customer.deleted) ? (customer as any).invoice_settings?.default_payment_method : null
      if (pm && typeof pm === "object" && pm.card) {
        card = { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }
      } else if (plan.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(plan.stripe_subscription_id, { expand: ["default_payment_method"] })
        const spm = sub.default_payment_method as any
        if (spm && typeof spm === "object" && spm.card) {
          card = { brand: spm.card.brand, last4: spm.card.last4, expMonth: spm.card.exp_month, expYear: spm.card.exp_year }
        }
      }
      billing = {
        totalPaidCents: invoiceList.data.filter((i) => i.status === "paid").reduce((sum, i) => sum + (i.amount_paid || 0), 0),
        currency: (invoiceList.data[0]?.currency || "usd").toUpperCase(),
        invoices,
        failedPayments: invoiceList.data.filter((i) => (i.status === "open" || i.status === "uncollectible") && (i.attempt_count || 0) > 0).length,
        card,
        dashboardUrl: `https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test/" : ""}customers/${plan.stripe_customer_id}`,
      }
    } catch (error) {
      console.error("[account-insights] No se pudo leer Stripe:", error)
    }
  }

  return {
    account: {
      userId,
      email: authUser.email,
      name: profile?.full_name || null,
      createdAt: authUser.created_at,
      emailConfirmedAt: authUser.email_confirmed_at || null,
      lastSignInAt: authUser.last_sign_in_at || null,
      providers: (appMeta.providers as string[] | undefined) || [],
      country: profile?.nationality || null,
      currency: profile?.currency || null,
      businessType: profile?.business_type || null,
      businessSize: profile?.business_size || null,
      experience: profile?.industry_experience || null,
      language: profile?.preferred_language || null,
      productUpdatesOptIn: Boolean(profile?.product_updates_opt_in),
      termsAcceptedAt: profile?.terms_accepted_at || null,
      termsVersion: profile?.terms_version || null,
      deletionRequestedAt: profile?.deletion_requested_at || null,
      isTester: authUser.email ? isTesterEmail(authUser.email) : false,
    },
    plan: {
      slug: planSlug,
      priceUsdCents: getPlanBySlug(planSlug).priceUsdCents,
      since: plan?.last_change_at || authUser.created_at,
      expiresAt: plan?.plan_expires_at || null,
      hasSubscription: Boolean(plan?.stripe_subscription_id),
      stripeCustomerId: plan?.stripe_customer_id || null,
      stripeSubscriptionId: plan?.stripe_subscription_id || null,
      cancelAtPeriodEnd: Boolean(plan?.cancel_at_period_end),
      currentPeriodEnd: plan?.current_period_end || null,
      extraBusinesses: plan?.extra_businesses || 0,
      extraTeamSeats: plan?.extra_team_seats || 0,
      founderGrant: appMeta.founder_grant || null,
      scheduledRenewal: appMeta.scheduled_plan || null,
      history: usage.planChanges,
    },
    usage: {
      totalActiveSeconds: presence?.total_active_seconds || 0,
      lastSeenAt: presence?.last_seen_at || null,
      ...usage,
      planChanges: undefined,
    },
    content: {
      businesses: (businesses ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        createdAt: b.created_at,
        isActive: (b.data as any)?.isActive !== false,
      })),
      recipes,
      subRecipes,
      ingredients,
      inventoryItems,
      inventoryCounts: inventorySnapshots,
      menus,
      purchaseOrders,
      invoices,
      recipesInTrash: trash,
      posImports,
      manualSales,
      lastSalesAt,
      drafts: drafts.data ?? [],
    },
    team: {
      invited: (team.data ?? []).map((m: any) => ({
        email: m.email,
        status: m.status,
        invitedAt: m.invited_at,
      })),
      memberOf: memberOfBusinesses,
    },
    emails,
    emailClicks,
    feedback: feedback.data ?? [],
    limits: {
      businessesUsed: (businesses ?? []).length,
      businessesMax: planDef.maxBusinesses + (plan?.extra_businesses || 0),
      usersUsed: 1 + (team.data ?? []).length,
      usersMax: planDef.maxUsers + (plan?.extra_team_seats || 0),
      unusedFeatures,
    },
    activation,
    recentActivity,
    billing,
    // Respuestas a las preguntas cortas (docs/173).
    surveyAnswers: activity
      .filter((a) => a.module === "encuesta")
      .map((a) => {
        const m = (a.metadata || {}) as Record<string, unknown>
        return { question: String(m.question || a.entity_label || ""), answer: (m.answer as string | null) ?? null, detail: (m.detail as string | null) ?? null, at: a.created_at }
      })
      .reverse(),
  };
}

export type AccountInsights = NonNullable<
  Awaited<ReturnType<typeof getAccountInsights>>
>;
