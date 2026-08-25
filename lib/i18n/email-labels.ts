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
  | "feedback_type_queja"
  | "feedback_type_bug"
  | "feedback_reply_title_sugerencia"
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
  | "e06_cta"
  | "e06_footnote"

export const EMAIL_LABELS: Record<EmailLang, Record<EmailLabelKeys, string>> = {
  es: {
    footer_address: "Gastrometrics &middot; Costeo de cocina &middot; Tegucigalpa, Honduras",
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
    feedback_type_queja: "Queja",
    feedback_type_bug: "Reporte de error",
    feedback_reply_title_sugerencia: "Revisamos tu sugerencia",
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
    e05_preheader: "Sin cargos nuevos. Acceso hasta {accessUntil}.",
    e05_heading: "Cancelamos tu suscripción",
    e05_body:
      "Sin cargos nuevos. Tu plan <strong style=\"color:#1A1512\">{planName}</strong> sigue completo hasta que termine el período que ya pagaste, y después la cuenta pasa al plan Foodie gratuito.",
    e05_fallback_access_until: "el final de tu período ya pagado",
    e05_label_access_until: "Acceso completo hasta",
    e05_label_then: "Después pasas a",
    e05_value_then: "Foodie &middot; Gratis",
    e05_label_next_charge: "Próximo cobro",
    e05_value_none: "Ninguno",
    e05_body2:
      "<strong style=\"color:#1A1512\">Tus datos se quedan.</strong> Fichas, ingredientes, menús e inventario siguen guardados. En Foodie hay límites de cantidad y los PDFs con costos quedan bloqueados, pero nada se borra.",
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
    e06_cta: "Ver mi plan",
    e06_footnote: "Puedes bajar de plan cuando quieras desde Mi Plan; nada de lo que ya guardaste se borra.",
  },
  en: {
    footer_address: "Gastrometrics &middot; Kitchen costing &middot; Tegucigalpa, Honduras",
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
    feedback_type_queja: "Complaint",
    feedback_type_bug: "Bug report",
    feedback_reply_title_sugerencia: "We reviewed your suggestion",
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
    e05_preheader: "No new charges. Access until {accessUntil}.",
    e05_heading: "We cancelled your subscription",
    e05_body:
      "No new charges. Your <strong style=\"color:#1A1512\">{planName}</strong> plan stays fully active until the period you already paid for ends, and then the account moves to the free Foodie plan.",
    e05_fallback_access_until: "the end of your already-paid period",
    e05_label_access_until: "Full access until",
    e05_label_then: "Then you move to",
    e05_value_then: "Foodie &middot; Free",
    e05_label_next_charge: "Next charge",
    e05_value_none: "None",
    e05_body2:
      "<strong style=\"color:#1A1512\">Your data stays put.</strong> Recipe sheets, ingredients, menus, and inventory stay saved. Foodie has quantity limits and PDFs with costs get locked, but nothing gets deleted.",
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
    e06_cta: "View my plan",
    e06_footnote: "You can downgrade anytime from My Plan; nothing you already saved gets deleted.",
  },
  da: {
    footer_address: "Gastrometrics &middot; Køkkenkalkulation &middot; Tegucigalpa, Honduras",
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
    feedback_type_queja: "Klage",
    feedback_type_bug: "Fejlrapport",
    feedback_reply_title_sugerencia: "Vi har gennemgået dit forslag",
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
    e05_preheader: "Ingen nye opkrævninger. Adgang indtil {accessUntil}.",
    e05_heading: "Vi har annulleret dit abonnement",
    e05_body:
      "Ingen nye opkrævninger. Din plan <strong style=\"color:#1A1512\">{planName}</strong> forbliver fuldt aktiv, indtil den allerede betalte periode udløber, og derefter skifter kontoen til den gratis Foodie-plan.",
    e05_fallback_access_until: "slutningen af din allerede betalte periode",
    e05_label_access_until: "Fuld adgang indtil",
    e05_label_then: "Derefter skifter du til",
    e05_value_then: "Foodie &middot; Gratis",
    e05_label_next_charge: "Næste opkrævning",
    e05_value_none: "Ingen",
    e05_body2:
      "<strong style=\"color:#1A1512\">Dine data forbliver.</strong> Opskrifter, ingredienser, menuer og lager forbliver gemt. Foodie har mængdebegrænsninger, og PDF'er med omkostninger bliver låst, men intet bliver slettet.",
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
    e06_cta: "Se min plan",
    e06_footnote: "Du kan nedgradere når du vil fra Min Plan; intet af det, du allerede har gemt, bliver slettet.",
  },
  fr: {
    footer_address: "Gastrometrics &middot; Calcul des coûts de cuisine &middot; Tegucigalpa, Honduras",
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
    feedback_type_queja: "Réclamation",
    feedback_type_bug: "Signalement de bug",
    feedback_reply_title_sugerencia: "On a examiné ta suggestion",
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
    e05_preheader: "Aucun nouveau prélèvement. Accès jusqu'au {accessUntil}.",
    e05_heading: "On a annulé ton abonnement",
    e05_body:
      "Aucun nouveau prélèvement. Ton plan <strong style=\"color:#1A1512\">{planName}</strong> reste complet jusqu'à la fin de la période déjà payée, puis le compte passe au plan gratuit Foodie.",
    e05_fallback_access_until: "la fin de ta période déjà payée",
    e05_label_access_until: "Accès complet jusqu'au",
    e05_label_then: "Ensuite tu passes à",
    e05_value_then: "Foodie &middot; Gratuit",
    e05_label_next_charge: "Prochain prélèvement",
    e05_value_none: "Aucun",
    e05_body2:
      "<strong style=\"color:#1A1512\">Tes données restent.</strong> Fiches techniques, ingrédients, menus et inventaire restent enregistrés. Sur Foodie il y a des limites de quantité et les PDF avec les coûts sont verrouillés, mais rien n'est supprimé.",
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
    e06_cta: "Voir mon plan",
    e06_footnote: "Tu peux rétrograder quand tu veux depuis Mon Plan ; rien de ce que tu as déjà enregistré n'est supprimé.",
  },
  pt: {
    footer_address: "Gastrometrics &middot; Custeio de cozinha &middot; Tegucigalpa, Honduras",
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
    feedback_type_queja: "Reclamação",
    feedback_type_bug: "Relato de erro",
    feedback_reply_title_sugerencia: "Revisamos sua sugestão",
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
    e05_preheader: "Sem novas cobranças. Acesso até {accessUntil}.",
    e05_heading: "Cancelamos sua assinatura",
    e05_body:
      "Sem novas cobranças. Seu plano <strong style=\"color:#1A1512\">{planName}</strong> continua completo até terminar o período já pago, e depois a conta passa para o plano gratuito Foodie.",
    e05_fallback_access_until: "o fim do seu período já pago",
    e05_label_access_until: "Acesso completo até",
    e05_label_then: "Depois você passa para",
    e05_value_then: "Foodie &middot; Grátis",
    e05_label_next_charge: "Próxima cobrança",
    e05_value_none: "Nenhuma",
    e05_body2:
      "<strong style=\"color:#1A1512\">Seus dados ficam.</strong> Fichas técnicas, ingredientes, menus e estoque continuam salvos. No Foodie há limites de quantidade e os PDFs com custos ficam bloqueados, mas nada é apagado.",
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
    e06_cta: "Ver meu plano",
    e06_footnote: "Você pode fazer downgrade quando quiser em Meu Plano; nada do que você já salvou é apagado.",
  },
  zh: {
    footer_address: "Gastrometrics &middot; 厨房成本核算 &middot; 洪都拉斯特古西加尔巴",
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
    feedback_type_queja: "投诉",
    feedback_type_bug: "问题报告",
    feedback_reply_title_sugerencia: "我们已查看您的建议",
    feedback_reply_title_queja: "我们已处理您的投诉",
    feedback_reply_title_bug: "我们已修复该问题",
    e03_title: "重置您的密码",
    e03_preheader: "链接有效期为 1 小时。",
    e03_heading: "设置新密码",
    e03_body: "有人请求重置 <strong style=\"color:#1A1512\">{email}</strong> 的密码。如果是您本人操作，请继续：",
    e03_cta: "创建新密码",
    e03_label_request: "请求时间",
    e03_label_device: "设备",
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
    e05_preheader: "不会再产生新的扣费。访问权限保留至 {accessUntil}。",
    e05_heading: "我们已取消您的订阅",
    e05_body:
      "不会再产生新的扣费。您的 <strong style=\"color:#1A1512\">{planName}</strong> 套餐将在已付费周期结束前保持完整有效，此后账户将转为免费的 Foodie 套餐。",
    e05_fallback_access_until: "您已付费周期的结束",
    e05_label_access_until: "完整访问权限保留至",
    e05_label_then: "之后转为",
    e05_value_then: "Foodie &middot; 免费",
    e05_label_next_charge: "下次扣费",
    e05_value_none: "无",
    e05_body2:
      "<strong style=\"color:#1A1512\">您的数据将会保留。</strong>菜谱、食材、菜单和库存都将继续保存。Foodie 套餐有数量限制，包含成本的 PDF 将被锁定，但不会删除任何数据。",
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
    e06_cta: "查看我的套餐",
    e06_footnote: "您可以随时在“我的套餐”中降级；已保存的数据不会被删除。",
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
