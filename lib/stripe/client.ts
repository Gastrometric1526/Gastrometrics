/**
 * Cliente de Stripe del lado del servidor — NO conectado todavía (no hay
 * cuenta de Stripe creada, ver docs/12-guia-backend.md y
 * app/signup/payment/page.tsx, que hoy simula el cobro sin tocar ninguna
 * API real). Mismo patrón que lib/supabase/env.ts: importar este archivo
 * nunca lanza, solo llamar a getStripeClient() sin STRIPE_SECRET_KEY
 * configurada.
 */

import Stripe from "stripe"

let cachedClient: Stripe | null = null

export function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      "Stripe no está configurado. Falta STRIPE_SECRET_KEY (ver .env.example y docs/12-guia-backend.md).",
    )
  }

  cachedClient = new Stripe(secretKey, {
    apiVersion: "2026-07-29.dahlia",
  })
  return cachedClient
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
}

const SUBSCRIPTION_PRODUCT_ID = "gastrometrics-plan-subscription"

/**
 * Los 5 planes nunca tuvieron un Price fijo en Stripe (el checkout arma el precio al
 * vuelo con `price_data`, ver app/api/checkout/route.ts) — pero desde docs/76,
 * cambiar de un plan pago a otro ya no crea una sesión de Checkout nueva, actualiza
 * la suscripción existente en el lugar, y `subscriptions.update`'s `price_data` (a
 * diferencia del de Checkout) exige un `product` real, no `product_data` inline. Un
 * solo Product reutilizado por los 5 planes, con id fijo para no crear uno nuevo en
 * cada llamada — se busca primero, se crea solo la primera vez.
 */
export async function getOrCreateSubscriptionProductId(): Promise<string> {
  const stripe = getStripeClient()
  try {
    const existing = await stripe.products.retrieve(SUBSCRIPTION_PRODUCT_ID)
    if (!existing.deleted) return existing.id
  } catch (error: any) {
    if (error?.code !== "resource_missing") throw error
  }
  const created = await stripe.products.create({
    id: SUBSCRIPTION_PRODUCT_ID,
    name: "GastroMetrics — Suscripción",
  })
  return created.id
}
