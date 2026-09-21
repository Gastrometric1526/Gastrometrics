-- GastroMetrics — pedido explícito del dueño del proyecto: cuando a un usuario le
-- llegue la encuesta de "¿qué tal ha sido tu experiencia?" a las 4 horas de uso real
-- (ver docs/117), su comentario debe poder verse en el mismo panel admin donde ya se
-- ven sugerencias/quejas/reportes de bug — no un buzón aparte.
--
-- Se agrega "experiencia" como un cuarto valor válido de feedback.type, reutilizando
-- 100% de la tabla/RLS/rutas ya existentes (0006_feedback.sql) — el buzón de /admin,
-- la notificación por correo al dueño (lib/services/notify-feedback.ts) y el envío
-- desde /contacto (app/api/feedback/submit/route.ts) funcionan igual para este tipo
-- nuevo sin tocar su estructura, solo su lista de valores permitidos.
--
-- Postgres no permite "alter constraint", hay que borrar el check viejo y crear uno
-- nuevo con el valor extra — los datos existentes no se tocan (ninguna fila usa
-- "experiencia" todavía, así que el nuevo check no puede fallar contra datos viejos).
--
-- Cómo aplicar: igual que las migraciones anteriores — pegar completo en el SQL
-- Editor de Supabase y correr. Re-corrible.

alter table public.feedback drop constraint if exists feedback_type_check;
alter table public.feedback add constraint feedback_type_check
  check (type in ('sugerencia', 'queja', 'bug', 'experiencia'));
