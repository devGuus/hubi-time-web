"use client";

/** Tela 'Banco de Horas': saldo diario/semanal/mensal/anual/acumulado e evolucao. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PiggyBank, SlidersHorizontal, TrendingUp } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { balanceDisplay } from "@/lib/balance-display";
import { computeDay, resolveOvertimeOptions, runningBalance } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import {
  addMonthsIso,
  formatDateBR,
  iterDates,
  monthRange,
  todayIso,
  weekRange,
  yearRange,
  type DateISO,
} from "@/lib/dates";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartTooltipContent } from "@/components/shared/chart-tooltip";
import { ScreenIntro } from "@/components/shared/screen-intro";
import { StatCard } from "@/components/shared/stat-card";

type ChartPeriod = "month" | "year" | "last12months";

function rangeFor(period: ChartPeriod): [DateISO, DateISO] {
  const today = todayIso();
  const [y, m] = today.split("-").map(Number);
  if (period === "month") return monthRange(y, m);
  if (period === "year") return yearRange(y);
  return [addMonthsIso(`${y}-${m.toString().padStart(2, "0")}-01`, -11), today];
}

export default function BankOfHoursPage() {
  const { user, settings } = useAuth();
  const [period, setPeriod] = useState<ChartPeriod>("year");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);

  const today = todayIso();
  const [chartStart, chartEnd] = rangeFor(period);
  const [yearStart] = yearRange(Number(today.slice(0, 4)));
  const fetchStart = chartStart < yearStart ? chartStart : yearStart;
  const fetchEnd = chartEnd > today ? chartEnd : today;

  const load = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const scheduleRepository = new ScheduleRepository(supabase);
    const [recordList, scheduleList] = await Promise.all([
      workRepository.listByRange(user.id, fetchStart, fetchEnd, false),
      scheduleRepository.listHistory(user.id),
    ]);
    setRecords(recordList);
    setSchedules(scheduleList);
  }, [user, fetchStart, fetchEnd]);

  useEffect(() => {
    // busca de dados ao montar/trocar periodo - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const allDays = useMemo(() => {
    const byDate = new Map(records.map((r) => [r.work_date, r]));
    return iterDates(fetchStart, fetchEnd).map((date) => {
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
        undefined,
        resolveOvertimeOptions(record?.count_early_arrival_as_overtime, settings?.count_early_arrival_as_overtime)
      );
    });
  }, [records, schedules, fetchStart, fetchEnd, settings?.count_early_arrival_as_overtime]);

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

  const chartDays = allDays.filter((d) => d.workDate >= chartStart && d.workDate <= chartEnd);
  const accumulatedMinutes = chartDays.reduce((t, d) => t + d.balanceMinutes, 0);
  const accumulatedBalance = balanceDisplay(accumulatedMinutes);
  const running = runningBalance(chartDays);
  const chartData = running.map((r) => ({ label: formatDateBR(r.date).slice(0, 5), horas: Math.round((r.balance / 60) * 100) / 100 }));

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="banco-horas"
        title="Banco de Horas"
        description="Seu saldo acumulado ao longo do tempo."
        tips={[
          { icon: PiggyBank, text: "Veja o saldo do dia, da semana, do mes, do ano e o total acumulado." },
          { icon: TrendingUp, text: "O grafico mostra a evolucao do seu banco de horas no periodo escolhido." },
          { icon: SlidersHorizontal, text: "Troque o periodo (mes, ano ou ultimos 12 meses) no seletor no topo." },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Banco de Horas</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as ChartPeriod)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mes atual</SelectItem>
            <SelectItem value="year">Ano atual</SelectItem>
            <SelectItem value="last12months">Ultimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard
          label="Saldo do dia"
          value={dailyBalance.text}
          icon={dailyBalance.icon}
          accentClassName={dailyBalance.accentClassName}
        />
        <StatCard
          label="Saldo da semana"
          value={weeklyBalance.text}
          icon={weeklyBalance.icon}
          accentClassName={weeklyBalance.accentClassName}
        />
        <StatCard
          label="Saldo do mes"
          value={monthlyBalance.text}
          icon={monthlyBalance.icon}
          accentClassName={monthlyBalance.accentClassName}
        />
        <StatCard
          label="Saldo do ano"
          value={yearlyBalance.text}
          icon={yearlyBalance.icon}
          accentClassName={yearlyBalance.accentClassName}
        />
        <StatCard
          label="Saldo acumulado"
          value={accumulatedBalance.text}
          caption="Periodo selecionado"
          icon={accumulatedBalance.icon}
          accentClassName={accumulatedBalance.accentClassName}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolucao do banco de horas</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="bancoHorasGradient" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="horas"
                name="Banco de horas (h)"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                fill="url(#bancoHorasGradient)"
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
