"use client";

/**
 * Tela 'Financeiro': estimativas pessoais de valor do trabalho e horas extras.
 * Os valores exibidos sao SEMPRE estimativas de controle pessoal.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Decimal } from "decimal.js";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertCircle, BadgeDollarSign, Calculator, Coins, Flame, PiggyBank, Timer, TrendingUp, Wallet } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import {
  computeDay,
  overtimeValue,
  regularHoursValue,
  summarizePeriod,
  type DayCalculation,
} from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { iterDates, monthRange, todayIso, yearRange, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartTooltipContent } from "@/components/shared/chart-tooltip";
import { ScreenIntro } from "@/components/shared/screen-intro";
import { StatCard } from "@/components/shared/stat-card";

type PeriodOption = "month" | "quarter" | "semester" | "year";

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
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodOption>("month");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryEntry[]>([]);
  const [overtimeRules, setOvertimeRules] = useState<OvertimeRule[]>([]);

  const [start, end] = rangeFor(period);

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
        schedule ? { weekly_hours: schedule.weeklyHours } : null
      );
    });
  }, [records, schedules, start, end]);

  const summary = summarizePeriod(days, start, end);
  const currentSalary = SalaryRepository.pickEffective(salaryHistory, todayIso());
  const applicableRule = SalaryRepository.pickEffectiveRule(overtimeRules, todayIso());
  const hourlyRate = currentSalary ? hourlyRateOf(currentSalary) : new Decimal(0);
  const overtimeMinutes = days.reduce((t, d) => t + Math.max(d.balanceMinutes, 0), 0);
  const overtimeVal = overtimeValue(overtimeMinutes, hourlyRate, applicableRule);
  const regularVal = regularHoursValue(summary.workedMinutes, overtimeMinutes, hourlyRate);
  const totalVal = regularVal.plus(overtimeVal);

  const salaryChartData = [...salaryHistory]
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
    .map((s) => ({ label: s.effectiveFrom.slice(0, 7), salario: s.salary.toNumber() }));

  const monthsChartData = useMemo(() => groupByMonth(days), [days]);

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="financeiro"
        title="Financeiro"
        description="Estimativas de valor das suas horas trabalhadas."
        tips={[
          { icon: Wallet, text: "Configure seu salario e carga mensal em Configuracoes para ver os valores aqui." },
          { icon: Coins, text: "Veja estimativas de horas normais, extras e o total do periodo." },
          { icon: AlertCircle, text: "Sao estimativas para controle pessoal - nao substituem sua folha de pagamento oficial." },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm italic text-muted-foreground">
            Valores estimados para controle pessoal. Nao substituem sua folha de pagamento oficial.
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodOption)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mes atual</SelectItem>
            <SelectItem value="quarter">Trimestre atual</SelectItem>
            <SelectItem value="semester">Semestre atual</SelectItem>
            <SelectItem value="year">Ano atual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Salario mensal vigente"
          value={currentSalary ? formatBRL(currentSalary.salary) : "Nao configurado"}
          icon={Wallet}
        />
        <StatCard label="Valor estimado da hora" value={currentSalary ? formatBRL(hourlyRate) : "--"} icon={Coins} />
        <StatCard label="Horas trabalhadas" value={formatMinutesAsHours(summary.workedMinutes)} icon={Timer} />
        <StatCard label="Horas extras" value={formatMinutesAsHours(overtimeMinutes)} icon={Flame} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Banco de horas do periodo"
          value={formatMinutesAsHours(summary.workedMinutes - summary.expectedMinutes, true)}
          icon={PiggyBank}
          accentClassName={summary.workedMinutes - summary.expectedMinutes >= 0 ? "text-success" : "text-destructive"}
        />
        <StatCard label="Estimativa horas normais" value={formatBRL(regularVal)} icon={Calculator} />
        <StatCard label="Estimativa horas extras" value={formatBRL(overtimeVal)} icon={BadgeDollarSign} />
        <StatCard label="Estimativa total" value={formatBRL(totalVal)} icon={TrendingUp} accentClassName="text-primary" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolucao salarial</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas normais x extras por mes</CardTitle>
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
      </div>
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
