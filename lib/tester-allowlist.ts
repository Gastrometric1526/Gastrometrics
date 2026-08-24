// Solo se importa desde rutas de servidor — lee TESTER_ALLOWLIST_EMAILS, que nunca
// debe llegar al navegador (son correos de personas reales, no algo para exponer al
// cliente). Compartido entre app/api/plan/dev-account/route.ts (aplica el plan) y
// app/api/plan/is-tester/route.ts (solo informa sí/no, para la UI de /planes).
export function isTesterEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allowlist = (process.env.TESTER_ALLOWLIST_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return allowlist.includes(email.toLowerCase())
}
