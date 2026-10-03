"use client";

/**
 * Tela 'Financeiro': estimativas pessoais de valor do trabalho e horas extras.
 * Os valores exibidos sao SEMPRE estimativas de controle pessoal.
 */
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Decimal } from "decimal.js";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lock, TrendingUp, Wallet } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import {
  computeDay,
  resolveOvertimeOptions,
  overtimeValueForPeriod,
  regularHoursValue,
  summarizePeriod,
  type DayCalculation,
} from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { iterDates, monthRange, todayIso, yearRange, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";
import { formatBRL } from "@/lib/money";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import {
  hourlyRateOf,
  SalaryRepository,
  type OvertimeRule,
  type SalaryEntry,
} from "@/lib/repositories/salary-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartTooltipContent } from "@/components/shared/chart-tooltip";
import { InfoTip } from "@/components/shared/info-tip";
import { LockedCard } from "@/components/shared/locked-card";
import { ScreenIntro } from "@/components/shared/screen-intro";

type PeriodOption = "month" | "quarter" | "semester" | "year";
type LockedProps = Record<string, unknown>;

const MASK = "••••••";

const PERIOD_LABELS: Record<PeriodOption, string> = {
  month: "Mês atual",
  quarter: "Trimestre atual",
  semester: "Semestre atual",
  year: "Ano atual",
};

function rangeFor(option: PeriodOption): [DateISO, DateISO] {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  if (option === "month") return monthRange(y, m);
  if (option === "quarter") {
    const startMonth = Math.floor((m - 1) / 3) * 3 + 1;
    return [monthRange(y, startMonth)[0], monthRange(y, startMonth + 2)[1]];
  }
  if (option === "semester") {
    const startMonth = m <= 6 ? 1 : 7;
    return [monthRange(y, startMonth)[0], monthRange(y, startMonth + 5)[1]];
  }
  return yearRange(y);
}

export default function FinancePage() {
  const { user, settings, isPremium } = useAuth();
  const { requirePremium } = usePremiumGate();
  const [now, setNow] = useState(new Date());
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryEntry[]>([]);
  const [overtimeRules, setOvertimeRules] = useState<OvertimeRule[]>([]);

  const [start, periodEnd] = rangeFor(period);
  const today = todayIso();
  const end = periodEnd < today ? periodEnd : today;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const scheduleRepository = new ScheduleRepository(supabase);
    const salaryRepository = new SalaryRepository(supabase);
    const [recordList, scheduleList, salaryList, ruleList] = await Promise.all([
      workRepository.listByRange(user.id, start, end, false),
      scheduleRepository.listHistory(user.id),
      salaryRepository.listHistory(user.id),
      salaryRepository.listOvertimeRules(user.id),
    ]);
    setRecords(recordList);
    setSchedules(scheduleList);
    setSalaryHistory(salaryList);
    setOvertimeRules(ruleList);
  }, [user, start, end]);

  useEffect(() => {
    // busca de dados ao montar/trocar periodo - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const days = useMemo(() => {
    const byDate = new Map(records.map((r) => [r.work_date, r]));
    return iterDates(start, end).map((date) => {
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
  }, [records, schedules, start, end, settings?.count_early_arrival_as_overtime, now]);

  const summary = summarizePeriod(days, start, end);
  const periodBalanceMinutes = summary.workedMinutes - summary.expectedMinutes;
  const currentSalary = SalaryRepository.pickEffective(salaryHistory, todayIso());
  const hourlyRate = currentSalary ? hourlyRateOf(currentSalary) : new Decimal(0);
  const overtimeMinutes = days.reduce((t, d) => t + Math.max(d.balanceMinutes, 0), 0);
  const { overtimeVal, regularVal } = days.reduce(
    (totals, day) => {
      const salary = SalaryRepository.pickEffective(salaryHistory, day.workDate);
      if (!salary) return totals;

      const dayRate = hourlyRateOf(salary);
      const overtime = overtimeValueForPeriod(
        [day],
        dayRate,
        SalaryRepository.pickEffectiveRule(overtimeRules, day.workDate)
      );
      const regular = regularHoursValue(day.workedMinutes, Math.max(day.balanceMinutes, 0), dayRate);

      return {
        overtimeVal: totals.overtimeVal.plus(overtime),
        regularVal: totals.regularVal.plus(regular),
      };
    },
    { overtimeVal: new Decimal(0), regularVal: new Decimal(0) }
  );
  const totalVal = regularVal.plus(overtimeVal);

  const salaryChartData = [...salaryHistory]
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
    .map((s) => ({ label: s.effectiveFrom.slice(0, 7), salario: s.salary.toNumber() }));

  const monthsChartData = useMemo(() => groupByMonth(days), [days]);

  const lockedProps: LockedProps = isPremium
    ? {}
    : {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": "Recurso dos planos pagos. Ative para ver os planos.",
        onClick: () => requirePremium("Financeiro", () => {}),
        onKeyDown: (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            requirePremium("Financeiro", () => {});
          }
        },
      };

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="financeiro"
        title="Financeiro"
        description="Estimativas de valor das suas horas trabalhadas."
        tips={[
          { icon: Wallet, text: "Configure seu salario e carga mensal em Configuracoes para ver os valores aqui." },
          { icon: TrendingUp, text: "Veja a estimativa total do periodo em destaque, com o detalhamento abaixo." },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Estimativas para controle pessoal — não substituem sua folha de pagamento oficial.
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PERIOD_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 divide-y divide-foreground/10 rounded-2xl bg-card sm:divide-x sm:divide-y-0">
        <Metric
          label="Salário mensal vigente"
          value={currentSalary ? formatBRL(currentSalary.salary) : "não configurado"}
          info="Valor do salário cadastrado que está em vigor hoje, conforme o histórico em Configurações."
          locked={!isPremium}
        />
        <Metric
          label="Valor estimado da hora"
          value={currentSalary ? formatBRL(hourlyRate) : "--"}
          info="Salário mensal dividido pela carga mensal de horas (o 'divisor') — mesmo método usado em folhas de pagamento no Brasil."
          locked={!isPremium}
        />
      </div>

      <TotalHero
        totalVal={totalVal}
        regularVal={regularVal}
        overtimeVal={overtimeVal}
        workedMinutes={summary.workedMinutes}
        overtimeMinutes={overtimeMinutes}
        periodLabel={PERIOD_LABELS[period]}
        isPremium={isPremium}
        lockedProps={lockedProps}
      />

      <section
        aria-label="Detalhamento do período"
        className={cn(
          "grid grid-cols-1 divide-y divide-foreground/10 rounded-2xl bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0",
          !isPremium && "cursor-pointer transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        )}
        {...lockedProps}
      >
        <Metric
          label="Banco de horas do período"
          value={formatMinutesAsHours(periodBalanceMinutes, true)}
          info="Diferença entre horas trabalhadas e previstas no período escolhido acima — pode ser positivo (trabalhou a mais) ou negativo (ficou devendo). Sempre em horas."
          locked={!isPremium}
        />
        <Metric
          label="Estimativa horas normais"
          value={formatBRL(regularVal)}
          info="Valor estimado das horas dentro da jornada normal, ao preço da sua hora atual."
          locked={!isPremium}
        />
        <Metric
          label="Estimativa horas extras"
          value={formatBRL(overtimeVal)}
          info="Valor estimado das horas extras, já com o adicional legal (mínimo 50% em dias normais, 100% aos domingos e feriados, pela CLT)."
          locked={!isPremium}
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isPremium ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução salarial</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salaryChartData}>
                  <defs>
                    <linearGradient id="salarioGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip content={ChartTooltipContent} />
                  <Area
                    type="monotone"
                    dataKey="salario"
                    name="Salario (R$)"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#salarioGradient)"
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <LockedCard title="Evolução salarial" />
        )}

        {isPremium ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Horas normais x extras por mês</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthsChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip content={ChartTooltipContent} cursor={{ fill: "var(--muted)" }} />
                  <Legend />
                  <Bar dataKey="normais" name="Normais (h)" fill="var(--color-chart-2)" radius={4} animationDuration={500} />
                  <Bar dataKey="extras" name="Extras (h)" fill="var(--color-chart-1)" radius={4} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <LockedCard title="Horas normais x extras por mês" />
        )}
      </div>
    </div>
  );
}

