/**
 * Textos de los correos transaccionales (lib/email-templates/*.html) en los 6 idiomas
 * soportados — mismo patrón que lib/i18n/pdf-labels.ts: el correo se genera en una ruta
 * de servidor (Resend + HTML plano), que no puede usar useLanguage()/el contexto de
 * React, así que necesita su propio diccionario en vez de lib/i18n/translations.ts.
 *
 * Los textos de las plantillas HTML son fijos en español desde que se entregaron
 * (paquete de diseño externo, ver lib/email-templates/LEEME.md) — no traducían nada
 * fuera del contenido ya dinámico ({{fullName}}, {{planName}}, etc.). Este diccionario
 * cubre exactamente todo lo que antes era texto fijo, para que cada correo salga en el
 * idioma real del destinatario (ver docs/58).
 *
 * Los valores con `{palabra}` (llave simple, distinta de `{{palabra}}` de las plantillas
 * HTML) se resuelven en JS con fillLabel() ANTES de pasarse a renderEmailTemplate — así
 * una plantilla HTML solo necesita una variable `{{heading}}`/`{{body}}` ya resuelta en
 * el idioma correcto, en vez de tener que mezclar texto fijo y variables dentro del
 * propio archivo HTML.
 */

export type EmailLang = "es" | "en" | "da" | "fr" | "pt" | "zh"

const SUPPORTED_EMAIL_LANGS: EmailLang[] = ["es", "en", "da", "fr", "pt", "zh"]

export function normalizeEmailLang(lang: string | null | undefined): EmailLang {
  if (lang && (SUPPORTED_EMAIL_LANGS as string[]).includes(lang)) return lang as EmailLang
  return "es"
}

/** Sustituye `{clave}` (llave simple) por el valor de `vars.clave` — no toca `{{...}}`. */
export function fillLabel(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match))
}

export type EmailLabelKeys =
  | "footer_address"
  | "billing_footer2"
  | "e01_subject"
  | "e01_title"
  | "e01_preheader"
  | "e01_heading"
  | "e01_body"
  | "e01_cta"
  | "e01_footnote"
  | "e01_footer2"
  | "e02_subject"
  | "e02_title"
  | "e02_preheader"
  | "e02_received_prefix"
  | "e02_intro"
  | "e02_original_label"
  | "e02_cta"
  | "e02_footnote"
  | "e02_footer2"
  | "feedback_type_sugerencia"
  | "feedback_type_experiencia"
  | "feedback_type_queja"
  | "feedback_type_bug"
  | "feedback_reply_title_sugerencia"
  | "feedback_reply_title_experiencia"
  | "feedback_reply_title_queja"
  | "feedback_reply_title_bug"
  | "e03_subject"
  | "e03_title"
  | "e03_preheader"
  | "e03_heading"
  | "e03_body"
  | "e03_cta"
  | "e03_label_request"
  | "e03_label_device"
  | "e03_label_expires"
  | "e03_value_expires"
  | "e03_footnote"
  | "e03_footer2"
  | "e03_device_admin_requested"
  | "device_unknown"
  | "device_connector"
  | "device_fallback_os"
  | "device_fallback_browser"
  | "e04_subject"
  | "e04_title"
  | "e04_preheader"
  | "e04_heading"
  | "e04_body"
  | "e04_access_label"
  | "e04_label_scope"
  | "e04_label_modules"
  | "e04_label_pdfs"
  | "e04_cta"
  | "e04_footnote"
  | "e04_footer2"
  | "e05_subject"
  | "e05_title"
  | "e05_preheader"
  | "e05_heading"
  | "e05_body"
  | "e05_fallback_access_until"
  | "e05_label_access_until"
  | "e05_label_then"
  | "e05_value_then"
  | "e05_label_next_charge"
  | "e05_value_none"
  | "e05_body2"
  | "e05_cta"
  | "e05_footnote"
  | "e06_subject"
  | "e06_title"
  | "e06_preheader"
  | "e06_body"
  | "e06_label_before"
  | "e06_label_now"
  | "e06_unlocked_heading"
  | "e06_removed_heading"
  | "e06_next_charge_prefix"
  | "e06_body_admin"
  | "e06_expires_prefix"
  | "e06_no_expiry_value"
  | "e06_cta"
  | "e06_footnote"
  | "e07_footer2"
  | "e07_footnote"
  | "e07_reminder_subject"
  | "e07_reminder_title"
  | "e07_reminder_preheader"
  | "e07_reminder_heading"
  | "e07_reminder_body"
  | "e07_reminder_cta"
  | "e07_day7_subject"
  | "e07_day7_title"
  | "e07_day7_preheader"
  | "e07_day7_heading"
  | "e07_day7_body"
  | "e07_day7_cta"
  | "e07_firstsale_subject"
  | "e07_firstsale_title"
  | "e07_firstsale_preheader"
  | "e07_firstsale_heading"
  | "e07_firstsale_body"
  | "e07_firstsale_cta"
  | "e08_subject"
  | "e08_title"
  | "e08_preheader"
  | "e08_heading"
  | "e08_cta"
  | "e08_footnote"
  | "e08_footer2"
  | "e09_subject"
  | "e09_title"
  | "e09_preheader"
  | "e09_heading"
  | "e09_body"
  | "e09_cta1"
  | "e09_cta2"
  | "e09_footnote"
  | "e09_footer2"
  | "e10_subject"
  | "e10_title"
  | "e10_preheader"
  | "e10_heading"
  | "e10_body"
  | "e10_cta1"
  | "e10_cta2"
  | "e10_footnote"
  | "e10_footer2"
  | "e11_subject"
  | "e11_title"
  | "e11_preheader"
  | "e11_heading"
  | "e11_body"
  | "e11_terms_label"
  | "e11_privacy_label"
  | "e11_liability_label"
  | "e11_cta"
  | "e11_footnote"
  | "e11_footer2"

