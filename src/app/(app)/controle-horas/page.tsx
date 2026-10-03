"use client";

/** Tela 'Controle de Horas': indicadores mensais e graficos previsto x realizado. */
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, BarChart3, CalendarCheck, CheckCircle2, Clock, Flame, Gauge, Lock, Timer } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { balanceDisplay } from "@/lib/balance-display";
import { summarizePeriod, computeDay, resolveOvertimeOptions, type DayCalculation } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { addMonthsIso, iterDates, monthLabel, monthRange, todayIso, weekRange, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContent } from "@/components/shared/chart-tooltip";
import { InfoTip } from "@/components/shared/info-tip";
import { LockedCard } from "@/components/shared/locked-card";
import { ScreenIntro } from "@/components/shared/screen-intro";
import { StatCard } from "@/components/shared/stat-card";

export default function HoursControlPage() {
  const { user, settings, isPremium } = useAuth();
  const { requirePremium } = usePremiumGate();
  const [now, setNow] = useState(new Date());
  const [monthAnchor, setMonthAnchor] = useState<DateISO>(todayIso().slice(0, 8) + "01");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);

  const [year, month] = monthAnchor.split("-").map(Number);
  const [start, monthEnd] = monthRange(year, month);
  const today = todayIso();
  const end = monthEnd < today ? monthEnd : today;

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
      now,
      resolveOvertimeOptions(record?.count_early_arrival_as_overtime, settings?.count_early_arrival_as_overtime)
    );
  });

  const summary = summarizePeriod(days, start, end);
  const balanceMinutes = summary.workedMinutes - summary.expectedMinutes;
  const saldo = balanceDisplay(balanceMinutes);
  const overtimeMinutes = days.reduce((t, d) => t + Math.max(d.balanceMinutes, 0), 0);
  const averageDaily = summary.workedDaysCount ? Math.floor(summary.workedMinutes / summary.workedDaysCount) : 0;

  const dailyChartData = days.map((d) => ({
    label: d.workDate.slice(8, 10),
    horas: Math.round((d.workedMinutes / 60) * 100) / 100,
  }));

  const weeklyChartData = groupByWeek(days);

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="controle-horas"
        title="Controle de Horas"
        description="Indicadores e graficos do seu mes."
        tips={[
          { icon: Gauge, text: "Acompanhe saldo do mes, horas extras e media diaria num unico painel." },
          { icon: BarChart3, text: "Os graficos comparam horas previstas x realizadas, por dia e por semana." },
          { icon: CalendarCheck, text: "Use as setas ao lado do titulo para navegar entre os meses." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Controle de Horas</h1>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setMonthAnchor(addMonthsIso(monthAnchor, -1))}>
          {"<"}
        </Button>
        <span className="text-lg font-medium">
          {monthLabel(month)} de {year}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setMonthAnchor(addMonthsIso(monthAnchor, 1))}>
          {">"}
        </Button>
      </div>

      <Card
        className="border-primary/30 bg-primary/5"
        interactive={!isPremium}
        onClick={!isPremium ? () => requirePremium("Saldo do mes", () => {}) : undefined}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            Saldo do mes
            {isPremium ? (
              <InfoTip
                label="Saldo do mes"
                text="Diferença entre horas trabalhadas e previstas no mês — pode ser positivo (trabalhou a mais) ou negativo (ficou devendo). Sempre em horas; para ver em R$, veja a tela Financeiro."
              />
            ) : (
              <Lock className="size-3.5 text-muted-foreground/60" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-4xl font-bold tabular-nums ${isPremium ? saldo.accentClassName : "text-muted-foreground/60"}`}>
            {isPremium ? saldo.text : "••••••"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPremium
              ? balanceMinutes >= 0
                ? "acima da carga prevista"
                : "abaixo da carga prevista"
              : "Disponivel nos planos pagos"}
          </p>
        </CardContent>
      </Card>

      {isPremium ? (
        <p className="text-sm text-muted-foreground">
          {monthLabel(month)} de {year}: você trabalhou {formatMinutesAsHours(summary.workedMinutes)}, ficando{" "}
          {formatMinutesAsHours(Math.abs(balanceMinutes))} {balanceMinutes >= 0 ? "acima" : "abaixo"} das{" "}
          {formatMinutesAsHours(summary.expectedMinutes)} previstas, em {summary.workedDaysCount}{" "}
          {summary.workedDaysCount === 1 ? "dia trabalhado" : "dias trabalhados"}.{" "}
          {summary.incompleteDaysCount === 0 ? (
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3.5" /> Nenhum dia incompleto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertCircle className="size-3.5" /> {summary.incompleteDaysCount}{" "}
              {summary.incompleteDaysCount === 1 ? "dia incompleto" : "dias incompletos"}
            </span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Assine um plano pago para ver o resumo completo do seu mes, indicadores e graficos.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Horas trabalhadas"
          value={formatMinutesAsHours(summary.workedMinutes)}
          icon={Timer}
          info="Soma de todo o tempo registrado no período, incluindo horas extras."
          locked={!isPremium}
        />
        <StatCard
          label="Horas previstas"
          value={formatMinutesAsHours(summary.expectedMinutes)}
          icon={Clock}
          info="Soma da carga horária configurada para os dias do período, conforme sua jornada cadastrada."
          locked={!isPremium}
        />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Horas extras"
          value={formatMinutesAsHours(overtimeMinutes)}
          icon={Flame}
          info="Soma só dos dias em que você trabalhou além do previsto. Diferente do Saldo: aqui um dia com falta não desconta um dia com hora extra — cada dia conta separado, como manda a CLT."
          locked={!isPremium}
        />
        <StatCard
          label="Media diaria"
          value={formatMinutesAsHours(averageDaily)}
          icon={Gauge}
          info="Média de horas trabalhadas, considerando só os dias em que você registrou algum horário."
          locked={!isPremium}
        />
        <StatCard
          label="Dias trabalhados"
          value={String(summary.workedDaysCount)}
          icon={CalendarCheck}
          info="Quantidade de dias do período em que você registrou algum horário de trabalho."
          locked={!isPremium}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {isPremium ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Horas trabalhadas por dia</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip content={ChartTooltipContent} cursor={{ fill: "var(--muted)" }} />
                  <Bar
                    dataKey="horas"
                    name="Trabalhadas (h)"
                    fill="var(--color-chart-1)"
                    radius={4}
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <LockedCard title="Horas trabalhadas por dia" />
        )}

        {isPremium ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previsto x Realizado (semanal)</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip content={ChartTooltipContent} cursor={{ fill: "var(--muted)" }} />
                  <Legend />
                  <Bar
                    dataKey="previsto"
                    name="Previsto (h)"
                    fill="var(--color-chart-2)"
                    radius={4}
                    animationDuration={500}
                  />
                  <Bar
                    dataKey="realizado"
                    name="Realizado (h)"
                    fill="var(--color-chart-1)"
                    radius={4}
                    animationDuration={500}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <LockedCard title="Previsto x Realizado (semanal)" />
        )}
      </div>
    </div>
  );
}

function groupByWeek(days: DayCalculation[]) {
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
    label: `Sem ${index + 1}`,
    previsto: Math.round((week.reduce((t, d) => t + d.expectedMinutes, 0) / 60) * 100) / 100,
    realizado: Math.round((week.reduce((t, d) => t + d.workedMinutes, 0) / 60) * 100) / 100,
  }));
}