function TotalHero({
  totalVal,
  regularVal,
  overtimeVal,
  workedMinutes,
  overtimeMinutes,
  periodLabel,
  isPremium,
  lockedProps,
}: {
  totalVal: Decimal;
  regularVal: Decimal;
  overtimeVal: Decimal;
  workedMinutes: number;
  overtimeMinutes: number;
  periodLabel: string;
  isPremium: boolean;
  lockedProps: LockedProps;
}) {
  const animatedTotal = useCountUp(totalVal.toNumber());

  return (
    <section
      aria-labelledby="estimativa-title"
      className={cn(
        "grid gap-8 rounded-2xl p-6 ring-1 sm:p-8 lg:grid-cols-[1.3fr_1fr]",
        isPremium
          ? "bg-linear-to-br from-primary/10 via-card to-card ring-primary/20"
          : "cursor-pointer bg-card ring-foreground/10 transition-colors hover:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
      {...lockedProps}
    >
      <div>
        <h2
          id="estimativa-title"
          className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
        >
          Estimativa total
          {isPremium ? (
            <InfoTip
              label="Estimativa total"
              text="Soma da estimativa de horas normais com a de horas extras, com base no seu salário e jornada cadastrados — uma previsão para controle pessoal, não substitui sua folha de pagamento oficial."
            />
          ) : (
            <Lock className="size-3.5 text-muted-foreground/60" />
          )}
        </h2>

        {isPremium ? (
          <>
            <p className="mt-3 text-5xl font-semibold tabular-nums text-primary sm:text-6xl">
              {formatBRL(new Decimal(animatedTotal.toFixed(2)))}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {periodLabel}: {formatBRL(regularVal)} em horas normais + {formatBRL(overtimeVal)} em horas extras.
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 text-5xl font-semibold text-muted-foreground/60 sm:text-6xl">{MASK}</p>
            <p className="mt-2 text-sm text-muted-foreground">Disponível nos planos pagos. Toque para ver os planos.</p>
          </>
        )}
      </div>

      <div className="flex flex-col justify-center gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">Horas trabalhadas</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {isPremium ? formatMinutesAsHours(workedMinutes) : MASK}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Horas extras</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {isPremium ? formatMinutesAsHours(overtimeMinutes) : MASK}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  info,
  locked,
}: {
  label: string;
  value: string;
  info: string;
  locked: boolean;
}) {
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

function groupByMonth(days: DayCalculation[]) {
  const groups = new Map<string, DayCalculation[]>();
  for (const day of days) {
    const key = day.workDate.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(day);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([label, monthDays]) => {
      const worked = monthDays.reduce((t, d) => t + d.workedMinutes, 0);
      const overtime = monthDays.reduce((t, d) => t + Math.max(d.balanceMinutes, 0), 0);
      return {
        label,
        normais: Math.round(((worked - overtime) / 60) * 100) / 100,
        extras: Math.round((overtime / 60) * 100) / 100,
      };
    });
}
