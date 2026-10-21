/**
 * Radiografía de una cuenta para /admin → Cuentas y planes → detalle (docs/166). Pedido
 * del dueño: «un full breakdown de esa cuenta: días en los que más usa la app, qué partes
 * usa más, plan, desde cuándo creó su cuenta, si ha cambiado o no de plan y todo lo que se
 * te ocurra».
 *
 * Aquí solo la parte pura (cubierta por pruebas): convierte las filas de activity_log de
 * la persona en patrones de uso. Las horas y días se cuentan en hora de Honduras (UTC−6,
 * sin horario de verano), la del dueño y la mayoría de las cuentas.
 */

export const HONDURAS_OFFSET_MS = -6 * 60 * 60 * 1000;

export interface ActivityRow {
  module: string;
  action: string;
  created_at: string;
  business_id?: string | null;
  metadata?: Record<string, unknown> | null;
  entity_label?: string | null;
}

export interface PlanChange {
  at: string;
  from: string | null;
  to: string | null;
  source: string | null;
}

export interface UsageInsights {
  totalEvents: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  /** Días distintos (hora de Honduras) con al menos una acción. */
  activeDays: number;
  /** Días activos en los últimos 7 y 30 días. */
  activeDaysLast7: number;
  activeDaysLast30: number;
  /** Racha más larga de días seguidos con uso. */
  longestStreak: number;
  /** 0 = domingo … 6 = sábado. */
  byWeekday: number[];
  /** 0 … 23, hora de Honduras. */
  byHour: number[];
  /** Visitas por módulo (acción «entered»), de más a menos. */
  moduleVisits: { module: string; count: number }[];
  /** Acciones que cambian datos (crear, editar, borrar, importar…) por módulo. */
  moduleActions: {
    module: string;
    created: number;
    updated: number;
    deleted: number;
    other: number;
    total: number;
  }[];
  /** Semanas (lunes) de las últimas 12, con su número de acciones. */
  weekly: { weekStart: string; count: number }[];
  /** Primera vez que hizo cada cosa importante. */
  milestones: { key: string; at: string }[];
  ocrReads: {
    recipe: number;
    receipt: number;
    inventory: number;
    total: number;
  };
  planChanges: PlanChange[];
}

const DAY_MS = 86_400_000;