export const EMAIL_LABELS: Record<EmailLang, Record<EmailLabelKeys, string>> = {
  es: {
    footer_address: "Gastrometrics &middot; Costeo de cocina &middot; Copenhague, Dinamarca",
    billing_footer2: "Correo de facturación de tu cuenta.",
    e01_subject: "Confirma tu cuenta en GastroMetrics",
    e02_subject: "Respuesta a tu mensaje en GastroMetrics",
    e03_subject: "Restablece tu contraseña de GastroMetrics",
    e04_subject: "{ownerName} te invitó a su equipo en GastroMetrics",
    e05_subject: "Cancelamos tu suscripción",
    e06_subject: "Tu plan cambió: {fromPlan} → {toPlan}",
    e01_title: "Confirma tu correo",
    e01_preheader: "Un clic y tu cuenta queda activa.",
    e01_heading: "Falta un clic, {fullName}",
    e01_body:
      "Tu cuenta ya existe con el plan <strong style=\"color:#1A1512\">{planName}</strong>. Confirma que este correo es tuyo y quedas dentro — es lo único que usamos para recuperar tu acceso si pierdes la contraseña.",
    e01_cta: "Confirmar mi correo",
    e01_footnote:
      "El enlace vence en 24 horas. Si no fuiste tú quien se registró, ignora este correo — sin confirmar, la cuenta no se activa.",
    e01_footer2: "Este es un correo de servicio de tu cuenta.",
    e02_title: "Respuesta a tu mensaje",
    e02_preheader: "Ya revisamos lo que nos escribiste.",
    e02_received_prefix: "recibido el",
    e02_intro: "Gracias por avisar. Esto fue lo que encontramos:",
    e02_original_label: "Tu mensaje original",
    e02_cta: "Abrir Gastrometrics",
    e02_footnote: "¿Sigue pasando? Responde este correo y seguimos en el mismo hilo.",
    e02_footer2: "Recibiste esto porque escribiste desde el formulario de contacto.",
    feedback_type_sugerencia: "Sugerencia",
    feedback_type_experiencia: "Experiencia",
    feedback_type_queja: "Queja",
    feedback_type_bug: "Reporte de error",
    feedback_reply_title_sugerencia: "Revisamos tu sugerencia",
    feedback_reply_title_experiencia: "Vimos tu comentario sobre tu experiencia",
    feedback_reply_title_queja: "Ya resolvimos tu reporte",
    feedback_reply_title_bug: "Ya corregimos el problema",
    e03_title: "Restablece tu contraseña",
    e03_preheader: "Enlace válido por 1 hora.",
    e03_heading: "Elige una contraseña nueva",
    e03_body:
      "Alguien pidió restablecer la contraseña de <strong style=\"color:#1A1512\">{email}</strong>. Si fuiste tú, continúa:",
    e03_cta: "Crear contraseña nueva",
    e03_label_request: "Solicitud",
    e03_label_device: "Dispositivo",
    e03_device_admin_requested: "Generado por soporte de GastroMetrics",
    e03_label_expires: "Vence",
    e03_value_expires: "En 1 hora",
    e03_footnote:
      "Si no pediste este cambio, no hagas nada: tu contraseña actual sigue funcionando y nadie puede entrar sin este enlace.",
    e03_footer2: "Correo de seguridad: no se puede desactivar.",
    device_unknown: "Dispositivo desconocido",
    device_connector: "en",
    device_fallback_os: "un dispositivo",
    device_fallback_browser: "un navegador",
    e04_title: "Te agregaron a un equipo",
    e04_preheader: "{ownerName} te dio acceso a {businessName}.",
    e04_heading: "Tienes acceso a {businessName}",
    e04_body:
      "{ownerName} te agregó a su equipo en Gastrometrics. Crea tu propia cuenta con este correo y entras directo al negocio — no compartas contraseñas con nadie.",
    e04_access_label: "Tu acceso",
    e04_label_scope: "Alcance",
    e04_label_modules: "Módulos",
    e04_label_pdfs: "PDFs",
    e04_cta: "Aceptar la invitación",
    e04_footnote: "La invitación vence en 7 días. Solo {ownerName} puede cambiar qué ves o quitar tu acceso.",
    e04_footer2: "Si no conoces a quien te invitó, ignora este correo.",
    e05_title: "Suscripción cancelada",
    e05_preheader: "Perdés {planName} el {accessUntil} si no reactivás antes.",
    e05_heading: "Cancelamos tu suscripción",
    e05_body:
      "Desde el <strong style=\"color:#1A1512\">{accessUntil}</strong> perdés el acceso a <strong style=\"color:#1A1512\">{planName}</strong> y tu cuenta pasa al plan Foodie gratuito. Hasta entonces seguís con todo completo — sin cargos nuevos.",
    e05_fallback_access_until: "el final de tu período ya pagado",
    e05_label_access_until: "Acceso completo hasta",
    e05_label_then: "Después pasas a",
    e05_value_then: "Foodie &middot; Gratis",
    e05_label_next_charge: "Próximo cobro",
    e05_value_none: "Ninguno",
    e05_body2:
      "En Foodie no vas a poder generar PDFs con el costo real de tus platos, y hay límites de cantidad en ingredientes y recetas. <strong style=\"color:#1A1512\">Tus datos no se borran</strong> — fichas, ingredientes, menús e inventario se quedan guardados tal cual están.",
    e05_cta: "Reactivar mi plan",
    e05_footnote: "¿Cancelaste por algo que nos falta? Responde este correo y cuéntanos — lo leemos nosotros, no un bot.",
    e06_title: "Cambio de plan aplicado",
    e06_preheader: "{fromPlan} → {toPlan}, ya activo.",
    e06_body:
      "El cambio ya está aplicado. Se cobró la diferencia proporcional de este mes; desde el próximo ciclo pagas la tarifa completa del plan nuevo.",
    e06_label_before: "Antes",
    e06_label_now: "Ahora",
    e06_unlocked_heading: "Se desbloqueó",
    e06_removed_heading: "Ya no incluye",
    e06_next_charge_prefix: "Próximo cobro",
    e06_body_admin: "Un administrador de GastroMetrics actualizó tu plan. No hubo ningún cobro por este cambio.",
    e06_expires_prefix: "Tu plan vence",
    e06_no_expiry_value: "Sin vencimiento",
    e06_cta: "Ver mi plan",
    e06_footnote: "Puedes bajar de plan cuando quieras desde Mi Plan; nada de lo que ya guardaste se borra.",
    e07_footer2: "Correo automático de activación de tu cuenta Gastrometrics.",
    e07_footnote: "Si no querés recibir este tipo de correos, respondé este mensaje y te sacamos de la lista.",
    e08_subject: "Novedades en Gastrometrics",
    e08_title: "Novedades en Gastrometrics",
    e08_preheader: "Esto es lo que agregamos últimamente",
    e08_heading: "Esto es lo que agregamos últimamente",
    e08_cta: "Ver en Gastrometrics",
    e08_footnote: "Si no querés recibir este correo, desmarcá la casilla en Configuración → Notificaciones dentro de la app.",
    e08_footer2: "Correo de novedades de tu cuenta Gastrometrics.",
    e09_subject: "Tu plan {plan} vence en 3 días",
    e09_title: "Tu plan está por vencer",
    e09_preheader: "{plan} vence el {date} — agrega un método de pago o vuelve al plan gratis.",
    e09_heading: "Tu plan {plan} vence el {date}",
    e09_body: "Un administrador de GastroMetrics te asignó el plan {plan}, con vencimiento el {date}. Cuando llegue esa fecha, tu cuenta vuelve automáticamente al plan gratis (Foodie) y pierdes acceso a las funciones de {plan} — no se borra ningún dato guardado.",
    e09_cta1: "Agregar método de pago",
    e09_cta2: "Cancelar y volver al plan gratis",
    e09_footnote: "Este es un aviso automático — no hace falta responder este correo.",
    e09_footer2: "Recordatorio automático de vencimiento de plan de tu cuenta Gastrometrics.",
    e10_subject: "¿Qué tal ha sido tu experiencia con GastroMetrics?",
    e10_title: "Tu opinión nos importa",
    e10_preheader: "Cuéntanos qué tal te ha ido — toma menos de un minuto.",
    e10_heading: "¿Qué tal ha sido tu experiencia?",
    e10_body: "Ya llevas un buen rato usando GastroMetrics y nos encantaría saber qué tal te ha ido. Déjanos un comentario directo, o si prefieres, contanos en Trustpilot.",
    e10_cta1: "Dejar un comentario",
    e10_cta2: "Dejar una reseña en Trustpilot",
    e10_footnote: "Este es un correo automático — tu comentario lo lee directo el equipo de GastroMetrics.",
    e10_footer2: "Encuesta automática de experiencia de tu cuenta Gastrometrics.",
    e11_subject: "Actualizamos nuestros Términos, Política de Privacidad y Aviso de Responsabilidad",
    e11_title: "Actualizamos nuestros documentos legales",
    e11_preheader: "Nueva versión de los Términos de Uso, la Política de Privacidad y el Aviso de Responsabilidad.",
    e11_heading: "Actualizamos nuestros documentos legales",
    e11_body: "Publicamos una nueva versión de los Términos de Uso, la Política de Privacidad y el Aviso de Responsabilidad de GastroMetrics. Te recomendamos leerlos — puedes encontrarlos siempre desde Configuración dentro de la app. Si seguís usando GastroMetrics después de esta fecha, entendemos que los aceptás.",
    e11_terms_label: "Términos de Uso",
    e11_privacy_label: "Política de Privacidad",
    e11_liability_label: "Aviso de Responsabilidad",
    e11_cta: "Ir a Gastrometrics",
    e11_footnote: "Este es un aviso automático — no hace falta responder este correo.",
    e11_footer2: "Aviso legal de tu cuenta Gastrometrics.",
    e07_reminder_subject: "¿Ya probaste Gastrometrics?",
    e07_reminder_title: "Todavía no cargaste tu primera receta",
    e07_reminder_preheader: "Te toma menos de 5 minutos ver el costo real de un plato.",
    e07_reminder_heading: "¿Le diste una vuelta a Gastrometrics?",
    e07_reminder_body: "Te registraste hace unos días y todavía no cargaste ninguna receta. Cargá un ingrediente y armá una ficha técnica — en menos de 5 minutos vas a ver el costo real y el margen de un plato tuyo, calculados solos.",
    e07_reminder_cta: "Cargar mi primera receta",
    e07_day7_subject: "Tu margen real, una semana después",
    e07_day7_title: "Una semana usando Gastrometrics",
    e07_day7_preheader: "Mirá cómo te está quedando el margen de tus recetas.",
    e07_day7_heading: "Ya llevás una semana con Gastrometrics",
    e07_day7_body: "Es un buen momento para revisar el margen real de tus recetas y ajustar precios si hace falta. Entrá a Reportes para ver el panorama completo de tu costo promedio.",
    e07_day7_cta: "Ver mi margen",
    e07_firstsale_subject: "Registraste tu primera venta",
    e07_firstsale_title: "¡Primera venta registrada!",
    e07_firstsale_preheader: "Así es como Gastrometrics te ayuda a no perder plata sin darte cuenta.",
    e07_firstsale_heading: "Registraste tu primera venta en Gastrometrics",
    e07_firstsale_body: "Cada venta que registrás se compara contra el costo real de la receta — así vas a poder ver, con el tiempo, si tus platos realmente te están dejando la ganancia que pensás. Seguí registrando para que el panorama sea cada vez más preciso.",
    e07_firstsale_cta: "Ver mis reportes",
  },
  en: {
    footer_address: "Gastrometrics &middot; Kitchen costing &middot; Copenhagen, Denmark",
    billing_footer2: "This is a billing email for your account.",
    e01_subject: "Confirm your GastroMetrics account",
    e02_subject: "Reply to your message on GastroMetrics",
    e03_subject: "Reset your GastroMetrics password",
    e04_subject: "{ownerName} invited you to their team on GastroMetrics",
    e05_subject: "We cancelled your subscription",
    e06_subject: "Your plan changed: {fromPlan} → {toPlan}",
    e01_title: "Confirm your email",
    e01_preheader: "One click and your account is active.",
    e01_heading: "One click left, {fullName}",
    e01_body:
      "Your account already exists on the <strong style=\"color:#1A1512\">{planName}</strong> plan. Confirm this is your email and you're in — it's the only thing we use to recover your access if you lose your password.",
    e01_cta: "Confirm my email",
    e01_footnote:
      "This link expires in 24 hours. If you didn't sign up, ignore this email — without confirming, the account never activates.",
    e01_footer2: "This is a service email for your account.",
    e02_title: "Reply to your message",
    e02_preheader: "We already looked into what you sent us.",
    e02_received_prefix: "received on",
    e02_intro: "Thanks for letting us know. Here's what we found:",
    e02_original_label: "Your original message",
    e02_cta: "Open Gastrometrics",
    e02_footnote: "Still happening? Reply to this email and we'll continue on the same thread.",
    e02_footer2: "You received this because you wrote in through the contact form.",
    feedback_type_sugerencia: "Suggestion",
    feedback_type_experiencia: "Experience",
    feedback_type_queja: "Complaint",
    feedback_type_bug: "Bug report",
    feedback_reply_title_sugerencia: "We reviewed your suggestion",
    feedback_reply_title_experiencia: "We saw your comment about your experience",
    feedback_reply_title_queja: "We resolved your report",
    feedback_reply_title_bug: "We fixed the issue",
    e03_title: "Reset your password",
    e03_preheader: "Link valid for 1 hour.",
    e03_heading: "Choose a new password",
    e03_body:
      "Someone requested a password reset for <strong style=\"color:#1A1512\">{email}</strong>. If that was you, continue:",
    e03_cta: "Create new password",
    e03_label_request: "Request",
    e03_label_device: "Device",
    e03_device_admin_requested: "Generated by GastroMetrics support",
    e03_label_expires: "Expires",
    e03_value_expires: "In 1 hour",
    e03_footnote:
      "If you didn't request this change, do nothing: your current password keeps working and no one can get in without this link.",
    e03_footer2: "Security email: this can't be turned off.",
    device_unknown: "Unknown device",
    device_connector: "on",
    device_fallback_os: "a device",
    device_fallback_browser: "a browser",
    e04_title: "You were added to a team",
    e04_preheader: "{ownerName} gave you access to {businessName}.",
    e04_heading: "You have access to {businessName}",
    e04_body:
      "{ownerName} added you to their team on Gastrometrics. Create your own account with this email and you're straight into the business — don't share passwords with anyone.",
    e04_access_label: "Your access",
    e04_label_scope: "Scope",
    e04_label_modules: "Modules",
    e04_label_pdfs: "PDFs",
    e04_cta: "Accept the invitation",
    e04_footnote: "This invitation expires in 7 days. Only {ownerName} can change what you see or remove your access.",
    e04_footer2: "If you don't know who invited you, ignore this email.",
    e05_title: "Subscription cancelled",
    e05_preheader: "You lose {planName} on {accessUntil} if you don't reactivate.",
    e05_heading: "We cancelled your subscription",
    e05_body:
      "From <strong style=\"color:#1A1512\">{accessUntil}</strong> you lose access to <strong style=\"color:#1A1512\">{planName}</strong> and your account moves to the free Foodie plan. Until then everything stays fully active — no new charges.",
    e05_fallback_access_until: "the end of your already-paid period",
    e05_label_access_until: "Full access until",
    e05_label_then: "Then you move to",
    e05_value_then: "Foodie &middot; Free",
    e05_label_next_charge: "Next charge",
    e05_value_none: "None",
    e05_body2:
      "On Foodie you won't be able to generate PDFs with the real cost of your dishes, and there are quantity limits on ingredients and recipes. <strong style=\"color:#1A1512\">Your data isn't deleted</strong> — recipe sheets, ingredients, menus, and inventory stay exactly as they are.",
    e05_cta: "Reactivate my plan",
    e05_footnote: "Cancelled because something's missing? Reply to this email and tell us — a real person reads it, not a bot.",
    e06_title: "Plan change applied",
    e06_preheader: "{fromPlan} → {toPlan}, already active.",
    e06_body:
      "The change is already applied. This month's prorated difference was charged; from the next cycle you'll pay the new plan's full rate.",
    e06_label_before: "Before",
    e06_label_now: "Now",
    e06_unlocked_heading: "Unlocked",
    e06_removed_heading: "No longer included",
    e06_next_charge_prefix: "Next charge",
    e06_body_admin: "A GastroMetrics administrator updated your plan. There was no charge for this change.",
    e06_expires_prefix: "Your plan expires",
    e06_no_expiry_value: "No expiration",
    e06_cta: "View my plan",
    e06_footnote: "You can downgrade anytime from My Plan; nothing you already saved gets deleted.",
    e07_footer2: "Automatic activation email for your Gastrometrics account.",
    e07_footnote: "If you'd rather not get these emails, reply to this message and we'll take you off the list.",
    e08_subject: "What's new in Gastrometrics",
    e08_title: "What's new in Gastrometrics",
    e08_preheader: "Here's what we shipped recently",
    e08_heading: "Here's what we shipped recently",
    e08_cta: "Open Gastrometrics",
    e08_footnote: "If you'd rather not get this email, uncheck the box in Settings → Notifications inside the app.",
    e08_footer2: "Product update email for your Gastrometrics account.",
    e09_subject: "Your {plan} plan expires in 3 days",
    e09_title: "Your plan is about to expire",
    e09_preheader: "{plan} expires on {date} — add a payment method or switch back to the free plan.",
    e09_heading: "Your {plan} plan expires on {date}",
    e09_body: "A GastroMetrics administrator assigned you the {plan} plan, expiring on {date}. When that date arrives, your account automatically returns to the free plan (Foodie) and you lose access to {plan} features — nothing you've saved gets deleted.",
    e09_cta1: "Add a payment method",
    e09_cta2: "Cancel and switch to the free plan",
    e09_footnote: "This is an automatic notice — no need to reply to this email.",
    e09_footer2: "Automatic plan-expiration reminder for your Gastrometrics account.",
    e10_subject: "How has your experience with GastroMetrics been?",
    e10_title: "Your opinion matters to us",
    e10_preheader: "Tell us how it's been going — it takes less than a minute.",
    e10_heading: "How has your experience been?",
    e10_body: "You've been using GastroMetrics for a while now, and we'd love to hear how it's been going. Leave us a comment directly, or if you'd rather, tell us on Trustpilot.",
    e10_cta1: "Leave a comment",
    e10_cta2: "Leave a review on Trustpilot",
    e10_footnote: "This is an automatic email — your comment is read directly by the GastroMetrics team.",
    e10_footer2: "Automatic experience survey for your Gastrometrics account.",
    e11_subject: "We updated our Terms, Privacy Policy, and Liability Disclaimer",
    e11_title: "We updated our legal documents",
    e11_preheader: "New version of the Terms of Use, Privacy Policy, and Liability Disclaimer.",
    e11_heading: "We updated our legal documents",
    e11_body: "We published a new version of GastroMetrics' Terms of Use, Privacy Policy, and Liability Disclaimer. We recommend reading them — you can always find them from Settings inside the app. If you keep using GastroMetrics after this date, we'll understand that you accept them.",
    e11_terms_label: "Terms of Use",
    e11_privacy_label: "Privacy Policy",
    e11_liability_label: "Liability Disclaimer",
    e11_cta: "Go to Gastrometrics",
    e11_footnote: "This is an automatic notice — no need to reply to this email.",
    e11_footer2: "Legal notice for your Gastrometrics account.",
    e07_reminder_subject: "Have you tried Gastrometrics yet?",
    e07_reminder_title: "You haven't loaded your first recipe yet",
    e07_reminder_preheader: "It takes less than 5 minutes to see a dish's real cost.",
    e07_reminder_heading: "Did you get a chance to try Gastrometrics?",
    e07_reminder_body: "You signed up a few days ago and haven't loaded any recipe yet. Add an ingredient and build a recipe sheet — in under 5 minutes you'll see the real cost and margin of one of your dishes, calculated automatically.",
    e07_reminder_cta: "Load my first recipe",
    e07_day7_subject: "Your real margin, one week in",
    e07_day7_title: "One week with Gastrometrics",
    e07_day7_preheader: "See how your recipe margins are looking.",
    e07_day7_heading: "You've been using Gastrometrics for a week",
    e07_day7_body: "It's a good time to check the real margin on your recipes and adjust prices if needed. Head to Reports for the full picture of your average cost.",
    e07_day7_cta: "Check my margin",
    e07_firstsale_subject: "You logged your first sale",
    e07_firstsale_title: "First sale logged!",
    e07_firstsale_preheader: "Here's how Gastrometrics helps you stop losing money without noticing.",
    e07_firstsale_heading: "You logged your first sale in Gastrometrics",
    e07_firstsale_body: "Every sale you log gets compared against the real cost of the recipe — over time you'll be able to see whether your dishes are really leaving you the profit you think they are. Keep logging so the picture gets sharper.",
    e07_firstsale_cta: "See my reports",
  },
  da: {
    footer_address: "Gastrometrics &middot; Køkkenkalkulation &middot; København, Danmark",
    billing_footer2: "Dette er en faktura-e-mail til din konto.",
    e01_subject: "Bekræft din GastroMetrics-konto",
    e02_subject: "Svar på din besked på GastroMetrics",
    e03_subject: "Nulstil din GastroMetrics-adgangskode",
    e04_subject: "{ownerName} inviterede dig til deres team på GastroMetrics",
    e05_subject: "Vi har annulleret dit abonnement",
    e06_subject: "Din plan ændrede sig: {fromPlan} → {toPlan}",
    e01_title: "Bekræft din e-mail",
    e01_preheader: "Et klik, og din konto er aktiv.",
    e01_heading: "Et klik tilbage, {fullName}",
    e01_body:
      "Din konto findes allerede med planen <strong style=\"color:#1A1512\">{planName}</strong>. Bekræft at denne e-mail er din, og du er inde — det er det eneste vi bruger til at gendanne din adgang, hvis du glemmer adgangskoden.",
    e01_cta: "Bekræft min e-mail",
    e01_footnote:
      "Linket udløber om 24 timer. Hvis det ikke var dig, der oprettede kontoen, kan du ignorere denne e-mail — uden bekræftelse aktiveres kontoen aldrig.",
    e01_footer2: "Dette er en service-e-mail til din konto.",
    e02_title: "Svar på din besked",
    e02_preheader: "Vi har allerede kigget på det, du skrev til os.",
    e02_received_prefix: "modtaget den",
    e02_intro: "Tak for at give os besked. Det her fandt vi:",
    e02_original_label: "Din oprindelige besked",
    e02_cta: "Åbn Gastrometrics",
    e02_footnote: "Sker det stadig? Svar på denne e-mail, og vi fortsætter i samme tråd.",
    e02_footer2: "Du fik denne, fordi du skrev via kontaktformularen.",
    feedback_type_sugerencia: "Forslag",
    feedback_type_experiencia: "Oplevelse",
    feedback_type_queja: "Klage",
    feedback_type_bug: "Fejlrapport",
    feedback_reply_title_sugerencia: "Vi har gennemgået dit forslag",
    feedback_reply_title_experiencia: "Vi har set din kommentar om din oplevelse",
    feedback_reply_title_queja: "Vi har løst din sag",
    feedback_reply_title_bug: "Vi har rettet fejlen",
    e03_title: "Nulstil din adgangskode",
    e03_preheader: "Linket er gyldigt i 1 time.",
    e03_heading: "Vælg en ny adgangskode",
    e03_body:
      "Nogen har anmodet om at nulstille adgangskoden for <strong style=\"color:#1A1512\">{email}</strong>. Hvis det var dig, så fortsæt:",
    e03_cta: "Opret ny adgangskode",
    e03_label_request: "Anmodning",
    e03_label_device: "Enhed",
    e03_device_admin_requested: "Genereret af GastroMetrics-support",
    e03_label_expires: "Udløber",
    e03_value_expires: "Om 1 time",
    e03_footnote:
      "Hvis du ikke har anmodet om denne ændring, skal du ikke gøre noget: din nuværende adgangskode virker stadig, og ingen kan logge ind uden dette link.",
    e03_footer2: "Sikkerheds-e-mail: kan ikke slås fra.",
    device_unknown: "Ukendt enhed",
    device_connector: "på",
    device_fallback_os: "en enhed",
    device_fallback_browser: "en browser",
    e04_title: "Du blev tilføjet til et team",
    e04_preheader: "{ownerName} gav dig adgang til {businessName}.",
    e04_heading: "Du har adgang til {businessName}",
    e04_body:
      "{ownerName} tilføjede dig til deres team på Gastrometrics. Opret din egen konto med denne e-mail, og du kommer direkte ind i virksomheden — del ikke adgangskoder med nogen.",
    e04_access_label: "Din adgang",
    e04_label_scope: "Omfang",
    e04_label_modules: "Moduler",
    e04_label_pdfs: "PDF'er",
    e04_cta: "Accepter invitationen",
    e04_footnote: "Invitationen udløber om 7 dage. Kun {ownerName} kan ændre, hvad du ser, eller fjerne din adgang.",
    e04_footer2: "Hvis du ikke kender den, der inviterede dig, kan du ignorere denne e-mail.",
    e05_title: "Abonnement annulleret",
    e05_preheader: "Du mister {planName} den {accessUntil}, hvis du ikke genaktiverer.",
    e05_heading: "Vi har annulleret dit abonnement",
    e05_body:
      "Fra <strong style=\"color:#1A1512\">{accessUntil}</strong> mister du adgangen til <strong style=\"color:#1A1512\">{planName}</strong>, og kontoen skifter til den gratis Foodie-plan. Indtil da forbliver alt fuldt aktivt — ingen nye opkrævninger.",
    e05_fallback_access_until: "slutningen af din allerede betalte periode",
    e05_label_access_until: "Fuld adgang indtil",
    e05_label_then: "Derefter skifter du til",
    e05_value_then: "Foodie &middot; Gratis",
    e05_label_next_charge: "Næste opkrævning",
    e05_value_none: "Ingen",
    e05_body2:
      "På Foodie kan du ikke længere generere PDF'er med den reelle omkostning for dine retter, og der er mængdebegrænsninger på ingredienser og opskrifter. <strong style=\"color:#1A1512\">Dine data bliver ikke slettet</strong> — opskrifter, ingredienser, menuer og lager forbliver præcis som de er.",
    e05_cta: "Genaktiver min plan",
    e05_footnote: "Annullerede du på grund af noget, vi mangler? Svar på denne e-mail og fortæl os det — en rigtig person læser den, ikke en bot.",
    e06_title: "Planændring udført",
    e06_preheader: "{fromPlan} → {toPlan}, allerede aktiv.",
    e06_body:
      "Ændringen er allerede udført. Den forholdsmæssige forskel for denne måned blev opkrævet; fra næste cyklus betaler du den nye plans fulde pris.",
    e06_label_before: "Før",
    e06_label_now: "Nu",
    e06_unlocked_heading: "Låst op",
    e06_removed_heading: "Ikke længere inkluderet",
    e06_next_charge_prefix: "Næste opkrævning",
    e06_body_admin: "En GastroMetrics-administrator opdaterede din plan. Der var ingen opkrævning for denne ændring.",
    e06_expires_prefix: "Din plan udløber",
    e06_no_expiry_value: "Intet udløb",
    e06_cta: "Se min plan",
    e06_footnote: "Du kan nedgradere når du vil fra Min Plan; intet af det, du allerede har gemt, bliver slettet.",
    e07_footer2: "Automatisk aktiveringsmail til din Gastrometrics-konto.",
    e07_footnote: "Hvis du hellere vil undvære denne slags e-mails, så svar på denne besked, og vi fjerner dig fra listen.",
    e08_subject: "Nyheder i Gastrometrics",
    e08_title: "Nyheder i Gastrometrics",
    e08_preheader: "Det her har vi tilføjet på det seneste",
    e08_heading: "Det her har vi tilføjet på det seneste",
    e08_cta: "Åbn Gastrometrics",
    e08_footnote: "Hvis du hellere vil undvære denne e-mail, så fjern fluebenet under Indstillinger → Notifikationer i appen.",
    e08_footer2: "Produktnyheds-mail til din Gastrometrics-konto.",
    e09_subject: "Din {plan}-plan udløber om 3 dage",
    e09_title: "Din plan er ved at udløbe",
    e09_preheader: "{plan} udløber den {date} — tilføj en betalingsmetode, eller skift tilbage til den gratis plan.",
    e09_heading: "Din {plan}-plan udløber den {date}",
    e09_body: "En GastroMetrics-administrator gav dig planen {plan}, med udløb den {date}. Når den dato kommer, går din konto automatisk tilbage til den gratis plan (Foodie), og du mister adgang til {plan}-funktionerne — intet af det, du har gemt, bliver slettet.",
    e09_cta1: "Tilføj en betalingsmetode",
    e09_cta2: "Annuller og skift til den gratis plan",
    e09_footnote: "Dette er en automatisk besked — du behøver ikke svare på denne e-mail.",
    e09_footer2: "Automatisk påmindelse om planudløb for din Gastrometrics-konto.",
    e10_subject: "Hvordan har din oplevelse med GastroMetrics været?",
    e10_title: "Din mening betyder noget for os",
    e10_preheader: "Fortæl os, hvordan det er gået — det tager under et minut.",
    e10_heading: "Hvordan har din oplevelse været?",
    e10_body: "Du har nu brugt GastroMetrics et stykke tid, og vi vil meget gerne høre, hvordan det er gået. Efterlad en kommentar direkte til os, eller fortæl os det på Trustpilot, hvis du hellere vil det.",
    e10_cta1: "Efterlad en kommentar",
    e10_cta2: "Skriv en anmeldelse på Trustpilot",
    e10_footnote: "Dette er en automatisk e-mail — din kommentar læses direkte af GastroMetrics-teamet.",
    e10_footer2: "Automatisk oplevelsesundersøgelse for din Gastrometrics-konto.",
    e11_subject: "Vi har opdateret vores Vilkår, Privatlivspolitik og Ansvarsfraskrivelse",
    e11_title: "Vi har opdateret vores juridiske dokumenter",
    e11_preheader: "Ny version af Servicevilkårene, Privatlivspolitikken og Ansvarsfraskrivelsen.",
    e11_heading: "Vi har opdateret vores juridiske dokumenter",
    e11_body: "Vi har offentliggjort en ny version af GastroMetrics' Servicevilkår, Privatlivspolitik og Ansvarsfraskrivelse. Vi anbefaler, at du læser dem — du kan altid finde dem under Indstillinger i app'en. Hvis du fortsætter med at bruge GastroMetrics efter denne dato, går vi ud fra, at du accepterer dem.",
    e11_terms_label: "Servicevilkår",
    e11_privacy_label: "Privatlivspolitik",
    e11_liability_label: "Ansvarsfraskrivelse",
    e11_cta: "Gå til Gastrometrics",
    e11_footnote: "Dette er en automatisk besked — du behøver ikke svare på denne e-mail.",
    e11_footer2: "Juridisk meddelelse for din Gastrometrics-konto.",
    e07_reminder_subject: "Har du prøvet Gastrometrics endnu?",
    e07_reminder_title: "Du har endnu ikke indlæst din første opskrift",
    e07_reminder_preheader: "Det tager under 5 minutter at se en rets reelle omkostning.",
    e07_reminder_heading: "Fik du prøvet Gastrometrics?",
    e07_reminder_body: "Du oprettede din konto for nogle dage siden og har endnu ikke indlæst nogen opskrift. Tilføj en ingrediens og byg en opskrift — på under 5 minutter ser du den reelle omkostning og avance for en af dine retter, beregnet automatisk.",
    e07_reminder_cta: "Indlæs min første opskrift",
    e07_day7_subject: "Din reelle avance, en uge efter",
    e07_day7_title: "En uge med Gastrometrics",
    e07_day7_preheader: "Se hvordan avancen på dine opskrifter ser ud.",
    e07_day7_heading: "Du har brugt Gastrometrics i en uge nu",
    e07_day7_body: "Det er et godt tidspunkt at tjekke den reelle avance på dine opskrifter og justere priser om nødvendigt. Gå til Rapporter for det fulde overblik over din gennemsnitlige omkostning.",
    e07_day7_cta: "Se min avance",
    e07_firstsale_subject: "Du registrerede dit første salg",
    e07_firstsale_title: "Første salg registreret!",
    e07_firstsale_preheader: "Sådan hjælper Gastrometrics dig med at stoppe med at tabe penge uden at vide det.",
    e07_firstsale_heading: "Du registrerede dit første salg i Gastrometrics",
    e07_firstsale_body: "Hvert salg du registrerer, bliver sammenlignet med opskriftens reelle omkostning — over tid kan du se, om dine retter faktisk giver den fortjeneste, du tror. Bliv ved med at registrere, så billedet bliver skarpere.",
    e07_firstsale_cta: "Se mine rapporter",
  },
  fr: {
    footer_address: "Gastrometrics &middot; Calcul des coûts de cuisine &middot; Copenhague, Danemark",
    billing_footer2: "Ceci est un e-mail de facturation pour ton compte.",
    e01_subject: "Confirme ton compte GastroMetrics",
    e02_subject: "Réponse à ton message sur GastroMetrics",
    e03_subject: "Réinitialise ton mot de passe GastroMetrics",
    e04_subject: "{ownerName} t'a invité dans son équipe sur GastroMetrics",
    e05_subject: "On a annulé ton abonnement",
    e06_subject: "Ton plan a changé : {fromPlan} → {toPlan}",
    e01_title: "Confirme ton e-mail",
    e01_preheader: "Un clic et ton compte est actif.",
    e01_heading: "Encore un clic, {fullName}",
    e01_body:
      "Ton compte existe déjà avec le plan <strong style=\"color:#1A1512\">{planName}</strong>. Confirme que cet e-mail est bien le tien et tu es prêt — c'est la seule chose qu'on utilise pour récupérer ton accès si tu perds ton mot de passe.",
    e01_cta: "Confirmer mon e-mail",
    e01_footnote:
      "Ce lien expire dans 24 heures. Si tu n'es pas à l'origine de cette inscription, ignore cet e-mail — sans confirmation, le compte ne s'active jamais.",
    e01_footer2: "Ceci est un e-mail de service pour ton compte.",
    e02_title: "Réponse à ton message",
    e02_preheader: "On a déjà regardé ce que tu nous as écrit.",
    e02_received_prefix: "reçu le",
    e02_intro: "Merci de nous avoir prévenus. Voici ce qu'on a trouvé :",
    e02_original_label: "Ton message d'origine",
    e02_cta: "Ouvrir Gastrometrics",
    e02_footnote: "Ça continue ? Réponds à cet e-mail et on continue dans le même fil.",
    e02_footer2: "Tu as reçu ceci parce que tu as écrit via le formulaire de contact.",
    feedback_type_sugerencia: "Suggestion",
    feedback_type_experiencia: "Expérience",
    feedback_type_queja: "Réclamation",
    feedback_type_bug: "Signalement de bug",
    feedback_reply_title_sugerencia: "On a examiné ta suggestion",
    feedback_reply_title_experiencia: "On a vu ton commentaire sur ton expérience",
    feedback_reply_title_queja: "On a résolu ton signalement",
    feedback_reply_title_bug: "On a corrigé le problème",
    e03_title: "Réinitialise ton mot de passe",
    e03_preheader: "Lien valable 1 heure.",
    e03_heading: "Choisis un nouveau mot de passe",
    e03_body:
      "Quelqu'un a demandé la réinitialisation du mot de passe de <strong style=\"color:#1A1512\">{email}</strong>. Si c'était toi, continue :",
    e03_cta: "Créer un nouveau mot de passe",
    e03_label_request: "Demande",
    e03_label_device: "Appareil",
    e03_device_admin_requested: "Généré par le support GastroMetrics",
    e03_label_expires: "Expire",
    e03_value_expires: "Dans 1 heure",
    e03_footnote:
      "Si tu n'as pas demandé ce changement, ne fais rien : ton mot de passe actuel continue de fonctionner et personne ne peut se connecter sans ce lien.",
    e03_footer2: "E-mail de sécurité : ne peut pas être désactivé.",
    device_unknown: "Appareil inconnu",
    device_connector: "sur",
    device_fallback_os: "un appareil",
    device_fallback_browser: "un navigateur",
    e04_title: "Tu as été ajouté à une équipe",
    e04_preheader: "{ownerName} t'a donné accès à {businessName}.",
    e04_heading: "Tu as accès à {businessName}",
    e04_body:
      "{ownerName} t'a ajouté à son équipe sur Gastrometrics. Crée ton propre compte avec cet e-mail et tu entres directement dans l'entreprise — ne partage de mot de passe avec personne.",
    e04_access_label: "Ton accès",
    e04_label_scope: "Périmètre",
    e04_label_modules: "Modules",
    e04_label_pdfs: "PDF",
    e04_cta: "Accepter l'invitation",
    e04_footnote: "Cette invitation expire dans 7 jours. Seul {ownerName} peut changer ce que tu vois ou retirer ton accès.",
    e04_footer2: "Si tu ne connais pas la personne qui t'a invité, ignore cet e-mail.",
    e05_title: "Abonnement annulé",
    e05_preheader: "Tu perds {planName} le {accessUntil} si tu ne réactives pas.",
    e05_heading: "On a annulé ton abonnement",
    e05_body:
      "À partir du <strong style=\"color:#1A1512\">{accessUntil}</strong>, tu perds l'accès à <strong style=\"color:#1A1512\">{planName}</strong> et ton compte passe au plan gratuit Foodie. D'ici là, tout reste complet — aucun nouveau prélèvement.",
    e05_fallback_access_until: "la fin de ta période déjà payée",
    e05_label_access_until: "Accès complet jusqu'au",
    e05_label_then: "Ensuite tu passes à",
    e05_value_then: "Foodie &middot; Gratuit",
    e05_label_next_charge: "Prochain prélèvement",
    e05_value_none: "Aucun",
    e05_body2:
      "Sur Foodie, tu ne pourras plus générer de PDF avec le coût réel de tes plats, et il y a des limites de quantité sur les ingrédients et les recettes. <strong style=\"color:#1A1512\">Tes données ne sont pas supprimées</strong> — fiches techniques, ingrédients, menus et inventaire restent exactement tels quels.",
    e05_cta: "Réactiver mon plan",
    e05_footnote: "Tu as annulé pour quelque chose qui nous manque ? Réponds à cet e-mail et dis-le-nous — une vraie personne le lit, pas un robot.",
    e06_title: "Changement de plan appliqué",
    e06_preheader: "{fromPlan} → {toPlan}, déjà actif.",
    e06_body:
      "Le changement est déjà appliqué. La différence proportionnelle de ce mois a été prélevée ; à partir du prochain cycle tu payes le tarif complet du nouveau plan.",
    e06_label_before: "Avant",
    e06_label_now: "Maintenant",
    e06_unlocked_heading: "Débloqué",
    e06_removed_heading: "N'est plus inclus",
    e06_next_charge_prefix: "Prochain prélèvement",
    e06_body_admin: "Un administrateur de GastroMetrics a mis à jour ton plan. Aucun prélèvement n'a été effectué pour ce changement.",
    e06_expires_prefix: "Ton plan expire",
    e06_no_expiry_value: "Sans expiration",
    e06_cta: "Voir mon plan",
    e06_footnote: "Tu peux rétrograder quand tu veux depuis Mon Plan ; rien de ce que tu as déjà enregistré n'est supprimé.",
    e07_footer2: "E-mail automatique d'activation de ton compte Gastrometrics.",
    e07_footnote: "Si tu préfères ne plus recevoir ce type d'e-mails, réponds à ce message et on te retire de la liste.",
    e08_subject: "Nouveautés de Gastrometrics",
    e08_title: "Nouveautés de Gastrometrics",
    e08_preheader: "Voici ce qu'on a ajouté récemment",
    e08_heading: "Voici ce qu'on a ajouté récemment",
    e08_cta: "Ouvrir Gastrometrics",
    e08_footnote: "Si tu préfères ne plus recevoir cet e-mail, décoche la case dans Paramètres → Notifications dans l'application.",
    e08_footer2: "E-mail de nouveautés pour ton compte Gastrometrics.",
    e09_subject: "Ton plan {plan} expire dans 3 jours",
    e09_title: "Ton plan est sur le point d'expirer",
    e09_preheader: "{plan} expire le {date} — ajoute un moyen de paiement ou repasse au plan gratuit.",
    e09_heading: "Ton plan {plan} expire le {date}",
    e09_body: "Un administrateur de GastroMetrics t'a attribué le plan {plan}, avec expiration le {date}. À cette date, ton compte repasse automatiquement au plan gratuit (Foodie) et tu perds l'accès aux fonctionnalités de {plan} — rien de ce que tu as déjà enregistré n'est supprimé.",
    e09_cta1: "Ajouter un moyen de paiement",
    e09_cta2: "Annuler et repasser au plan gratuit",
    e09_footnote: "Ceci est un avis automatique — inutile de répondre à cet e-mail.",
    e09_footer2: "Rappel automatique d'expiration de plan pour ton compte Gastrometrics.",
    e10_subject: "Comment s'est passée ton expérience avec GastroMetrics ?",
    e10_title: "Ton avis compte pour nous",
    e10_preheader: "Dis-nous comment ça s'est passé — ça prend moins d'une minute.",
    e10_heading: "Comment s'est passée ton expérience ?",
    e10_body: "Tu utilises GastroMetrics depuis un bon moment maintenant, et on aimerait savoir comment ça s'est passé. Laisse-nous un commentaire directement, ou si tu préfères, dis-le-nous sur Trustpilot.",
    e10_cta1: "Laisser un commentaire",
    e10_cta2: "Laisser un avis sur Trustpilot",
    e10_footnote: "Ceci est un e-mail automatique — ton commentaire est lu directement par l'équipe GastroMetrics.",
    e10_footer2: "Enquête automatique d'expérience pour ton compte Gastrometrics.",
    e11_subject: "Nous avons mis à jour nos Conditions, notre Politique de confidentialité et notre Avis de non-responsabilité",
    e11_title: "Nous avons mis à jour nos documents légaux",
    e11_preheader: "Nouvelle version des Conditions d'utilisation, de la Politique de confidentialité et de l'Avis de non-responsabilité.",
    e11_heading: "Nous avons mis à jour nos documents légaux",
    e11_body: "Nous avons publié une nouvelle version des Conditions d'utilisation, de la Politique de confidentialité et de l'Avis de non-responsabilité de GastroMetrics. Nous te recommandons de les lire — tu peux toujours les retrouver depuis Paramètres dans l'application. Si tu continues à utiliser GastroMetrics après cette date, nous considérerons que tu les acceptes.",
    e11_terms_label: "Conditions d'utilisation",
    e11_privacy_label: "Politique de confidentialité",
    e11_liability_label: "Avis de non-responsabilité",
    e11_cta: "Aller sur Gastrometrics",
    e11_footnote: "Ceci est un avis automatique — inutile de répondre à cet e-mail.",
    e11_footer2: "Avis légal pour ton compte Gastrometrics.",
    e07_reminder_subject: "As-tu déjà essayé Gastrometrics ?",
    e07_reminder_title: "Tu n'as pas encore chargé ta première recette",
    e07_reminder_preheader: "Ça prend moins de 5 minutes pour voir le coût réel d'un plat.",
    e07_reminder_heading: "As-tu eu l'occasion d'essayer Gastrometrics ?",
    e07_reminder_body: "Tu t'es inscrit il y a quelques jours et tu n'as pas encore chargé de recette. Ajoute un ingrédient et construis une fiche technique — en moins de 5 minutes tu vas voir le coût réel et la marge d'un de tes plats, calculés automatiquement.",
    e07_reminder_cta: "Charger ma première recette",
    e07_day7_subject: "Ta marge réelle, une semaine après",
    e07_day7_title: "Une semaine avec Gastrometrics",
    e07_day7_preheader: "Regarde à quoi ressemble la marge de tes recettes.",
    e07_day7_heading: "Ça fait une semaine que tu utilises Gastrometrics",
    e07_day7_body: "C'est le bon moment pour vérifier la marge réelle de tes recettes et ajuster les prix si besoin. Va dans Rapports pour voir le panorama complet de ton coût moyen.",
    e07_day7_cta: "Voir ma marge",
    e07_firstsale_subject: "Tu as enregistré ta première vente",
    e07_firstsale_title: "Première vente enregistrée !",
    e07_firstsale_preheader: "Voici comment Gastrometrics t'aide à arrêter de perdre de l'argent sans t'en rendre compte.",
    e07_firstsale_heading: "Tu as enregistré ta première vente dans Gastrometrics",
    e07_firstsale_body: "Chaque vente que tu enregistres est comparée au coût réel de la recette — avec le temps, tu pourras voir si tes plats te laissent vraiment la marge que tu penses. Continue à enregistrer pour affiner le panorama.",
    e07_firstsale_cta: "Voir mes rapports",
  },
  pt: {
    footer_address: "Gastrometrics &middot; Custeio de cozinha &middot; Copenhague, Dinamarca",
    billing_footer2: "Este é um e-mail de cobrança da sua conta.",
    e01_subject: "Confirme sua conta no GastroMetrics",
    e02_subject: "Resposta à sua mensagem no GastroMetrics",
    e03_subject: "Redefina sua senha do GastroMetrics",
    e04_subject: "{ownerName} te convidou para a equipe dele no GastroMetrics",
    e05_subject: "Cancelamos sua assinatura",
    e06_subject: "Seu plano mudou: {fromPlan} → {toPlan}",
    e01_title: "Confirme seu e-mail",
    e01_preheader: "Um clique e sua conta fica ativa.",
    e01_heading: "Falta um clique, {fullName}",
    e01_body:
      "Sua conta já existe com o plano <strong style=\"color:#1A1512\">{planName}</strong>. Confirme que este e-mail é seu e você já está dentro — é a única coisa que usamos para recuperar seu acesso se você perder a senha.",
    e01_cta: "Confirmar meu e-mail",
    e01_footnote:
      "O link expira em 24 horas. Se não foi você quem se registrou, ignore este e-mail — sem confirmar, a conta nunca é ativada.",
    e01_footer2: "Este é um e-mail de serviço da sua conta.",
    e02_title: "Resposta à sua mensagem",
    e02_preheader: "Já revisamos o que você nos escreveu.",
    e02_received_prefix: "recebido em",
    e02_intro: "Obrigado por avisar. Foi isso que encontramos:",
    e02_original_label: "Sua mensagem original",
    e02_cta: "Abrir Gastrometrics",
    e02_footnote: "Continua acontecendo? Responda este e-mail e continuamos na mesma conversa.",
    e02_footer2: "Você recebeu isso porque escreveu pelo formulário de contato.",
    feedback_type_sugerencia: "Sugestão",
    feedback_type_experiencia: "Experiência",
    feedback_type_queja: "Reclamação",
    feedback_type_bug: "Relato de erro",
    feedback_reply_title_sugerencia: "Revisamos sua sugestão",
    feedback_reply_title_experiencia: "Vimos seu comentário sobre sua experiência",
    feedback_reply_title_queja: "Já resolvemos sua reclamação",
    feedback_reply_title_bug: "Já corrigimos o problema",
    e03_title: "Redefina sua senha",
    e03_preheader: "Link válido por 1 hora.",
    e03_heading: "Escolha uma nova senha",
    e03_body:
      "Alguém pediu para redefinir a senha de <strong style=\"color:#1A1512\">{email}</strong>. Se foi você, continue:",
    e03_cta: "Criar nova senha",
    e03_label_request: "Solicitação",
    e03_label_device: "Dispositivo",
    e03_device_admin_requested: "Gerado pelo suporte da GastroMetrics",
    e03_label_expires: "Expira",
    e03_value_expires: "Em 1 hora",
    e03_footnote:
      "Se você não pediu essa mudança, não faça nada: sua senha atual continua funcionando e ninguém pode entrar sem este link.",
    e03_footer2: "E-mail de segurança: não pode ser desativado.",
    device_unknown: "Dispositivo desconhecido",
    device_connector: "no",
    device_fallback_os: "um dispositivo",
    device_fallback_browser: "um navegador",
    e04_title: "Você foi adicionado a uma equipe",
    e04_preheader: "{ownerName} te deu acesso a {businessName}.",
    e04_heading: "Você tem acesso a {businessName}",
    e04_body:
      "{ownerName} te adicionou à equipe dele no Gastrometrics. Crie sua própria conta com este e-mail e você entra direto no negócio — não compartilhe senhas com ninguém.",
    e04_access_label: "Seu acesso",
    e04_label_scope: "Alcance",
    e04_label_modules: "Módulos",
    e04_label_pdfs: "PDFs",
    e04_cta: "Aceitar o convite",
    e04_footnote: "O convite expira em 7 dias. Só {ownerName} pode mudar o que você vê ou remover seu acesso.",
    e04_footer2: "Se você não conhece quem te convidou, ignore este e-mail.",
    e05_title: "Assinatura cancelada",
    e05_preheader: "Você perde o {planName} em {accessUntil} se não reativar.",
    e05_heading: "Cancelamos sua assinatura",
    e05_body:
      "A partir de <strong style=\"color:#1A1512\">{accessUntil}</strong> você perde o acesso ao <strong style=\"color:#1A1512\">{planName}</strong> e sua conta passa para o plano gratuito Foodie. Até lá, tudo continua completo — sem novas cobranças.",
    e05_fallback_access_until: "o fim do seu período já pago",
    e05_label_access_until: "Acesso completo até",
    e05_label_then: "Depois você passa para",
    e05_value_then: "Foodie &middot; Grátis",
    e05_label_next_charge: "Próxima cobrança",
    e05_value_none: "Nenhuma",
    e05_body2:
      "No Foodie você não vai conseguir gerar PDFs com o custo real dos seus pratos, e há limites de quantidade em ingredientes e receitas. <strong style=\"color:#1A1512\">Seus dados não são apagados</strong> — fichas técnicas, ingredientes, menus e estoque continuam exatamente como estão.",
    e05_cta: "Reativar meu plano",
    e05_footnote: "Cancelou por algo que está faltando? Responda este e-mail e nos conte — uma pessoa real lê, não um robô.",
    e06_title: "Mudança de plano aplicada",
    e06_preheader: "{fromPlan} → {toPlan}, já ativo.",
    e06_body:
      "A mudança já foi aplicada. Foi cobrada a diferença proporcional deste mês; a partir do próximo ciclo você paga a tarifa completa do novo plano.",
    e06_label_before: "Antes",
    e06_label_now: "Agora",
    e06_unlocked_heading: "Foi desbloqueado",
    e06_removed_heading: "Não está mais incluído",
    e06_next_charge_prefix: "Próxima cobrança",
    e06_body_admin: "Um administrador da GastroMetrics atualizou seu plano. Não houve cobrança por essa mudança.",
    e06_expires_prefix: "Seu plano vence em",
    e06_no_expiry_value: "Sem vencimento",
    e06_cta: "Ver meu plano",
    e06_footnote: "Você pode fazer downgrade quando quiser em Meu Plano; nada do que você já salvou é apagado.",
    e07_footer2: "E-mail automático de ativação da sua conta Gastrometrics.",
    e07_footnote: "Se você não quiser mais receber esse tipo de e-mail, responda esta mensagem e nós te tiramos da lista.",
    e08_subject: "Novidades no Gastrometrics",
    e08_title: "Novidades no Gastrometrics",
    e08_preheader: "Veja o que adicionamos recentemente",
    e08_heading: "Veja o que adicionamos recentemente",
    e08_cta: "Abrir o Gastrometrics",
    e08_footnote: "Se você não quiser mais receber este e-mail, desmarque a caixa em Configurações → Notificações dentro do app.",
    e08_footer2: "E-mail de novidades da sua conta Gastrometrics.",
    e09_subject: "Seu plano {plan} vence em 3 dias",
    e09_title: "Seu plano está prestes a vencer",
    e09_preheader: "{plan} vence em {date} — adicione um método de pagamento ou volte para o plano gratuito.",
    e09_heading: "Seu plano {plan} vence em {date}",
    e09_body: "Um administrador da GastroMetrics te atribuiu o plano {plan}, com vencimento em {date}. Quando essa data chegar, sua conta volta automaticamente para o plano gratuito (Foodie) e você perde o acesso aos recursos do {plan} — nada do que você já salvou é apagado.",
    e09_cta1: "Adicionar método de pagamento",
    e09_cta2: "Cancelar e voltar ao plano gratuito",
    e09_footnote: "Este é um aviso automático — não é necessário responder a este e-mail.",
    e09_footer2: "Lembrete automático de vencimento de plano da sua conta Gastrometrics.",
    e10_subject: "Como tem sido sua experiência com o GastroMetrics?",
    e10_title: "Sua opinião é importante para nós",
    e10_preheader: "Conte para a gente como está sendo — leva menos de um minuto.",
    e10_heading: "Como tem sido sua experiência?",
    e10_body: "Você já está usando o GastroMetrics há um tempo, e adoraríamos saber como está sendo. Deixe um comentário direto para a gente, ou, se preferir, conte para a gente no Trustpilot.",
    e10_cta1: "Deixar um comentário",
    e10_cta2: "Deixar uma avaliação no Trustpilot",
    e10_footnote: "Este é um e-mail automático — seu comentário é lido diretamente pela equipe do GastroMetrics.",
    e10_footer2: "Pesquisa automática de experiência da sua conta Gastrometrics.",
    e11_subject: "Atualizamos nossos Termos, Política de Privacidade e Aviso de Responsabilidade",
    e11_title: "Atualizamos nossos documentos legais",
    e11_preheader: "Nova versão dos Termos de Uso, da Política de Privacidade e do Aviso de Responsabilidade.",
    e11_heading: "Atualizamos nossos documentos legais",
    e11_body: "Publicamos uma nova versão dos Termos de Uso, da Política de Privacidade e do Aviso de Responsabilidade da GastroMetrics. Recomendamos que você os leia — você sempre pode encontrá-los em Configurações dentro do aplicativo. Se você continuar usando o GastroMetrics após esta data, entenderemos que você os aceita.",
    e11_terms_label: "Termos de Uso",
    e11_privacy_label: "Política de Privacidade",
    e11_liability_label: "Aviso de Responsabilidade",
    e11_cta: "Ir para o Gastrometrics",
    e11_footnote: "Este é um aviso automático — não é necessário responder a este e-mail.",
    e11_footer2: "Aviso legal da sua conta Gastrometrics.",
    e07_reminder_subject: "Você já experimentou o Gastrometrics?",
    e07_reminder_title: "Você ainda não carregou sua primeira receita",
    e07_reminder_preheader: "Leva menos de 5 minutos para ver o custo real de um prato.",
    e07_reminder_heading: "Você chegou a experimentar o Gastrometrics?",
    e07_reminder_body: "Você se cadastrou há alguns dias e ainda não carregou nenhuma receita. Adicione um ingrediente e monte uma ficha técnica — em menos de 5 minutos você vai ver o custo real e a margem de um dos seus pratos, calculados automaticamente.",
    e07_reminder_cta: "Carregar minha primeira receita",
    e07_day7_subject: "Sua margem real, uma semana depois",
    e07_day7_title: "Uma semana com o Gastrometrics",
    e07_day7_preheader: "Veja como está a margem das suas receitas.",
    e07_day7_heading: "Você já usa o Gastrometrics há uma semana",
    e07_day7_body: "É um bom momento para revisar a margem real das suas receitas e ajustar preços se precisar. Vá até Relatórios para ver o panorama completo do seu custo médio.",
    e07_day7_cta: "Ver minha margem",
    e07_firstsale_subject: "Você registrou sua primeira venda",
    e07_firstsale_title: "Primeira venda registrada!",
    e07_firstsale_preheader: "Veja como o Gastrometrics te ajuda a parar de perder dinheiro sem perceber.",
    e07_firstsale_heading: "Você registrou sua primeira venda no Gastrometrics",
    e07_firstsale_body: "Cada venda que você registra é comparada com o custo real da receita — com o tempo você vai poder ver se seus pratos realmente deixam o lucro que você imagina. Continue registrando para que o panorama fique cada vez mais preciso.",
    e07_firstsale_cta: "Ver meus relatórios",
  },
  zh: {
    footer_address: "Gastrometrics &middot; 厨房成本核算 &middot; 丹麦哥本哈根",
    billing_footer2: "这是您账户的账单邮件。",
    e01_subject: "确认您的 GastroMetrics 账户",
    e02_subject: "GastroMetrics 留言回复",
    e03_subject: "重置您的 GastroMetrics 密码",
    e04_subject: "{ownerName} 邀请您加入 GastroMetrics 团队",
    e05_subject: "我们已取消您的订阅",
    e06_subject: "您的套餐已变更：{fromPlan} → {toPlan}",
    e01_title: "确认您的邮箱",
    e01_preheader: "点击一下，账户即可激活。",
    e01_heading: "还差一步，{fullName}",
    e01_body:
      "您的账户已创建，套餐为<strong style=\"color:#1A1512\">{planName}</strong>。确认这是您的邮箱即可完成激活——如果您忘记密码，我们也只会用这个邮箱来找回账户。",
    e01_cta: "确认我的邮箱",
    e01_footnote: "此链接 24 小时后失效。如果不是您本人注册的，请忽略此邮件——不确认，账户将不会激活。",
    e01_footer2: "这是您账户的服务邮件。",
    e02_title: "回复您的留言",
    e02_preheader: "我们已经查看了您反馈的内容。",
    e02_received_prefix: "收到于",
    e02_intro: "感谢您的反馈，以下是我们的处理结果：",
    e02_original_label: "您的原始留言",
    e02_cta: "打开 Gastrometrics",
    e02_footnote: "问题还在继续吗？回复这封邮件，我们会在同一对话中继续处理。",
    e02_footer2: "您收到此邮件是因为您通过联系表单提交了留言。",
    feedback_type_sugerencia: "建议",
    feedback_type_experiencia: "体验",
    feedback_type_queja: "投诉",
    feedback_type_bug: "问题报告",
    feedback_reply_title_sugerencia: "我们已查看您的建议",
    feedback_reply_title_experiencia: "我们已查看您关于使用体验的留言",
    feedback_reply_title_queja: "我们已处理您的投诉",
    feedback_reply_title_bug: "我们已修复该问题",
    e03_title: "重置您的密码",
    e03_preheader: "链接有效期为 1 小时。",
    e03_heading: "设置新密码",
    e03_body: "有人请求重置 <strong style=\"color:#1A1512\">{email}</strong> 的密码。如果是您本人操作，请继续：",
    e03_cta: "创建新密码",
    e03_label_request: "请求时间",
    e03_label_device: "设备",
    e03_device_admin_requested: "由 GastroMetrics 支持团队生成",
    e03_label_expires: "有效期至",
    e03_value_expires: "1 小时内",
    e03_footnote: "如果您没有请求此操作，无需任何操作：您当前的密码仍然有效，没有此链接任何人都无法登录。",
    e03_footer2: "安全邮件：无法关闭此类通知。",
    device_unknown: "未知设备",
    device_connector: "，系统为",
    device_fallback_os: "某设备",
    device_fallback_browser: "某浏览器",
    e04_title: "您已被加入团队",
    e04_preheader: "{ownerName} 授予了您访问 {businessName} 的权限。",
    e04_heading: "您已获得 {businessName} 的访问权限",
    e04_body:
      "{ownerName} 已将您加入他们在 Gastrometrics 的团队。用这个邮箱创建您自己的账户，即可直接进入该商家——请不要与任何人分享密码。",
    e04_access_label: "您的权限",
    e04_label_scope: "范围",
    e04_label_modules: "模块",
    e04_label_pdfs: "PDF",
    e04_cta: "接受邀请",
    e04_footnote: "此邀请 7 天后失效。只有 {ownerName} 可以更改您能看到的内容或取消您的访问权限。",
    e04_footer2: "如果您不认识邀请您的人，请忽略此邮件。",
    e05_title: "订阅已取消",
    e05_preheader: "如果不重新激活，您将在 {accessUntil} 失去 {planName}。",
    e05_heading: "我们已取消您的订阅",
    e05_body:
      "从 <strong style=\"color:#1A1512\">{accessUntil}</strong> 起，您将失去 <strong style=\"color:#1A1512\">{planName}</strong> 的访问权限，账户将转为免费的 Foodie 套餐。在此之前，一切保持完整——不会产生新的扣费。",
    e05_fallback_access_until: "您已付费周期的结束",
    e05_label_access_until: "完整访问权限保留至",
    e05_label_then: "之后转为",
    e05_value_then: "Foodie &middot; 免费",
    e05_label_next_charge: "下次扣费",
    e05_value_none: "无",
    e05_body2:
      "在 Foodie 套餐下，您将无法生成包含菜品真实成本的 PDF，食材和菜谱数量也会受到限制。<strong style=\"color:#1A1512\">您的数据不会被删除</strong>——菜谱、食材、菜单和库存都会保持原样。",
    e05_cta: "重新激活我的套餐",
    e05_footnote: "如果是因为我们缺少某项功能而取消的，请回复此邮件告诉我们——我们是真人查看，不是机器人。",
    e06_title: "套餐变更已生效",
    e06_preheader: "{fromPlan} → {toPlan}，已生效。",
    e06_body: "变更已生效。本月已按比例扣除差额；从下一个计费周期开始，您将支付新套餐的全额费用。",
    e06_label_before: "之前",
    e06_label_now: "现在",
    e06_unlocked_heading: "已解锁",
    e06_removed_heading: "不再包含",
    e06_next_charge_prefix: "下次扣费",
    e06_body_admin: "GastroMetrics 管理员更新了您的套餐。此次变更没有产生任何扣费。",
    e06_expires_prefix: "您的套餐到期日",
    e06_no_expiry_value: "无到期日",
    e06_cta: "查看我的套餐",
    e06_footnote: "您可以随时在\"我的套餐\"中降级；已保存的数据不会被删除。",
    e07_footer2: "这是您 Gastrometrics 账户的自动激活邮件。",
    e07_footnote: "如果您不想再收到此类邮件，回复本邮件即可为您取消订阅。",
    e08_subject: "Gastrometrics 更新内容",
    e08_title: "Gastrometrics 更新内容",
    e08_preheader: "以下是我们最近新增的内容",
    e08_heading: "以下是我们最近新增的内容",
    e08_cta: "打开 Gastrometrics",
    e08_footnote: "如果你不想再收到此邮件，可以在应用内的“设置 → 通知”中取消勾选。",
    e08_footer2: "这是你的 Gastrometrics 账户的产品更新邮件。",
    e09_subject: "您的{plan}套餐将在3天后到期",
    e09_title: "您的套餐即将到期",
    e09_preheader: "{plan}将于{date}到期——添加付款方式，或改回免费套餐。",
    e09_heading: "您的{plan}套餐将于{date}到期",
    e09_body: "GastroMetrics 管理员为您分配了{plan}套餐，到期日为{date}。到期后，您的账户将自动恢复为免费套餐（Foodie），您将失去{plan}的功能权限——已保存的数据不会被删除。",
    e09_cta1: "添加付款方式",
    e09_cta2: "取消并改回免费套餐",
    e09_footnote: "这是一封自动提醒邮件——无需回复。",
    e09_footer2: "您 Gastrometrics 账户的自动套餐到期提醒。",
    e10_subject: "您使用 GastroMetrics 的体验如何？",
    e10_title: "您的意见对我们很重要",
    e10_preheader: "告诉我们您的使用感受——只需不到一分钟。",
    e10_heading: "您使用 GastroMetrics 的体验如何？",
    e10_body: "您使用 GastroMetrics 已经有一段时间了，我们很想听听您的使用感受。直接给我们留言，或者如果您愿意，也可以在 Trustpilot 上告诉我们。",
    e10_cta1: "留下评论",
    e10_cta2: "在 Trustpilot 上留下评价",
    e10_footnote: "这是一封自动邮件——您的留言将由 GastroMetrics 团队直接查看。",
    e10_footer2: "您 Gastrometrics 账户的自动体验调查。",
    e11_subject: "我们更新了服务条款、隐私政策和责任声明",
    e11_title: "我们更新了法律文件",
    e11_preheader: "新版本的使用条款、隐私政策和责任声明。",
    e11_heading: "我们更新了法律文件",
    e11_body: "我们发布了新版本的 GastroMetrics 使用条款、隐私政策和责任声明。建议您阅读——您可以随时在应用内的\"设置\"中找到它们。如果您在此日期之后继续使用 GastroMetrics，我们将视为您已接受这些文件。",
    e11_terms_label: "使用条款",
    e11_privacy_label: "隐私政策",
    e11_liability_label: "责任声明",
    e11_cta: "前往 Gastrometrics",
    e11_footnote: "这是一封自动通知邮件——无需回复。",
    e11_footer2: "您 Gastrometrics 账户的法律声明。",
    e07_reminder_subject: "您试用 Gastrometrics 了吗？",
    e07_reminder_title: "您还没有录入第一个配方",
    e07_reminder_preheader: "只需不到 5 分钟即可查看一道菜的真实成本。",
    e07_reminder_heading: "您试用 Gastrometrics 了吗？",
    e07_reminder_body: "您几天前注册了账户，但还没有录入任何配方。添加一个食材并搭建一个配方——不到 5 分钟，您就能看到自己某道菜的真实成本和利润，全部自动计算。",
    e07_reminder_cta: "录入我的第一个配方",
    e07_day7_subject: "一周后，您的真实利润",
    e07_day7_title: "使用 Gastrometrics 一周了",
    e07_day7_preheader: "看看您配方的利润情况如何。",
    e07_day7_heading: "您已经使用 Gastrometrics 一周了",
    e07_day7_body: "现在是查看配方真实利润、并在需要时调整价格的好时机。前往报表查看您平均成本的完整情况。",
    e07_day7_cta: "查看我的利润",
    e07_firstsale_subject: "您记录了第一笔销售",
    e07_firstsale_title: "第一笔销售已记录！",
    e07_firstsale_preheader: "了解 Gastrometrics 如何帮助您避免在不知不觉中亏钱。",
    e07_firstsale_heading: "您在 Gastrometrics 记录了第一笔销售",
    e07_firstsale_body: "您记录的每一笔销售都会与配方的真实成本进行对比——随着时间推移，您就能看清自己的菜品是否真的带来了预期的利润。继续记录，数据会越来越精确。",
    e07_firstsale_cta: "查看我的报表",
  },
}

export function getEmailLabels(lang: string | null | undefined): Record<EmailLabelKeys, string> {
  return EMAIL_LABELS[normalizeEmailLang(lang)]
}

/** Locale de Intl.DateTimeFormat para las fechas dentro del cuerpo de un correo (p. ej. "recibido el ..."). */
export const EMAIL_DATE_LOCALES: Record<EmailLang, string> = {
  es: "es-HN",
  en: "en-US",
  da: "da-DK",
  fr: "fr-FR",
  pt: "pt-BR",
  zh: "zh-CN",
}
