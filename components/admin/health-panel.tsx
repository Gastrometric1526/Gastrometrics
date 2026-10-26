"use client"

/** /admin → Sistema (docs/195): base de datos, webhook de Stripe, tareas programadas, correos y configuración. */

import { Activity, Database, Webhook, Timer, Mail, Settings2, CheckCircle2, AlertTriangle } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { formatDateTime } from "@/lib/date-format"
import type { TranslationKey } from "@/lib/i18n/translations"
import { AdminCard, BarList, ErrorState, LoadingBlock, SimpleTable, StatusPill, type Status, useAdminData } from "@/components/admin/ui"
import { AdminResendConfirmation } from "@/components/admin/admin-resend-confirmation"
import { EMAIL_LABELS } from "@/lib/i18n/email-labels"

/** Asuntos del correo de confirmación en los 6 idiomas. */
const CONFIRMATION_SUBJECTS = new Set(Object.values(EMAIL_LABELS).map((l) => l.e01_subject))

export interface HealthResponse {
  checkedAt: string
  problems: string[]
  config: { stripeMode: "live" | "test" | "missing"; items: { key: string; set: boolean }[]; siteUrl: string | null }
  database: { ok: boolean; ms: number | null }
  webhook:
    | { configured: boolean; livemode: boolean | null; healthy: boolean; endpoints: { url: string; events: string[]; status: string; needs: { url?: string; enabled_events?: string[] } | null }[]; checkedAt: string }
    | { error: string }
  crons: { job: string; schedule: string; lastRunAt: string | null; ok: boolean | null; failedSteps: string[]; late: boolean }[]
  appEmails: { total7d: number; byType: { type: string; count: number }[] }
  provider:
    | { available: true; sampled: number; counts: Record<string, number>; last24h: number; problems: { to: string; subject: string; at: string; status: string }[] }
    | { available: false; reason: string }
}

