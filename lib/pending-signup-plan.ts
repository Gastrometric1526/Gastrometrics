/**
 * Plan pago elegido durante el registro (app/signup/page.tsx), pendiente de llevar a
 * la persona al pago — pedido explícito del dueño del proyecto: "correspondientemente
 * llevarlo al area de pago de ser cualquier otro plan que no sea foodie".
 *
 * Por qué esto no puede resolverse todo dentro de handleSubmit de signup/page.tsx: la
 * gran mayoría de las cuentas reales exigen confirmar el correo antes de poder iniciar
 * sesión (ver login_error_email_not_confirmed) — el intento de login inmediato tras el
 * registro casi siempre falla con "revisa tu correo", y la persona recién vuelve a
 * tener una sesión real más tarde, desde /login normal, no desde /signup. Sin esto, la
 * elección de plan se perdía en ese punto — la cuenta quedaba creada en Foodie sin
 * importar qué haya elegido (mismo patrón de bug ya encontrado y corregido para el
 * borrador de la demo de la landing, ver lib/landing-demo.ts).
 *
 * localStorage porque, igual que el borrador de la demo, es específico de ESTE
 * navegador — el mismo donde la persona va a confirmar el correo y volver a
 * /login la mayoría de las veces. TTL de 24 horas: da tiempo de sobra a revisar el
 * correo con calma, pero evita que alguien que vuelve meses después (con el plan real
 * ya cambiado por otro medio, o simplemente arrepentido) sea redirigido a pagar algo
 * que ya no pidió.
 */

const STORAGE_KEY = "gm_pending_signup_plan"
const EXPIRY_MS = 24 * 60 * 60 * 1000

export function setPendingSignupPlan(planSlug: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ planSlug, setAt: Date.now() }))
  } catch {
    // localStorage puede fallar (modo privado, cuota llena) — no bloquea el registro.
  }
}

/** Lee y BORRA el plan pendiente, si sigue vigente — como máximo se consume una vez. */
export function consumePendingSignupPlan(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    window.localStorage.removeItem(STORAGE_KEY)
    const parsed = JSON.parse(raw) as { planSlug: string; setAt: number }
    if (Date.now() - parsed.setAt > EXPIRY_MS) return null
    return parsed.planSlug || null
  } catch {
    return null
  }
}