/** Día local de Honduras como "YYYY-MM-DD". */
export function hondurasDay(iso: string): string {
  return new Date(new Date(iso).getTime() + HONDURAS_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function hondurasDate(iso: string): Date {
  return new Date(new Date(iso).getTime() + HONDURAS_OFFSET_MS);
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

const MILESTONES: { key: string; match: (r: ActivityRow) => boolean }[] = [
  {
    key: "first_ingredient",
    match: (r) =>
      r.module === "ingredientes" &&
      (r.action === "created" || r.action === "imported"),
  },
  {
    key: "first_recipe",
    match: (r) =>
      (r.module === "recetas" || r.module === "ficha_tecnica") &&
      r.action === "created",
  },
  {
    key: "first_inventory",
    match: (r) =>
      r.module === "inventario" &&
      (r.action === "created" || r.action === "imported"),
  },
  {
    key: "first_menu",
    match: (r) => r.module === "menus" && r.action === "created",
  },
  {
    key: "first_purchase_order",
    match: (r) => r.module === "ordenes_compra" && r.action === "created",
  },
  {
    key: "first_sales",
    match: (r) =>
      r.module === "estadisticas" &&
      (r.action === "imported" || r.action === "created"),
  },
  {
    key: "first_team_invite",
    match: (r) => r.module === "equipo" && r.action === "invited",
  },
  { key: "first_ocr", match: (r) => r.module === "ocr" },
];

export function computeUsageInsights(
  rows: ActivityRow[],
  now = Date.now(),
): UsageInsights {
  const sorted = [...rows].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  // Las filas de plan y de reglas de precio las escribe el sistema, no son uso de la persona.
  const usage = sorted.filter(
    (r) =>
      r.module !== "plan" &&
      r.module !== "encuesta" &&
      r.action !== "price_raised" &&
      r.action !== "margin_up",
  );

  const byWeekday = Array(7).fill(0) as number[];
  const byHour = Array(24).fill(0) as number[];
  const days = new Set<string>();
  const visits = new Map<string, number>();
  const actions = new Map<
    string,
    {
      created: number;
      updated: number;
      deleted: number;
      other: number;
      total: number;
    }
  >();
  const ocr = { recipe: 0, receipt: 0, inventory: 0, total: 0 };

  for (const row of usage) {
    const local = hondurasDate(row.created_at);
    byWeekday[local.getUTCDay()]++;
    byHour[local.getUTCHours()]++;
    days.add(hondurasDay(row.created_at));
    if (row.action === "entered") {
      visits.set(row.module, (visits.get(row.module) || 0) + 1);
    } else if (row.module === "ocr") {
      const kind = (row.metadata?.kind as string) || "";
      if (kind === "recipe" || kind === "receipt" || kind === "inventory")
        ocr[kind]++;
      ocr.total++;
    } else {
      const entry = actions.get(row.module) || {
        created: 0,
        updated: 0,
        deleted: 0,
        other: 0,
        total: 0,
      };
      if (row.action === "created") entry.created++;
      else if (row.action === "updated") entry.updated++;
      else if (row.action === "deleted") entry.deleted++;
      else entry.other++;
      entry.total++;
      actions.set(row.module, entry);
    }
  }

  const sortedDays = [...days].sort();
  let longestStreak = 0;
  let streak = 0;
  let prev: number | null = null;
  for (const day of sortedDays) {
    const t = new Date(`${day}T00:00:00Z`).getTime();
    streak = prev !== null && t - prev === DAY_MS ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    prev = t;
  }

  const today = hondurasDay(new Date(now).toISOString());
  const todayMs = new Date(`${today}T00:00:00Z`).getTime();
  const within = (n: number) =>
    sortedDays.filter(
      (d) => todayMs - new Date(`${d}T00:00:00Z`).getTime() < n * DAY_MS,
    ).length;

  const thisMonday = mondayOf(today);
  const weekly: { weekStart: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    weekly.push({
      weekStart: new Date(
        new Date(`${thisMonday}T00:00:00Z`).getTime() - i * 7 * DAY_MS,
      )
        .toISOString()
        .slice(0, 10),
      count: 0,
    });
  }
  const weekIndex = new Map(weekly.map((w, i) => [w.weekStart, i]));
  for (const row of usage) {
    const i = weekIndex.get(mondayOf(hondurasDay(row.created_at)));
    if (i !== undefined) weekly[i].count++;
  }

  const milestones: { key: string; at: string }[] = [];
  for (const m of MILESTONES) {
    const hit = usage.find(m.match);
    if (hit) milestones.push({ key: m.key, at: hit.created_at });
  }

  const planChanges: PlanChange[] = sorted
    .filter((r) => r.module === "plan" && r.action === "plan_changed")
    .map((r) => ({
      at: r.created_at,
      from: (r.metadata?.from as string) ?? null,
      to: (r.metadata?.to as string) ?? r.entity_label ?? null,
      source: (r.metadata?.source as string) ?? null,
    }));

  return {
    totalEvents: usage.length,
    firstActivityAt: usage[0]?.created_at ?? null,
    lastActivityAt: usage[usage.length - 1]?.created_at ?? null,
    activeDays: days.size,
    activeDaysLast7: within(7),
    activeDaysLast30: within(30),
    longestStreak,
    byWeekday,
    byHour,
    moduleVisits: [...visits.entries()]
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count),
    moduleActions: [...actions.entries()]
      .map(([module, v]) => ({ module, ...v }))
      .sort((a, b) => b.total - a.total),
    weekly,
    milestones: milestones.sort((a, b) => a.at.localeCompare(b.at)),
    ocrReads: ocr,
    planChanges,
  };
}
