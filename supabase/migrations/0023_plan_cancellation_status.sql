-- GastroMetrics — estado de cancelación en curso de una suscripción real de Stripe.
--
-- Por qué: cuando alguien cancela desde el Portal de Cliente de Stripe, por default
-- Stripe NO borra la suscripción al instante — la deja activa hasta el final del
-- período ya pagado (cancel_at_period_end = true) y recién ahí dispara
-- customer.subscription.deleted. Mientras tanto, la app no tenía ningún dato para
-- mostrarle al usuario "ya cancelaste, tu acceso termina el [fecha]" — seguía
-- viéndose exactamente igual que una suscripción activa normal, sin confirmar que la
-- cancelación de verdad se registró (pedido explícito del dueño del proyecto).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.account_plans
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end timestamptz;
