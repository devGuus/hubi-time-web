"use client";

/** Tela 'Banco de Horas': evolução do saldo acumulado desde o primeiro registro. */
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from "recharts";
import { Lock, PiggyBank, TrendingUp } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { balanceDisplay } from "@/lib/balance-display";
import { computeDay, resolveOvertimeOptions, runningBalance } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import {
  addMonthsIso,
  formatDateBR,
  iterDates,
  monthLabel,
  monthRange,
  todayIso,
  weekRange,
  yearRange,
  type DateISO,
} from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoTip } from "@/components/shared/info-tip";
import { LockedCard } from "@/components/shared/locked-card";
import { ScreenIntro } from "@/components/shared/screen-intro";

type ChartPeriod = "month" | "year" | "last12months";
type LockedProps = Record<string, unknown>;

const MASK = "••••••";

function chartRangeFor(period: ChartPeriod): [DateISO, DateISO] {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  if (period === "month") return monthRange(y, m);
  if (period === "year") return yearRange(y);
  return [addMonthsIso(`${y}-${m.toString().padStart(2, "0")}-01`, -11), today];
}

export default function BankOfHoursPage() {
  const { user, settings, isPremium } = useAuth();
  const { requirePremium } = usePremiumGate();
  const [now, setNow] = useState(new Date());
  const [period, setPeriod] = useState<ChartPeriod>("year");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);

  const today = todayIso();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const scheduleRepository = new ScheduleRepository(supabase);
    const [recordList, scheduleList] = await Promise.all([
      workRepository.listByRange(user.id, "1970-01-01", today, false),
      scheduleRepository.listHistory(user.id),
    ]);
    setRecords(recordList);
    setSchedules(scheduleList);
  }, [user, today]);

  useEffect(() => {
    // busca de dados ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const hasHistory = records.length > 0;
  const firstRecordDate = records[0]?.work_date ?? today;

  const allDays = useMemo(() => {
    const byDate = new Map(records.map((r) => [r.work_date, r]));
    return iterDates(firstRecordDate, today).map((date) => {
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
        now,
        resolveOvertimeOptions(record?.count_early_arrival_as_overtime, settings?.count_early_arrival_as_overtime)
      );
    });
  }, [records, schedules, firstRecordDate, today, settings?.count_early_arrival_as_overtime, now]);

  const byDate = new Map(allDays.map((d) => [d.workDate, d]));
  const todayCalc = byDate.get(today);
  const [weekStart, weekEnd] = weekRange(today);
  const weekDays = allDays.filter((d) => d.workDate >= weekStart && d.workDate <= weekEnd);
  const monthDays = allDays.filter((d) => d.workDate.slice(0, 7) === today.slice(0, 7));
  const yearDays = allDays.filter((d) => d.workDate.slice(0, 4) === today.slice(0, 4));

  const dailyBalance = balanceDisplay(todayCalc?.balanceMinutes ?? 0);
  const weeklyBalance = balanceDisplay(weekDays.reduce((t, d) => t + d.balanceMinutes, 0));
  const monthlyBalance = balanceDisplay(monthDays.reduce((t, d) => t + d.balanceMinutes, 0));
  const yearlyBalance = balanceDisplay(yearDays.reduce((t, d) => t + d.balanceMinutes, 0));

  const accumulatedMinutes = allDays.reduce((t, d) => t + d.balanceMinutes, 0);
  const accumulatedBalance = balanceDisplay(accumulatedMinutes);

  const [chartStart, chartEnd] = chartRangeFor(period);
  const chartDays = allDays.filter((d) => d.workDate >= chartStart && d.workDate <= chartEnd);
  const startingBalance = allDays
    .filter((d) => d.workDate < chartStart)
    .reduce((t, d) => t + d.balanceMinutes, 0);
  const running = runningBalance(chartDays, startingBalance);
  const chartData = running.map((r) => ({ date: r.date, horas: Math.round((r.balance / 60) * 100) / 100 }));
  const periodDeltaMinutes = chartDays.reduce((t, d) => t + d.balanceMinutes, 0);

  const lockedProps: LockedProps = isPremium
    ? {}
    : {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": "Recurso dos planos pagos. Ative para ver os planos.",
        onClick: () => requirePremium("Banco de Horas", () => {}),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            requirePremium("Banco de Horas", () => {});
          }
        },
      };

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="banco-horas"
        title="Banco de Horas"
        description="A evolução do seu saldo de horas acumulado."
        tips={[
          { icon: PiggyBank, text: "O saldo acumulado é desde o seu primeiro registro - diferente do saldo do ano." },
          { icon: TrendingUp, text: "O gráfico mostra como o saldo acumulado evoluiu no período escolhido." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Banco de Horas</h1>

      <AccumulatedHero
        balance={accumulatedBalance}
        positive={accumulatedMinutes >= 0}
        hasHistory={hasHistory}
        firstRecordDate={firstRecordDate}
        isPremium={isPremium}
        lockedProps={lockedProps}
      />

      <section
        aria-label="Saldo por período"
        className={cn(
          "grid grid-cols-2 divide-y divide-foreground/10 rounded-2xl bg-card sm:grid-cols-4 sm:divide-x sm:divide-y-0",
          !isPremium && "cursor-pointer transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        )}
      >
        <SecondaryBalance
          label="Hoje"
          balance={dailyBalance}
          info="Diferença entre horas trabalhadas e previstas hoje — pode ser positivo (trabalhou a mais) ou negativo (ficou devendo)."
          locked={false}
        />
        <SecondaryBalance
          label="Esta semana"
          balance={weeklyBalance}
          info="Diferença entre horas trabalhadas e previstas na semana atual."
          locked={false}
        />
        <SecondaryBalance
          label="Este mês"
          balance={monthlyBalance}
          info="Diferença entre horas trabalhadas e previstas no mês atual."
          locked={!isPremium}
          onLockedClick={() => requirePremium("Este mês", () => {})}
        />
        <SecondaryBalance
          label="Este ano"
          balance={yearlyBalance}
          info="Diferença entre horas trabalhadas e previstas no ano civil atual (1º de janeiro até hoje) — diferente do saldo acumulado, que é desde o início."
          locked={!isPremium}
          onLockedClick={() => requirePremium("Este ano", () => {})}
        />
      </section>

      {isPremium ? (
        <EvolutionChart
          period={period}
          onPeriodChange={setPeriod}
          chartData={chartData}
          periodDeltaMinutes={periodDeltaMinutes}
          today={today}
        />
      ) : (
        <LockedCard title="Evolução do banco de horas" />
      )}
    </div>
  );
}

function AccumulatedHero({
  balance,
  positive,
  hasHistory,
  firstRecordDate,
  isPremium,
  lockedProps,
}: {
  balance: ReturnType<typeof balanceDisplay>;
  positive: boolean;
  hasHistory: boolean;
  firstRecordDate: DateISO;
  isPremium: boolean;
  lockedProps: LockedProps;
}) {
  const StateIcon = balance.icon;
  const sinceLabel = hasHistory ? `Desde ${formatDateBR(firstRecordDate)}` : "Nenhum registro ainda";

  return (
    <section
      aria-labelledby="saldo-acumulado-title"
      className={cn(
        "rounded-2xl p-6 ring-1 sm:p-8",
        isPremium
          ? positive
            ? "bg-linear-to-br from-success/10 via-card to-card ring-success/25"
            : "bg-linear-to-br from-destructive/10 via-card to-card ring-destructive/30"
          : "cursor-pointer bg-card ring-foreground/10 transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      {...lockedProps}
    >
      <h2
        id="saldo-acumulado-title"
        className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
      >
        Saldo acumulado
        {isPremium ? (
          <InfoTip
            label="Saldo acumulado"
            text="Soma do saldo de todos os dias desde o seu primeiro registro no Hubi Time até hoje. Nunca reseta — é diferente do saldo do ano, que considera só o ano civil atual."
          />
        ) : (
          <Lock className="size-3.5 text-muted-foreground/60" />
        )}
      </h2>

      {isPremium ? (
        <>
          <p className={cn("mt-3 text-5xl font-semibold tabular-nums sm:text-6xl", balance.accentClassName)}>
            {balance.text}
          </p>
          <p className={cn("mt-2 flex items-center gap-1.5 text-base font-medium", balance.accentClassName)}>
            <StateIcon className="size-4" aria-hidden="true" />
            {sinceLabel}
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-5xl font-semibold text-muted-foreground/60 sm:text-6xl">{MASK}</p>
          <p className="mt-2 text-sm text-muted-foreground">Disponível nos planos pagos. Toque para ver os planos.</p>
        </>
      )}
    </section>
  );
}

function SecondaryBalance({
  label,
  balance,
  info,
  locked,
  onLockedClick,
}: {
  label: string;
  balance: ReturnType<typeof balanceDisplay>;
  info: string;
  locked: boolean;
  onLockedClick?: () => void;
}) {
  return (
    <div
      className={cn("px-6 py-5", locked && "cursor-pointer transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none")}
      onClick={locked ? onLockedClick : undefined}
      role={locked ? "button" : undefined}
      tabIndex={locked ? 0 : undefined}
      onKeyDown={
        locked
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onLockedClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {locked ? <Lock className="size-3.5 text-muted-foreground/60" /> : <InfoTip label={label} text={info} />}
      </div>
      {locked ? (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-muted-foreground/60">{MASK}</p>
      ) : (
        <p className={cn("mt-1 flex items-center gap-1 text-2xl font-semibold tabular-nums", balance.accentClassName)}>
          {balance.text}
        </p>
      )}
    </div>
  );
}

/** Ponto de ticks do eixo X: so viradas de mes (ano/12 meses) ou dias redondos (mes). */
function computeChartTicks(dates: DateISO[], period: ChartPeriod): DateISO[] {
  if (dates.length === 0) return [];
  if (period === "month") {
    const targetDays = new Set([1, 5, 10, 15, 20, 25]);
    const ticks = dates.filter((d) => targetDays.has(Number(d.slice(8, 10))));
    const last = dates[dates.length - 1];
    if (ticks[ticks.length - 1] !== last) ticks.push(last);
    return ticks;
  }
  const seenMonths = new Set<string>();
  const ticks: DateISO[] = [];
  for (const d of dates) {
    const monthKey = d.slice(0, 7);
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      ticks.push(d);
    }
  }
  return ticks;
}

function formatTick(iso: DateISO, period: ChartPeriod): string {
  if (period === "month") return iso.slice(8, 10);
  return monthLabel(Number(iso.slice(5, 7))).slice(0, 3);
}

function EvolutionChart({
  period,
  onPeriodChange,
  chartData,
  periodDeltaMinutes,
  today,
}: {
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
  chartData: { date: DateISO; horas: number }[];
  periodDeltaMinutes: number;
  today: DateISO;
}) {
  const ticks = computeChartTicks(chartData.map((d) => d.date), period);
  const values = chartData.map((d) => d.horas);
  const domainMax = Math.max(...values, 0);
  const domainMin = Math.min(...values, 0);
  const span = domainMax - domainMin;
  const zeroOffset = span === 0 ? 0.5 : domainMax / span;

  const periodContextLabel =
    period === "year"
      ? `Ano selecionado: ${today.slice(0, 4)}`
      : period === "month"
        ? `Mês selecionado: ${monthLabel(Number(today.slice(5, 7)))} de ${today.slice(0, 4)}`
        : "Últimos 12 meses";

  const periodLabel = period === "month" ? "neste mês" : period === "year" ? "neste ano" : "nos últimos 12 meses";
  const insightText =
    chartData.length < 2
      ? null
      : periodDeltaMinutes === 0
        ? `Seu saldo não mudou ${periodLabel}.`
        : `Seu saldo ${periodDeltaMinutes > 0 ? "aumentou" : "caiu"} ${formatMinutesAsHours(Math.abs(periodDeltaMinutes))} ${periodLabel}.`;

  return (
    <section aria-labelledby="evolucao-title" className="rounded-2xl bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="evolucao-title" className="text-base font-medium">
            Evolução do banco de horas
          </h2>
          <p className="text-xs text-muted-foreground">{periodContextLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período</span>
          <Select value={period} onValueChange={(v) => onPeriodChange(v as ChartPeriod)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="year">Ano atual</SelectItem>
              <SelectItem value="last12months">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Sem dados neste período.</p>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="saldoAcumuladoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset={0} stopColor="var(--success)" stopOpacity={0.25} />
                  <stop offset={zeroOffset} stopColor="var(--success)" stopOpacity={0.04} />
                  <stop offset={zeroOffset} stopColor="var(--destructive)" stopOpacity={0.04} />
                  <stop offset={1} stopColor="var(--destructive)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={(v: string) => formatTick(v, period)}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[domainMin, domainMax]}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}h`}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                width={48}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
              <Tooltip content={EvolutionTooltip} />
              <Area
                type="monotone"
                dataKey="horas"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#saldoAcumuladoGradient)"
                activeDot={{ r: 4 }}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      {insightText && <p className="mt-3 text-sm text-muted-foreground">{insightText}</p>}
    </section>
  );
}

function EvolutionTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  const point = payload?.[0]?.payload as { date: DateISO; horas: number } | undefined;
  if (!active || !point) return null;
  const status = balanceDisplay(Math.round(point.horas * 60));
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{formatDateBR(point.date)}</p>
      <p className="text-muted-foreground">Saldo acumulado</p>
      <p className={cn("font-medium tabular-nums", status.accentClassName)}>{status.text}</p>
    </div>
  );
}

