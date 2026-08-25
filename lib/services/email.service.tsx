import { ActivityTracker } from "@/lib/activity-tracker"
import { translate, type LanguageCode } from "@/lib/i18n/translations"

// Este módulo no es un componente de React — no puede usar useLanguage(). Lee el
// idioma directo de localStorage (misma llave que contexts/language-context.tsx),
// solo para que la actividad guardada quede en el idioma que la persona tenía
// elegido, no siempre en español.
function getCurrentLanguage(): LanguageCode {
  if (typeof window === "undefined") return "es"
  return (localStorage.getItem("app_language") as LanguageCode | null) || "es"
}

// Se llama desde app/signup/page.tsx (componente cliente) — el envío real ocurre
// en app/api/auth/welcome-email/route.ts, del lado del servidor, porque
// RESEND_API_KEY nunca está disponible en el navegador (sin prefijo NEXT_PUBLIC_).
// Best-effort: si falla, no bloquea el registro — la cuenta ya se creó igual.
export async function sendWelcomeEmail(user: { email: string; fullName: string }) {
  try {
    const response = await fetch("/api/auth/welcome-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, fullName: user.fullName }),
    })
    const data = await response.json().catch(() => ({ sent: false }))

    if (data.sent) {
      const message = translate(getCurrentLanguage(), "email_activity_welcome_sent").replace("{email}", user.email)
      ActivityTracker.addActivity(message, "business", undefined, {
        type: "email",
        action: "welcome_email",
        recipient: user.email,
      })
    }

    return { success: Boolean(data.sent) }
  } catch (error) {
    console.error("Error enviando el correo de bienvenida:", error)
    return { success: false }
  }
}
