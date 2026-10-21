"use client";

/**
 * Radiografía completa de una cuenta en /admin → Cuentas y planes → detalle (docs/166).
 * Pedido del dueño: «toda la posible información»: estado y uso (días, horas, módulos,
 * rachas, tendencia), perfil, plan e historial de planes, contenido, equipo, correos y
 * mensajes. Datos: /api/admin/account-insights (lib/admin/account-insights-server.ts).
 */

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  CreditCard,
  ExternalLink,
  Gauge,
  History,
  CalendarDays,
  Clock,
  Flame,
  Mail,
  MessageSquare,
  Package,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/language-context";
import { getDateLocale, type TranslationKey } from "@/lib/i18n/translations";
import { getPlanBySlug } from "@/lib/plans";
import {
  BUSINESS_TYPES,
  BUSINESS_SIZES,
  EXPERIENCE_LEVELS,
} from "@/lib/types/user";
import { MODULE_LABEL_KEY } from "@/components/admin/top-users-panel";
import type { AccountInsights } from "@/lib/admin/account-insights-server";
import { formatDate, formatDateTime, formatDayMonth } from "@/lib/date-format"

const DAY_MS = 86_400_000

// Función del plan → módulo de la app (para «funciones pagadas que nunca abrió»).
const FEATURE_TO_MODULE: Record<string, string> = {
  inventory: "inventario",
  menus: "menus",
  purchase_orders_manual: "ordenes_compra",
  team: "equipo",
  stats_panorama: "estadisticas",
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">
        {value ?? "—"}
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof User;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Barras verticales de una sola serie; el pico lleva su valor y cada barra un tooltip. */
function Columns({
  values,
  labels,
  height = 96,
}: {
  values: number[];
  labels: string[];
  height?: number;
}) {
  const max = Math.max(...values, 1);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div className="pt-5">
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {values.map((v, i) => (
          <div
            key={i}
            className="group relative flex h-full flex-1 items-end"
            title={`${labels[i]}: ${v}`}
          >
            {i === peak && v > 0 && (
              <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full text-[10px] font-medium text-foreground">
                {v}
              </span>
            )}
            <div
              className={`w-full rounded-t-[4px] transition-opacity group-hover:opacity-80 ${i === peak && v > 0 ? "bg-primary" : "bg-primary/45"}`}
              style={{ height: `${Math.max((v / max) * 100, v > 0 ? 3 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-border pt-1">
        {labels.map((l, i) => (
          <span
            key={i}
            className="flex-1 truncate text-center text-[10px] text-muted-foreground"
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales ordenadas (ranking). */
function Ranking({
  rows,
}: {
  rows: { label: string; value: number; detail?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm"
          title={r.detail}
        >
          <span className="truncate text-foreground">{r.label}</span>
          <span className="h-2.5 rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary/70"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {r.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AccountInsightsPanel({ userId }: { userId: string }) {
  const { t, language } = useLanguage();
  const [data, setData] = useState<AccountInsights | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    fetch(`/api/admin/account-insights?userId=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => !cancelled && setData(json))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (error)
    return (
      <p className="text-sm text-destructive">{t("admin_insights_error")}</p>
    );
  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const locale = getDateLocale(language);
  const date = (iso: string | null | undefined) =>
    iso
      ? formatDate(iso)
      : "—";
  const dateTime = (iso: string | null | undefined) =>
    iso
      ? formatDateTime(iso, { timeZone: "America/Tegucigalpa" })
      : "—";
  const daysSince = (iso: string | null | undefined) =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) : null;
  const yesNo = (v: boolean) =>
    v ? t("admin_insights_yes") : t("admin_insights_no");
  const actionLabel = (a: string) => {
    const key = `admin_insights_action_${a}` as TranslationKey;
    const label = t(key);
    return label && label !== key ? label : a;
  };
  const moduleLabel = (m: string) =>
    MODULE_LABEL_KEY[m] ? t(MODULE_LABEL_KEY[m]) : m;
  const planName = (slug: string | null) =>
    slug ? getPlanBySlug(slug).name : "—";
  const labelOf = (
    list: readonly { value: string; labelKey: string }[],
    v: string | null,
  ) => {
    const hit = list.find((x) => x.value === v);
    return hit ? t(hit.labelKey as TranslationKey) : v || "—";
  };
  const countryName = (code: string | null) => {
    if (!code) return "—";
    try {
      return (
        new Intl.DisplayNames([locale], { type: "region" }).of(code) || code
      );
    } catch {
      return code;
    }
  };

  const { account, plan, usage, content, team, emails, feedback, emailClicks, limits, activation, recentActivity, billing, surveyAnswers } = data;
  const accountAge = daysSince(account.createdAt) ?? 0;
  const lastSeen =
    usage.lastSeenAt || usage.lastActivityAt || account.lastSignInAt;
  const idleDays = daysSince(lastSeen);
  const status: {
    key: TranslationKey;
    variant: "default" | "secondary" | "destructive" | "outline";
  } =
    accountAge <= 7
      ? { key: "admin_insights_status_new", variant: "secondary" }
      : idleDays !== null && idleDays <= 7
        ? { key: "admin_insights_status_active", variant: "default" }
        : idleDays !== null && idleDays <= 30
          ? { key: "admin_insights_status_risk", variant: "outline" }
          : { key: "admin_insights_status_inactive", variant: "destructive" };

  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2026, 9, 18 + i)).toLocaleDateString(locale, {
      weekday: "short",
      timeZone: "UTC",
    }),
  );
  const hourLabels = Array.from({ length: 24 }, (_, h) =>
    h % 3 === 0 ? String(h) : "",
  );
  const weeklyLabels = usage.weekly.map((w) =>
    formatDayMonth(`${w.weekStart}T12:00:00Z`),
  );
  const peakDay = usage.byWeekday.indexOf(Math.max(...usage.byWeekday));
  const peakHour = usage.byHour.indexOf(Math.max(...usage.byHour));
  const hasUsage = usage.totalEvents > 0;
  const sourceLabel = (s: string | null) =>
    s === "stripe"
      ? t("admin_insights_source_stripe")
      : s === "expired"
        ? t("admin_insights_source_expired")
        : s === "admin"
          ? t("admin_insights_source_admin")
          : s || "";

  return (
    <div className="space-y-4" data-tour="admin-account-insights">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">
          {t("admin_insights_title")}
        </h2>
        <Badge variant={status.variant}>{t(status.key)}</Badge>
        {account.isTester && (
          <Badge variant="outline">{t("admin_insights_tester")}</Badge>
        )}
        {account.deletionRequestedAt && (
          <Badge variant="destructive">{t("admin_insights_deletion")}</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Stat
          icon={CalendarDays}
          label={t("admin_insights_member_since")}
          value={date(account.createdAt)}
          hint={t("admin_insights_days_ago").replace("{n}", String(accountAge))}
        />
        <Stat
          icon={Clock}
          label={t("admin_insights_last_seen")}
          value={dateTime(lastSeen)}
          hint={
            idleDays !== null
              ? t("admin_insights_days_ago").replace("{n}", String(idleDays))
              : undefined
          }
        />
        <Stat
          icon={Activity}
          label={t("admin_insights_time_in_app")}
          value={formatDuration(usage.totalActiveSeconds)}
          hint={
            usage.activeDays
              ? `${t("admin_insights_avg_per_day")}: ${formatDuration(usage.totalActiveSeconds / usage.activeDays)}`
              : undefined
          }
        />
        <Stat
          icon={CalendarDays}
          label={t("admin_insights_active_days")}
          value={String(usage.activeDays)}
          hint={t("admin_insights_active_days_detail")
            .replace("{d7}", String(usage.activeDaysLast7))
            .replace("{d30}", String(usage.activeDaysLast30))}
        />
        <Stat
          icon={Flame}
          label={t("admin_insights_streak")}
          value={t("admin_insights_streak_days").replace(
            "{n}",
            String(usage.longestStreak),
          )}
        />
        <Stat
          icon={Sparkles}
          label={t("admin_insights_plan_current")}
          value={planName(plan.slug)}
          hint={`${t("admin_insights_plan_since")} ${date(plan.since)}`}
        />
      </div>

      {/* Alertas (docs/172): lo primero que conviene saber de la cuenta. */}
      {(() => {
        const alerts: { tone: "danger" | "warn" | "info"; text: string }[] = [];
        if (billing && billing.failedPayments > 0)
          alerts.push({ tone: "danger", text: t("admin_insights_alert_failed_payments").replace("{n}", String(billing.failedPayments)) });
        const expiresIn = plan.expiresAt ? Math.ceil((new Date(plan.expiresAt).getTime() - Date.now()) / DAY_MS) : null;
        if (expiresIn !== null && expiresIn >= 0 && expiresIn <= 7)
          alerts.push({ tone: "warn", text: t("admin_insights_alert_expires").replace("{date}", date(plan.expiresAt)) });
        if (plan.cancelAtPeriodEnd)
          alerts.push({ tone: "warn", text: t("admin_insights_cancelling").replace("{date}", date(plan.currentPeriodEnd)) });
        if (plan.scheduledRenewal) alerts.push({ tone: "info", text: t("admin_insights_scheduled") });
        if (idleDays !== null && idleDays > 14)
          alerts.push({ tone: "warn", text: t("admin_insights_alert_idle").replace("{n}", String(idleDays)) });
        if (!account.emailConfirmedAt) alerts.push({ tone: "warn", text: t("admin_insights_alert_unconfirmed") });
        if (account.deletionRequestedAt)
          alerts.push({ tone: "danger", text: t("admin_insights_alert_deletion").replace("{date}", date(account.deletionRequestedAt)) });
        if (plan.priceUsdCents > 0 && limits.unusedFeatures.length > 0)
          alerts.push({ tone: "info", text: t("admin_insights_alert_unused").replace("{n}", String(limits.unusedFeatures.length)) });
        const doneSteps = activation.filter((a) => a.done).length;
        if (accountAge > 7 && doneSteps <= 2)
          alerts.push({
            tone: "warn",
            text: t("admin_insights_alert_low_activation").replace("{done}", String(doneSteps)).replace("{total}", String(activation.length)),
          });
        const toneClass = { danger: "bg-destructive/10 text-destructive", warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400", info: "bg-primary/10 text-primary" };
        return (
          <div className="flex flex-wrap items-center gap-2">
            {alerts.length === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("admin_insights_no_alerts")}
              </span>
            ) : (
              alerts.map((a, i) => (
                <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${toneClass[a.tone]}`}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {a.text}
                </span>
              ))
            )}
          </div>
        );
      })()}

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Section icon={CheckCircle2} title={`${t("admin_insights_section_activation")} (${activation.filter((a) => a.done).length}/${activation.length})`}>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(activation.filter((a) => a.done).length / activation.length) * 100}%` }}
            />
          </div>
          <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {activation.map((a) => (
              <li key={a.key} className={`flex items-center gap-2 ${a.done ? "text-foreground" : "text-muted-foreground"}`}>
                {a.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
                {t(`admin_insights_act_${a.key}` as TranslationKey)}
              </li>
            ))}
          </ul>
        </Section>
        <Section icon={Gauge} title={t("admin_insights_section_limits")}>
          {[
            { label: t("admin_insights_limits_businesses"), used: limits.businessesUsed, max: limits.businessesMax },
            { label: t("admin_insights_limits_users"), used: limits.usersUsed, max: limits.usersMax },
          ].map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-foreground">{row.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.used} / {row.max}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${row.used >= row.max ? "bg-amber-500" : "bg-primary/70"}`}
                  style={{ width: `${Math.min((row.used / Math.max(row.max, 1)) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
          <div className="pt-1">
            <p className="text-xs font-medium text-muted-foreground">{t("admin_insights_unused_features")}</p>
            <p className="text-sm text-foreground">
              {limits.unusedFeatures.length
                ? limits.unusedFeatures.map((f) => moduleLabel(FEATURE_TO_MODULE[f] || f)).join(", ")
                : t("admin_insights_all_features_used")}
            </p>
          </div>
        </Section>
      </div>

      <Section icon={Activity} title={t("admin_insights_section_usage")}>
        {!hasUsage ? (
          <p className="text-sm text-muted-foreground">
            {t("admin_insights_no_activity")}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("admin_insights_by_weekday")} ·{" "}
                {t("admin_insights_peak").replace(
                  "{label}",
                  weekdayLabels[peakDay],
                )}
              </p>
              <Columns values={usage.byWeekday} labels={weekdayLabels} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("admin_insights_by_hour")} ·{" "}
                {t("admin_insights_peak").replace("{label}", `${peakHour}:00`)}
              </p>
              <Columns values={usage.byHour} labels={hourLabels} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("admin_insights_weekly")}
              </p>
              <Columns
                values={usage.weekly.map((w) => w.count)}
                labels={weeklyLabels}
                height={80}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("admin_insights_modules")}
              </p>
              <Ranking
                rows={usage.moduleVisits
                  .slice(0, 10)
                  .map((m) => ({
                    label: moduleLabel(m.module),
                    value: m.count,
                  }))}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("admin_insights_actions")}
              </p>
              {usage.moduleActions.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left font-normal" />
                        <th className="text-right font-normal">
                          {t("admin_insights_created")}
                        </th>
                        <th className="text-right font-normal">
                          {t("admin_insights_updated")}
                        </th>
                        <th className="text-right font-normal">
                          {t("admin_insights_deleted")}
                        </th>
                        <th className="text-right font-normal">
                          {t("admin_insights_other")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.moduleActions.map((m) => (
                        <tr key={m.module} className="border-t border-border">
                          <td className="py-1 text-foreground">
                            {moduleLabel(m.module)}
                          </td>
                          <td className="text-right tabular-nums">
                            {m.created}
                          </td>
                          <td className="text-right tabular-nums">
                            {m.updated}
                          </td>
                          <td className="text-right tabular-nums">
                            {m.deleted}
                          </td>
                          <td className="text-right tabular-nums">{m.other}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("admin_insights_none")}
                </p>
              )}
              <p className="pt-2 text-xs text-muted-foreground">
                {t("admin_insights_ocr")}: {usage.ocrReads.total} (
                {t("admin_insights_ocr_recipe")} {usage.ocrReads.recipe} ·{" "}
                {t("admin_insights_ocr_receipt")} {usage.ocrReads.receipt} ·{" "}
                {t("admin_insights_ocr_inventory")} {usage.ocrReads.inventory})
              </p>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("admin_insights_milestones")}
              </p>
              {usage.milestones.length ? (
                <ol className="flex flex-wrap gap-2">
                  {usage.milestones.map((m) => (
                    <li
                      key={m.key}
                      className="rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                    >
                      {t(`admin_insights_ms_${m.key}` as TranslationKey)} ·{" "}
                      <span className="text-muted-foreground">
                        {date(m.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("admin_insights_none")}
                </p>
              )}
            </div>
          </div>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Section icon={Sparkles} title={t("admin_insights_section_plan")}>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={t("admin_insights_plan_current")}
              value={planName(plan.slug)}
            />
            <Field
              label={t("admin_insights_plan_value")}
              value={
                plan.priceUsdCents
                  ? `$${plan.priceUsdCents / 100}${t("admin_insights_per_month")}`
                  : "$0"
              }
            />
            <Field
              label={t("admin_insights_plan_since")}
              value={date(plan.since)}
            />
            <Field
              label={t("admin_insights_plan_expires")}
              value={
                plan.expiresAt
                  ? date(plan.expiresAt)
                  : t("admin_insights_never")
              }
            />
            <Field
              label={t("admin_insights_subscription")}
              value={
                plan.hasSubscription
                  ? plan.cancelAtPeriodEnd
                    ? t("admin_insights_cancelling").replace(
                        "{date}",
                        date(plan.currentPeriodEnd),
                      )
                    : `${t("admin_insights_sub_active")}${plan.currentPeriodEnd ? ` · ${t("admin_insights_next_charge")} ${date(plan.currentPeriodEnd)}` : ""}`
                  : t("admin_insights_sub_none")
              }
            />
            <Field
              label={t("admin_insights_extras")}
              value={`${plan.extraBusinesses} / ${plan.extraTeamSeats}`}
            />
            {plan.founderGrant && (
              <Field
                label={t("admin_insights_founder")}
                value={t("admin_insights_founder_value")
                  .replace("{n}", String(plan.founderGrant.ordinal ?? "?"))
                  .replace("{date}", date(plan.founderGrant.at))}
              />
            )}
            {plan.scheduledRenewal && (
              <Field
                label={t("admin_insights_scheduled")}
                value={t("admin_insights_scheduled_value")
                  .replace("{plan}", planName(plan.scheduledRenewal.planSlug))
                  .replace("{date}", date(plan.scheduledRenewal.startsAt))}
              />
            )}
          </div>
          <div className="space-y-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t("admin_insights_history")}
            </p>
            {plan.history.length ? (
              <ol className="space-y-1 border-l border-border pl-3">
                {plan.history.map((h, i) => (
                  <li key={i} className="text-sm text-foreground">
                    <span className="text-muted-foreground">{date(h.at)}</span>{" "}
                    · {planName(h.from)} → <strong>{planName(h.to)}</strong>
                    {h.source && (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        ({sourceLabel(h.source)})
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("admin_insights_history_empty")}
              </p>
            )}
          </div>
        </Section>

        <Section icon={User} title={t("admin_insights_section_profile")}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("admin_insights_name")} value={account.name} />
            <Field
              label={t("admin_insights_country")}
              value={countryName(account.country)}
            />
            <Field
              label={t("admin_insights_currency")}
              value={account.currency}
            />
            <Field
              label={t("admin_insights_language")}
              value={account.language?.toUpperCase()}
            />
            <Field
              label={t("admin_insights_business_type")}
              value={labelOf(BUSINESS_TYPES, account.businessType)}
            />
            <Field
              label={t("admin_insights_business_size")}
              value={labelOf(BUSINESS_SIZES, account.businessSize)}
            />
            <Field
              label={t("admin_insights_experience")}
              value={labelOf(EXPERIENCE_LEVELS, account.experience)}
            />
            <Field
              label={t("admin_insights_email_confirmed")}
              value={
                account.emailConfirmedAt
                  ? date(account.emailConfirmedAt)
                  : t("admin_insights_no")
              }
            />
            <Field
              label={t("admin_insights_last_sign_in")}
              value={dateTime(account.lastSignInAt)}
            />
            <Field
              label={t("admin_insights_updates_optin")}
              value={yesNo(account.productUpdatesOptIn)}
            />
            <Field
              label={t("admin_insights_terms")}
              value={
                account.termsAcceptedAt
                  ? `v${account.termsVersion ?? "?"} · ${date(account.termsAcceptedAt)}`
                  : "—"
              }
            />
            {account.deletionRequestedAt && (
              <Field
                label={t("admin_insights_deletion")}
                value={date(account.deletionRequestedAt)}
              />
            )}
          </div>
        </Section>
      </div>

      <Section icon={Package} title={t("admin_insights_section_content")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {(
            [
              ["admin_insights_c_businesses", content.businesses.length],
              ["admin_insights_c_recipes", content.recipes],
              ["admin_insights_c_sub_recipes", content.subRecipes],
              ["admin_insights_c_ingredients", content.ingredients],
              ["admin_insights_c_inventory_items", content.inventoryItems],
              ["admin_insights_c_inventory_counts", content.inventoryCounts],
              ["admin_insights_c_menus", content.menus],
              ["admin_insights_c_purchase_orders", content.purchaseOrders],
              ["admin_insights_c_invoices", content.invoices],
              ["admin_insights_c_pos_imports", content.posImports],
              ["admin_insights_c_manual_sales", content.manualSales],
              ["admin_insights_c_trash", content.recipesInTrash],
              ["admin_insights_c_drafts", content.drafts.length],
            ] as [TranslationKey, number][]
          ).map(([key, value]) => (
            <div key={key} className="rounded-md bg-muted/40 p-2">
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {value}
              </p>
              <p className="text-xs text-muted-foreground">{t(key)}</p>
            </div>
          ))}
        </div>
        {content.lastSalesAt && (
          <p className="text-xs text-muted-foreground">
            {t("admin_insights_last_sales")}: {date(content.lastSalesAt)}
          </p>
        )}
        {content.businesses.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {content.businesses
              .map(
                (b) =>
                  `${b.name}${b.isActive ? "" : ` (${t("admin_insights_inactive")})`}`,
              )
              .join(" · ")}
          </p>
        )}
      </Section>

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Section icon={Users} title={t("admin_insights_section_team")}>
          <Field
            label={t("admin_insights_invited")}
            value={
              team.invited.length
                ? team.invited.map((m) => `${m.email} (${m.status})`).join(", ")
                : t("admin_insights_none")
            }
          />
          <Field
            label={t("admin_insights_member_of")}
            value={
              team.memberOf.length
                ? team.memberOf.map((b) => b.name).join(", ")
                : t("admin_insights_none")
            }
          />
        </Section>
        <Section
          icon={Mail}
          title={`${t("admin_insights_section_emails")} (${emails.length})`}
        >
          <p className="text-xs text-muted-foreground">
            {t("admin_insights_email_clicks").replace("{n}", String(emailClicks.length))}
            {emailClicks[0] ? ` · ${emailClicks[0].campaign} (${date(emailClicks[0].at)})` : ""}
          </p>
          {emails.length ? (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {emails.map((e, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-foreground">{e.type}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {date(e.at)}
                    {e.clicked ? ` · ${t("admin_insights_clicked")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("admin_insights_none")}
            </p>
          )}
        </Section>
        <Section
          icon={MessageSquare}
          title={`${t("admin_insights_section_feedback")} (${feedback.length})`}
        >
          {feedback.length ? (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {feedback.map((f: any, i: number) => (
                <li key={i}>
                  <span className="text-xs text-muted-foreground">
                    {date(f.created_at)} · {f.type} · {f.status}
                  </span>
                  <p className="line-clamp-2 text-foreground">{f.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("admin_insights_none")}
            </p>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Section icon={History} title={t("admin_insights_section_recent")}>
          {recentActivity.length ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {recentActivity.map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-foreground">
                    {moduleLabel(a.module)} · {actionLabel(a.action)}
                    {a.label ? <span className="text-muted-foreground"> · {a.label}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{dateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("admin_insights_none")}</p>
          )}
        </Section>
        <Section icon={CreditCard} title={t("admin_insights_section_billing")}>
          {!billing ? (
            <p className="text-sm text-muted-foreground">{t("admin_insights_no_billing")}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t("admin_insights_total_paid")}
                  value={`$${(billing.totalPaidCents / 100).toFixed(2)} ${billing.currency}`}
                />
                <Field label={t("admin_insights_failed_payments")} value={String(billing.failedPayments)} />
                <Field
                  label={t("admin_insights_card")}
                  value={
                    billing.card
                      ? `${billing.card.brand.toUpperCase()} •••• ${billing.card.last4} (${String(billing.card.expMonth).padStart(2, "0")}/${billing.card.expYear})`
                      : "—"
                  }
                />
                {billing.dashboardUrl && (
                  <a
                    href={billing.dashboardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 self-end text-sm font-medium text-primary hover:underline"
                  >
                    {t("admin_insights_open_stripe")} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              {billing.invoices.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto pt-2 text-sm">
                  {billing.invoices.map((inv, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate text-foreground">
                        {date(inv.at)} · ${(inv.amountCents / 100).toFixed(2)} ·{" "}
                        {t(`admin_insights_invoice_${inv.status}` as TranslationKey) || inv.status}
                      </span>
                      {inv.url && (
                        <a href={inv.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-primary hover:underline">
                          {inv.number || "PDF"}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Section>
      </div>

      {surveyAnswers.length > 0 && (
        <Section icon={MessageSquare} title={t("admin_insights_section_survey")}>
          <ul className="space-y-1.5 text-sm">
            {surveyAnswers.map((a, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2">
                <span className="text-foreground">
                  {t(`q_${a.question}_title` as TranslationKey)}{" "}
                  <strong>
                    {a.answer ? (/^\d$/.test(a.answer) ? `${a.answer}/5` : t(`q_${a.question}_opt_${a.answer}` as TranslationKey)) : ""}
                    {a.detail ? ` “${a.detail}”` : ""}
                  </strong>
                </span>
                <span className="text-xs text-muted-foreground">{date(a.at)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