/** «first_recipe_reminder» → «First recipe reminder» (tipos internos de correo). */
const humanize = (type: string) => {
  const text = type.replace(/[_-]+/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function HealthPanel() {
  const { t } = useLanguage()
  const { data, error, loading, reload } = useAdminData<HealthResponse>("/api/admin/health")
  if (error && !data) return <ErrorState onRetry={() => reload(true)} />
  if (loading && !data) return <LoadingBlock rows={6} />
  if (!data) return null

  const tt = (k: string) => t(k as TranslationKey)
  const webhook = data.webhook
  const webhookStatus: Status = "error" in webhook ? "unknown" : !webhook.configured ? "unknown" : webhook.healthy ? "ok" : "bad"
  const emailStatus: Status = !data.provider.available ? "unknown" : data.provider.problems.length > 0 ? "warn" : "ok"
  const cronStatus: Status = data.crons.some((c) => c.ok === false || c.late) ? "bad" : data.crons.some((c) => c.ok === null) ? "unknown" : "ok"
  const configMissing = data.config.items.filter((i) => !i.set)

  const problemLabel = (p: string) => {
    if (p.startsWith("cron:")) return t("admin_health_problem_cron").replace("{job}", tt(`admin_health_job_${p.slice(5).replace(/-/g, "_")}`))
    if (p.startsWith("config:")) return t("admin_health_problem_config").replace("{key}", p.slice(7))
    return tt(`admin_health_problem_${p}`)
  }

  return (
    <div className="space-y-6">
      {/* Estado general */}
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${data.problems.length === 0 ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"}`}>
        {data.problems.length === 0 ? <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            {data.problems.length === 0 ? t("admin_health_all_ok") : t("admin_health_n_problems").replace("{count}", String(data.problems.length))}
          </p>
          {data.problems.length > 0 && (
            <ul className="text-sm text-foreground list-disc pl-5 space-y-0.5">
              {data.problems.map((p) => (
                <li key={p}>{problemLabel(p)}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">{t("admin_health_checked").replace("{time}", formatDateTime(data.checkedAt))}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard title={t("admin_health_db")} icon={Database} help={t("admin_health_db_help")}>
          <div className="flex items-center justify-between">
            <StatusPill status={data.database.ok ? "ok" : "bad"} label={data.database.ok ? t("admin_health_ok") : t("admin_health_down")} />
            {data.database.ms !== null && <span className="text-sm tabular-nums text-muted-foreground">{t("admin_health_ms").replace("{ms}", String(data.database.ms))}</span>}
          </div>
        </AdminCard>

        <AdminCard title={t("admin_health_webhook")} icon={Webhook} help={t("admin_health_webhook_help")}>
          <div className="space-y-2">
            <StatusPill
              status={webhookStatus}
              label={"error" in webhook ? t("admin_health_unknown") : !webhook.configured ? t("admin_health_not_configured") : webhook.healthy ? t("admin_health_ok") : t("admin_health_needs_fix")}
            />
            {!("error" in webhook) &&
              webhook.endpoints.map((e) => (
                <div key={e.url} className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-mono break-all text-foreground">{e.url}</p>
                  <p>{t("admin_health_events").replace("{count}", String(e.events.length))}</p>
                  {e.needs?.url && <p className="text-destructive">{t("admin_health_webhook_redirect").replace("{url}", e.needs.url)}</p>}
                  {e.needs?.enabled_events && <p className="text-destructive">{t("admin_health_webhook_missing").replace("{events}", e.needs.enabled_events.join(", "))}</p>}
                </div>
              ))}
          </div>
        </AdminCard>
      </div>

      <AdminCard
        title={t("admin_health_crons")}
        icon={Timer}
        help={t("admin_health_crons_help")}
        actions={<StatusPill status={cronStatus} label={cronStatus === "ok" ? t("admin_health_ok") : cronStatus === "bad" ? t("admin_health_needs_fix") : t("admin_health_no_record")} />}
      >
        <SimpleTable
          columns={[
            { key: "job", label: t("admin_col_task") },
            { key: "schedule", label: t("admin_col_schedule") },
            { key: "last", label: t("admin_col_last_run") },
            { key: "state", label: t("admin_col_status"), align: "right" },
          ]}
          rows={data.crons.map((c) => ({
            key: c.job,
            cells: {
              job: (
                <div>
                  <p className="text-foreground">{tt(`admin_health_job_${c.job.replace(/-/g, "_")}`)}</p>
                  <p className="text-xs text-muted-foreground">{tt(`admin_health_job_${c.job.replace(/-/g, "_")}_desc`)}</p>
                </div>
              ),
              schedule: <span className="text-muted-foreground">{t("admin_health_daily_at").replace("{time}", c.schedule)}</span>,
              last: c.lastRunAt ? formatDateTime(c.lastRunAt) : <span className="text-muted-foreground">{t("admin_health_no_record_yet")}</span>,
              state:
                c.ok === null ? (
                  <StatusPill status="unknown" label={t("admin_health_no_record")} />
                ) : c.late ? (
                  <StatusPill status="bad" label={t("admin_health_late")} />
                ) : c.ok ? (
                  <StatusPill status="ok" label={t("admin_health_ok")} />
                ) : (
                  <span className="space-y-1 inline-block text-right">
                    <StatusPill status="bad" label={t("admin_health_failed_steps")} />
                    <span className="block text-xs text-muted-foreground">{c.failedSteps.join(", ")}</span>
                  </span>
                ),
            },
          }))}
        />
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard
          title={t("admin_health_emails")}
          icon={Mail}
          help={t("admin_health_emails_help")}
          actions={
            <StatusPill status={emailStatus} label={emailStatus === "ok" ? t("admin_health_ok") : emailStatus === "warn" ? t("admin_health_with_problems") : t("admin_health_unknown")} />
          }
        >
          {!data.provider.available ? (
            <p className="text-sm text-muted-foreground">{tt(`admin_health_provider_${data.provider.reason}`)}</p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("admin_health_emails_sampled").replace("{count}", String(data.provider.sampled)).replace("{day}", String(data.provider.last24h))}
              </p>
              <BarList
                rows={Object.entries(data.provider.counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => ({ key: status, label: tt(`admin_health_email_${status}`), value: count }))}
              />
            </div>
          )}
        </AdminCard>

        <AdminCard title={t("admin_health_app_emails")} icon={Activity} help={t("admin_health_app_emails_help")} description={t("admin_health_app_emails_total").replace("{count}", String(data.appEmails.total7d))}>
          <BarList rows={data.appEmails.byType.map((r) => ({ key: r.type, label: humanize(r.type), value: r.count }))} empty={t("admin_health_app_emails_empty")} />
        </AdminCard>
      </div>

      {data.provider.available && data.provider.problems.length > 0 && (
        <AdminCard title={t("admin_health_email_problems")} icon={AlertTriangle} help={t("admin_health_email_problems_help")}>
          <SimpleTable
            columns={[
              { key: "to", label: t("admin_col_recipient") },
              { key: "subject", label: t("admin_col_subject") },
              { key: "status", label: t("admin_col_status") },
              { key: "date", label: t("admin_col_date"), align: "right" },
              { key: "action", label: "" },
            ]}
            rows={data.provider.problems.map((p, i) => ({
              key: `${p.to}-${i}`,
              cells: {
                // Correo de confirmación que no llegó: se puede reenviar desde aquí (docs/204).
                action: CONFIRMATION_SUBJECTS.has(p.subject) ? <AdminResendConfirmation email={p.to.split(",")[0].trim()} /> : null,
                to: p.to,
                subject: <span className="text-muted-foreground">{p.subject}</span>,
                status: <StatusPill status={p.status === "delivery_delayed" ? "warn" : "bad"} label={tt(`admin_health_email_${p.status}`)} />,
                date: formatDateTime(p.at),
              },
            }))}
          />
        </AdminCard>
      )}

      <AdminCard
        title={t("admin_health_config")}
        icon={Settings2}
        help={t("admin_health_config_help")}
        actions={<StatusPill status={configMissing.length ? "warn" : "ok"} label={configMissing.length ? t("admin_health_n_missing").replace("{count}", String(configMissing.length)) : t("admin_health_ok")} />}
      >
        <div className="space-y-3">
          <p className="text-sm">
            {t("admin_health_stripe_mode")}:{" "}
            <StatusPill
              status={data.config.stripeMode === "live" ? "ok" : data.config.stripeMode === "test" ? "warn" : "bad"}
              label={tt(`admin_health_stripe_${data.config.stripeMode}`)}
            />
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {data.config.items.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
                <span className="font-mono">{i.key}</span>
                <StatusPill status={i.set ? "ok" : "bad"} label={i.set ? t("admin_health_set") : t("admin_health_missing")} />
              </li>
            ))}
          </ul>
        </div>
      </AdminCard>
    </div>
  )
}
