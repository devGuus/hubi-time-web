"use client";

/** Tela 'Controle de Horas': saldo do periodo, indicadores secundarios e graficos previsto x realizado. */
import { useEffect, useState, type KeyboardEvent } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { AlertCircle, CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Gauge, Lock, Scale } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { balanceDisplay } from "@/lib/balance-display";
import {
  averageDailyMinutesOf,
  balanceMinutesOf,
  computeDay,
  overtimeMinutesOfPeriod,
  summarizePeriod,
  type DayCalculation,
} from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import {
  addMonthsIso,
  formatDateBR,
  iterDates,
  monthLabel,
  monthRange,
  todayIso,
  toLocalDate,
  weekdayLabel,
  weekRange,
  type DateISO,
} from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/shared/info-tip";
import { LockedCard } from "@/components/shared/locked-card";
import { ScreenIntro } from "@/components/shared/screen-intro";

const WEEKDAY_INITIALS = "DSTQQSS";
const MASK = "••••••";

export default function HoursControlPage() {
  const { user, isPremium } = useAuth();
  const { requirePremium } = usePremiumGate();
  const [now, setNow] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState<DateISO>(todayIso().slice(0, 8) + "01");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);

  const [year, month] = monthAnchor.split("-").map(Number);
  const [start, monthEnd] = monthRange(year, month);
  const today = todayIso();
  const end = monthEnd < today ? monthEnd : today;
  const currentMonthAnchor = today.slice(0, 8) + "01";
  const isCurrentMonth = monthAnchor === currentMonthAnchor;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const supabase = createClient();
      const workRepository = new WorkRepository(supabase);
      const scheduleRepository = new ScheduleRepository(supabase);
      const [recordList, scheduleList] = await Promise.all([
        workRepository.listByRange(user.id, start, end, false),
        scheduleRepository.listHistory(user.id),
      ]);
      setRecords(recordList);
      setSchedules(scheduleList);
    })();
  }, [user, start, end]);

  // cálculo de um mes de dias e barato - não precisa de useMemo, e deixar o
  // React Compiler otimizar sozinho evita conflito com memoizacao manual.
  const byDate = new Map(records.map((r) => [r.work_date, r]));
  const days = iterDates(start, end).map((date) => {
    const record = byDate.get(date);
    const schedule = ScheduleRepository.pickEffective(schedules, date);
    return computeDay(
      {
        work_date: date,
        entry_time: record?.entry_time ?? null,
        lunch_start: record?.lunch_start ?? null,
        lunch_end: record?.lunch_end ?? null,
        exit_time: record?.exit_time ?? null,
        day_type: (record?.day_type as DayType) ?? DayType.NORMAL,
      },
      schedule ? { weekly_hours: schedule.weeklyHours, standard_entry_time: schedule.standardEntryTime } : null,
      now
    );
  });

  const summary = summarizePeriod(days, start, end);
  const balanceMinutes = balanceMinutesOf(summary);
  const overtimeMinutes = overtimeMinutesOfPeriod(summary);
  const averagePerWorkedDay = averageDailyMinutesOf(summary);

  const lockedProps = isPremium
    ? {}
    : {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": "Recurso dos planos pagos. Ative para ver os planos.",
        onClick: () => requirePremium("Controle de Horas", () => {}),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            requirePremium("Controle de Horas", () => {});
          }
        },
      };

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="controle-horas"
        title="Controle de Horas"
        description="Indicadores e graficos do seu mes."
        tips={[
          { icon: Gauge, text: "Acompanhe o saldo de horas do mes, horas extras e media por dia trabalhado num unico painel." },
          { icon: Scale, text: "Os graficos comparam horas previstas x realizadas, por dia e por semana." },
          { icon: CalendarCheck, text: "Use as setas ao lado do mes para navegar entre os periodos." },
        ]}
      />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Controle de Horas</h1>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Selecionar mês"
            className="inline-flex items-center rounded-xl bg-card p-1 ring-1 ring-foreground/10"
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setMonthAnchor(addMonthsIso(monthAnchor, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span aria-live="polite" className="min-w-32 px-2 text-center text-sm font-medium">
              {monthLabel(month)} {year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setMonthAnchor(addMonthsIso(monthAnchor, 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button
            variant="outline"
            disabled={isCurrentMonth}
            onClick={() => setMonthAnchor(currentMonthAnchor)}
          >
            Hoje
          </Button>
        </div>
      </header>

      <BalanceHero
        summary={summary}
        balanceMinutes={balanceMinutes}
        isPremium={isPremium}
        isCurrentMonth={isCurrentMonth}
        lockedProps={lockedProps}
      />

      <section
        aria-label="Indicadores do mês"
        className={cn(
          "grid grid-cols-1 divide-y divide-foreground/10 rounded-2xl bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          !isPremium && "cursor-pointer transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        )}
        {...lockedProps}
      >
        <Metric
          label="Horas extras"
          value={formatMinutesAsHours(overtimeMinutes)}
          info="Soma só dos dias em que você trabalhou além do previsto. Diferente do Saldo de horas: aqui um dia com falta não desconta um dia com hora extra — cada dia conta separado, como manda a CLT."
          locked={!isPremium}
        />
        <Metric
          label="Média por dia trabalhado"
          value={formatMinutesAsHours(averagePerWorkedDay)}
          info="Horas trabalhadas divididas apenas pelos dias em que você registrou algum horário — dias sem registro não entram na conta."
          locked={!isPremium}
        />
        <Metric
          label="Dias trabalhados"
          value={String(summary.workedDaysCount)}
          info="Quantidade de dias do período em que você registrou algum horário de trabalho."
          locked={!isPremium}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {isPremium ? (
            <DailyHoursChart days={days} />
          ) : (
            <LockedCard title="Horas trabalhadas por dia" />
          )}
        </div>
        <div className="lg:col-span-2">
          {isPremium ? (
            <WeeklyBreakdown weeks={groupByWeek(days)} />
          ) : (
            <LockedCard title="Previsto x Realizado (semanal)" />
          )}
        </div>
      </div>
    </div>
  );
}

type LockedProps = Record<string, unknown>;

function BalanceHero({
  summary,
  balanceMinutes,
  isPremium,
  isCurrentMonth,
  lockedProps,
}: {
  summary: ReturnType<typeof summarizePeriod>;
  balanceMinutes: number;
  isPremium: boolean;
  isCurrentMonth: boolean;
  lockedProps: LockedProps;
}) {
  const saldo = balanceDisplay(balanceMinutes);
  const StateIcon = saldo.icon;
  const positive = balanceMinutes >= 0;
  const stateLabel =
    balanceMinutes > 0 ? "Acima da carga prevista" : balanceMinutes < 0 ? "Abaixo da carga prevista" : "Carga prevista cumprida";
  const expectedLabel = isCurrentMonth ? "Previsto até hoje" : "Previsto";
  const { workedMinutes, expectedMinutes, workedDaysCount, incompleteDaysCount } = summary;

  return (
    <section
      aria-labelledby="saldo-title"
      className={cn(
        "grid gap-8 rounded-2xl p-6 ring-1 sm:p-8 lg:grid-cols-[1.3fr_1fr]",
        isPremium
          ? positive
            ? "bg-linear-to-br from-success/10 via-card to-card ring-success/25"
            : "bg-linear-to-br from-destructive/10 via-card to-card ring-destructive/30"
          : "cursor-pointer bg-card ring-foreground/10 transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      {...lockedProps}
    >
      <div>
        <h2
          id="saldo-title"
          className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
        >
          Saldo de horas do mês
          {isPremium ? (
            <InfoTip
              label="Saldo de horas do mês"
              text="Diferença entre horas trabalhadas e previstas no mês — pode ser positivo (trabalhou a mais) ou negativo (ficou devendo). Sempre em horas; para ver em R$, veja a tela Financeiro."
            />
          ) : (
            <Lock className="size-3.5 text-muted-foreground/60" />
          )}
        </h2>

        {isPremium ? (
          <>
            <p className={cn("mt-3 text-5xl font-semibold tabular-nums sm:text-6xl", saldo.accentClassName)}>
              {saldo.text}
            </p>
            <p className={cn("mt-2 flex items-center gap-1.5 text-base font-medium", saldo.accentClassName)}>
              <StateIcon className="size-4" aria-hidden="true" />
              {stateLabel}
            </p>
            <p className="mt-5 max-w-prose text-sm text-muted-foreground">
              {periodSummaryText({ workedMinutes, expectedMinutes, balanceMinutes, workedDaysCount, isCurrentMonth })}
            </p>
            <p
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 text-sm",
                incompleteDaysCount === 0 ? "text-success" : "text-warning"
              )}
            >
              {incompleteDaysCount === 0 ? (
                <>
                  <CheckCircle2 className="size-4" aria-hidden="true" /> Nenhum dia incompleto
                </>
              ) : (
                <>
                  <AlertCircle className="size-4" aria-hidden="true" /> {incompleteDaysCount}{" "}
                  {incompleteDaysCount === 1 ? "dia incompleto" : "dias incompletos"}
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-5xl font-semibold text-muted-foreground/60 sm:text-6xl">{MASK}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Disponível nos planos pagos. Toque para ver os planos.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col justify-center gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">Realizado</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {isPremium ? formatMinutesAsHours(workedMinutes) : MASK}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{expectedLabel}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {isPremium ? formatMinutesAsHours(expectedMinutes) : MASK}
            </dd>
          </div>
        </dl>
        {isPremium && expectedMinutes > 0 && <ProgressBar worked={workedMinutes} expected={expectedMinutes} />}
      </div>
    </section>
  );
}

/** Frase do resumo: adapta ao estado (acima, abaixo, no ponto, sem registros). */
function periodSummaryText({
  workedMinutes,
  expectedMinutes,
  balanceMinutes,
  workedDaysCount,
  isCurrentMonth,
}: {
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  workedDaysCount: number;
  isCurrentMonth: boolean;
}): string {
  const suffix = isCurrentMonth ? " previstas até hoje" : " previstas";
  if (workedDaysCount === 0) {
    return expectedMinutes > 0
      ? `Nenhum dia com horas registradas — há ${formatMinutesAsHours(expectedMinutes)}${suffix}.`
      : "Nenhuma hora registrada neste período.";
  }
  const days = `${workedDaysCount} ${workedDaysCount === 1 ? "dia" : "dias"}`;
  const worked = `Você trabalhou ${formatMinutesAsHours(workedMinutes)} em ${days}`;
  const gap = formatMinutesAsHours(Math.abs(balanceMinutes));
  const expected = `das ${formatMinutesAsHours(expectedMinutes)}${suffix}`;
  if (balanceMinutes > 0) return `${worked} — ${gap} acima ${expected}.`;
  if (balanceMinutes < 0) return `${worked} — ${gap} abaixo ${expected}.`;
  return `${worked} — exatamente ${expected.replace("das ", "as ")}.`;
}

/** Barra realizado x previsto: a marca indica a carga prevista quando ela foi ultrapassada. */
function ProgressBar({ worked, expected }: { worked: number; expected: number }) {
  const scale = Math.max(worked, expected);
  const met = worked >= expected;
  return (
    <div
      role="img"
      aria-label={`Realizado ${formatMinutesAsHours(worked)} de ${formatMinutesAsHours(expected)} previstos`}
      className="relative h-2 w-full rounded-full bg-muted"
    >
      <div
        className={cn("h-full rounded-full", met ? "bg-primary" : "bg-warning")}
        style={{ width: `${(worked / scale) * 100}%` }}
      />
      {worked > expected && (
        <span
          className="absolute -top-1 h-4 w-0.5 rounded bg-foreground/70"
          style={{ left: `${(expected / scale) * 100}%` }}
        />
      )}
    </div>
  );
}

function Metric({ label, value, info, locked }: { label: string; value: string; info: string; locked: boolean }) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {locked ? <Lock className="size-3.5 text-muted-foreground/60" /> : <InfoTip label={label} text={info} />}
      </div>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", locked && "text-muted-foreground/60")}>
        {locked ? MASK : value}
      </p>
    </div>
  );
}

interface DailyPoint {
  date: DateISO;
  day: string;
  initial: string;
  weekend: boolean;
  workedMinutes: number;
  expectedMinutes: number;
  workedHours: number;
  expectedHours: number;
}

function DailyHoursChart({ days }: { days: DayCalculation[] }) {
  const data: DailyPoint[] = days.map((d) => {
    const weekday = toLocalDate(d.workDate).getDay();
    return {
      date: d.workDate,
      day: d.workDate.slice(8, 10),
      initial: WEEKDAY_INITIALS[weekday],
      weekend: weekday === 0 || weekday === 6,
      workedMinutes: d.workedMinutes,
      expectedMinutes: d.expectedMinutes,
      workedHours: d.workedMinutes / 60,
      expectedHours: d.expectedMinutes / 60,
    };
  });
  const hasExpected = data.some((d) => d.expectedMinutes > 0);
  const hasWork = data.some((d) => d.workedMinutes > 0);
  const byDay = new Map(data.map((d) => [d.day, d]));

  return (
    <section aria-labelledby="daily-title" className="h-full rounded-2xl bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="daily-title" className="text-base font-medium">
          Horas trabalhadas por dia
        </h2>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Na jornada ou acima
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-warning" aria-hidden="true" /> Abaixo da jornada
          </li>
          {hasExpected && (
            <li className="flex items-center gap-1.5">
              <span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden="true" /> Jornada
              prevista
            </li>
          )}
        </ul>
      </div>

      {data.length === 0 || !hasWork ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem horas registradas neste período.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto" aria-hidden="true">
            <div
              className="h-56"
              style={{ minWidth: data.length * 24 + 48, maxWidth: data.length <= 10 ? data.length * 64 + 48 : undefined }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    interval={0}
                    tickLine={false}
                    axisLine={false}
                    tick={(props) => <DayTick {...props} byDay={byDay} />}
                    height={36}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    domain={[0, (max: number) => Math.max(Math.ceil(max), 1)]}
                    tickFormatter={(v: number) => `${v}h`}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip content={DayTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                  <Bar
                    dataKey="workedHours"
                    maxBarSize={28}
                    radius={[4, 4, 0, 0]}
                    animationDuration={400}
                    shape={(props: BarShapeProps) => {
                      const d = props.payload as DailyPoint;
                      const below = d.expectedMinutes > 0 && d.workedMinutes < d.expectedMinutes;
                      return <Rectangle {...props} fill={below ? "var(--warning)" : "var(--primary)"} />;
                    }}
                  />
                  {hasExpected && (
                    <Line
                      dataKey="expectedHours"
                      type="stepAfter"
                      stroke="var(--muted-foreground)"
                      strokeDasharray="4 3"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <table className="sr-only">
            <caption>Horas trabalhadas por dia</caption>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Trabalhado</th>
                <th>Previsto</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{formatDateBR(d.date)}</td>
                  <td>{formatMinutesAsHours(d.workedMinutes)}</td>
                  <td>{formatMinutesAsHours(d.expectedMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

/** Tick do eixo X: numero do dia + inicial do dia da semana, com fim de semana atenuado. */
function DayTick({
  x,
  y,
  payload,
  byDay,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value: string };
  byDay: Map<string, DailyPoint>;
}) {
  const point = payload ? byDay.get(payload.value) : undefined;
  if (!point) return null;
  const fill = point.weekend ? "var(--muted-foreground)" : "var(--foreground)";
  return (
    <g transform={`translate(${x},${y})`} fill={fill} textAnchor="middle" fontSize={11}>
      <text dy={12} opacity={point.weekend ? 0.6 : 1}>
        {point.day}
      </text>
      <text dy={25} fill="var(--muted-foreground)" fontSize={10} opacity={point.weekend ? 0.6 : 1}>
        {point.initial}
      </text>
    </g>
  );
}

function DayTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const point = payload?.[0]?.payload as DailyPoint | undefined;
  if (!active || !point) return null;
  const balance = point.workedMinutes - point.expectedMinutes;
  const status = balanceDisplay(balance);
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">
        {weekdayLabel(point.date)}, {formatDateBR(point.date)}
      </p>
      <div className="space-y-0.5 text-muted-foreground">
        <p>
          Trabalhado: <span className="font-medium tabular-nums text-foreground">{formatMinutesAsHours(point.workedMinutes)}</span>
        </p>
        {point.expectedMinutes > 0 ? (
          <>
            <p>
              Previsto: <span className="font-medium tabular-nums text-foreground">{formatMinutesAsHours(point.expectedMinutes)}</span>
            </p>
            <p>
              Saldo de horas do dia:{" "}
              <span className={cn("font-medium tabular-nums", status.accentClassName)}>
                {formatMinutesAsHours(balance, true)} {balance > 0 ? "(acima)" : balance < 0 ? "(abaixo)" : ""}
              </span>
            </p>
          </>
        ) : (
          <p>Sem jornada prevista neste dia</p>
        )}
      </div>
    </div>
  );
}

interface WeekSummary {
  key: string;
  label: string;
  range: string;
  workedMinutes: number;
  expectedMinutes: number;
}

function WeeklyBreakdown({ weeks }: { weeks: WeekSummary[] }) {
  return (
    <section aria-labelledby="weekly-title" className="h-full rounded-2xl bg-card p-6">
      <h2 id="weekly-title" className="text-base font-medium">
        Previsto x Realizado (semanal)
      </h2>
      {weeks.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Este mês ainda não começou.</p>
      ) : (
        <ul className="mt-4 space-y-5">
          {weeks.map((week) => {
            const balance = week.workedMinutes - week.expectedMinutes;
            const saldo = balanceDisplay(balance);
            const SaldoIcon = saldo.icon;
            return (
              <li key={week.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">
                    {week.label} <span className="text-xs font-normal text-muted-foreground">{week.range}</span>
                  </p>
                  <p className={cn("flex items-center gap-1 text-sm font-medium tabular-nums", saldo.accentClassName)}>
                    <SaldoIcon className="size-3.5" aria-hidden="true" />
                    <span className="sr-only">Saldo de horas:</span>
                    {saldo.text}
                  </p>
                </div>
                <div className="mt-2">
                  {week.expectedMinutes > 0 ? (
                    <ProgressBar worked={week.workedMinutes} expected={week.expectedMinutes} />
                  ) : (
                    <div className="h-2 w-full rounded-full bg-muted" aria-hidden="true" />
                  )}
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                  Realizado {formatMinutesAsHours(week.workedMinutes)} · Previsto {formatMinutesAsHours(week.expectedMinutes)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function groupByWeek(days: DayCalculation[]): WeekSummary[] {
  const weeks: DayCalculation[][] = [];
  let current: DayCalculation[] = [];
  let currentWeekStart: string | null = null;
  for (const day of days) {
    const [weekStart] = weekRange(day.workDate);
    if (currentWeekStart === null) currentWeekStart = weekStart;
    if (weekStart !== currentWeekStart) {
      weeks.push(current);
      current = [];
      currentWeekStart = weekStart;
    }
    current.push(day);
  }
  if (current.length) weeks.push(current);

  return weeks.map((week, index) => ({
    key: week[0].workDate,
    label: `Semana ${index + 1}`,
    range: `${formatDateBR(week[0].workDate).slice(0, 5)} – ${formatDateBR(week[week.length - 1].workDate).slice(0, 5)}`,
    workedMinutes: week.reduce((t, d) => t + d.workedMinutes, 0),
    expectedMinutes: week.reduce((t, d) => t + d.expectedMinutes, 0),
  }));
}
