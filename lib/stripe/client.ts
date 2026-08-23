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
