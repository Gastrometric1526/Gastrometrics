/**
 * Tope de correos por paso de la tarea diaria (docs/355). Por encima de lo normal en un
 * día es señal de un error (docs/353: el cierre del chat pudo escribir por casos de hace
 * meses): lo que pasa del tope no sale, el paso cuenta como fallido en /admin y se avisa
 * al dueño. Con Vercel Hobby (60 s, ~0.55 s por correo) una corrida entera no pasa de
 * ~100 correos. EMAIL_STEP_CAP (variable de entorno) cambia el tope general sin tocar el
 * código; los topes propios de un paso mandan sobre ella.
 */

export const DEFAULT_EMAIL_STEP_CAP = 60

export const EMAIL_STEP_CAPS: Record<string, number> = {
  // El chat cierra pocos casos por día; muchos a la vez es justo el error de docs/353.
  "chat de soporte sin respuesta": 20,
}

export function emailCapFor(name: string, envValue: string | undefined = process.env.EMAIL_STEP_CAP): number {
  if (name in EMAIL_STEP_CAPS) return EMAIL_STEP_CAPS[name]
  const fromEnv = Number(envValue)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.floor(fromEnv) : DEFAULT_EMAIL_STEP_CAP
}
