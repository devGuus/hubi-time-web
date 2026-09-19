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

import { useAuth } from "@/lib/auth/auth-provider";
import { summarizePeriod, computeDay, type DayCalculation } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { addMonthsIso, iterDates, monthLabel, monthRange, todayIso, weekRange, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";

export default function HoursControlPage() {
  const { user } = useAuth();
  const [monthAnchor, setMonthAnchor] = useState<DateISO>(todayIso().slice(0, 8) + "01");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);

  const [year, month] = monthAnchor.split("-").map(Number);
  const [start, end] = monthRange(year, month);

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

  // Calculo de um mes de dias e barato - nao precisa de useMemo, e deixar o
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
      schedule ? { weekly_hours: schedule.weeklyHours } : null
    );
  });

  const summary = summarizePeriod(days, start, end);
  const balanceMinutes = summary.workedMinutes - summary.expectedMinutes;
  const overtimeMinutes = days.reduce((t, d) => t + Math.max(d.balanceMinutes, 0), 0);
  const averageDaily = summary.workedDaysCount ? Math.floor(summary.workedMinutes / summary.workedDaysCount) : 0;

  const dailyChartData = days.map((d) => ({
    label: d.workDate.slice(8, 10),
    horas: Math.round((d.workedMinutes / 60) * 100) / 100,
  }));

  const weeklyChartData = groupByWeek(days);

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Horas previstas" value={formatMinutesAsHours(summary.expectedMinutes)} />
        <StatCard label="Horas trabalhadas" value={formatMinutesAsHours(summary.workedMinutes)} />
        <StatCard
          label="Saldo do mes"
          value={formatMinutesAsHours(balanceMinutes, true)}
          accentClassName={balanceMinutes >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"}
        />
        <StatCard label="Media diaria" value={formatMinutesAsHours(averageDaily)} />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Dias trabalhados" value={String(summary.workedDaysCount)} />
        <StatCard label="Dias incompletos" value={String(summary.incompleteDaysCount)} />
        <StatCard label="Horas extras" value={formatMinutesAsHours(overtimeMinutes)} />
        <StatCard
          label="Banco de horas do mes"
          value={formatMinutesAsHours(balanceMinutes, true)}
          accentClassName={balanceMinutes >= 0 ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                <Tooltip />
                <Bar dataKey="horas" name="Trabalhadas (h)" fill="var(--color-chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

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
                <Tooltip />
                <Legend />
                <Bar dataKey="previsto" name="Previsto (h)" fill="var(--color-chart-2)" radius={4} />
                <Bar dataKey="realizado" name="Realizado (h)" fill="var(--color-chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
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
