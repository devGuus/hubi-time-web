"use client";

/** Tela de calendario mensal com indicacao visual de status por dia. */
import { useCallback, useEffect, useState } from "react";
import type { DayButton } from "react-day-picker";
import { CalendarDays, Clock, MousePointerClick, Pencil } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { balanceDisplay } from "@/lib/balance-display";
import { DayType } from "@/lib/constants";
import { formatMinutesAsHours } from "@/lib/formatting";
import { monthRange, todayIso, toLocalDate, type DateISO } from "@/lib/dates";
import { detectTimeInconsistencies } from "@/lib/validators";
import { computeDay, resolveOvertimeOptions } from "@/lib/calculation-service";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DayEditor } from "@/components/shared/day-editor";
import { InfoTip } from "@/components/shared/info-tip";
import { ScreenIntro } from "@/components/shared/screen-intro";

const LEGEND = [
  { color: "bg-success", label: "Completo" },
  { color: "bg-warning", label: "Incompleto" },
  { color: "bg-destructive", label: "inconsistência" },
  { color: "bg-muted-foreground/30", label: "Sem jornada" },
  { color: "bg-primary", label: "Selecionado" },
];

const STATUS_LABEL_PT: Record<"complete" | "incomplete" | "inconsistent", string> = {
  complete: "Completo",
  incomplete: "Incompleto",
  inconsistent: "inconsistência",
};

/** Dia do calendario com preview rapido (horas trabalhadas/status) ao passar o mouse. */
function DayButtonWithPreview({
  recordsByDate,
  schedules,
  countEarlyArrivalAsOvertime,
  now,
  ...props
}: React.ComponentProps<typeof DayButton> & {
  recordsByDate: Record<DateISO, WorkRecord>;
  schedules: WorkScheduleEntry[];
  countEarlyArrivalAsOvertime?: boolean;
  now: Date;
}) {
  const dateIso = `${props.day.date.getFullYear()}-${(props.day.date.getMonth() + 1).toString().padStart(2, "0")}-${props.day.date.getDate().toString().padStart(2, "0")}`;
  const record = recordsByDate[dateIso];
  const status = statusOf(record);
  const schedule = ScheduleRepository.pickEffective(schedules, dateIso);

  const calc = record
    ? computeDay(
        {
          work_date: dateIso,
          entry_time: record.entry_time,
          lunch_start: record.lunch_start,
          lunch_end: record.lunch_end,
          exit_time: record.exit_time,
          day_type: record.day_type as DayType,
        },
        schedule ? { weekly_hours: schedule.weeklyHours, standard_entry_time: schedule.standardEntryTime } : null,
        now,
        resolveOvertimeOptions(record.count_early_arrival_as_overtime, countEarlyArrivalAsOvertime)
      )
    : null;

  return (
    <Tooltip>
      <TooltipTrigger render={<CalendarDayButton {...props} />} />
      <TooltipContent>
        {status
          ? `${STATUS_LABEL_PT[status]}${calc ? ` - ${formatMinutesAsHours(calc.workedMinutes)} trabalhadas` : ""}`
          : "Sem jornada registrada"}
      </TooltipContent>
    </Tooltip>
  );
}

function statusOf(record: WorkRecord | undefined): "complete" | "incomplete" | "inconsistent" | null {
  if (!record) return null;
  const warnings = detectTimeInconsistencies(
    record.entry_time,
    record.lunch_start,
    record.lunch_end,
    record.exit_time
  );
  if (warnings.length > 0) return "inconsistent";
  const isComplete =
    record.day_type !== DayType.NORMAL ||
    Boolean(record.entry_time && record.lunch_start && record.lunch_end && record.exit_time);
  if (isComplete) return "complete";
  if (record.entry_time || record.day_type !== DayType.NORMAL) return "incomplete";
  return null;
}

export default function CalendarPage() {
  const { user, settings } = useAuth();
  const [now, setNow] = useState(new Date());
  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState<DateISO>(today);
  const [monthCursor, setMonthCursor] = useState(toLocalDate(today));
  const [records, setRecords] = useState<Record<DateISO, WorkRecord>>({});
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);
  const [todayRecord, setTodayRecord] = useState<WorkRecord | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<WorkScheduleEntry | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadMonth = useCallback(async () => {
    if (!user) return;
    const [start, end] = monthRange(monthCursor.getFullYear(), monthCursor.getMonth() + 1);
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const scheduleRepository = new ScheduleRepository(supabase);
    const [list, scheduleList] = await Promise.all([
      workRepository.listByRange(user.id, start, end, false),
      scheduleRepository.listHistory(user.id),
    ]);
    const map: Record<DateISO, WorkRecord> = {};
    for (const r of list) map[r.work_date] = r;
    setRecords(map);
    setSchedules(scheduleList);
  }, [user, monthCursor]);

  const loadToday = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const scheduleRepository = new ScheduleRepository(supabase);
    const [record, schedule] = await Promise.all([
      workRepository.getByDate(user.id, today),
      scheduleRepository.getEffectiveAt(user.id, today),
    ]);
    setTodayRecord(record);
    setTodaySchedule(schedule);
  }, [user, today]);

  useEffect(() => {
    // busca de dados ao montar/trocar mes - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadToday();
  }, [loadToday]);

  const todayCalc = todayRecord
    ? computeDay(
        {
          work_date: todayRecord.work_date,
          entry_time: todayRecord.entry_time,
          lunch_start: todayRecord.lunch_start,
          lunch_end: todayRecord.lunch_end,
          exit_time: todayRecord.exit_time,
          day_type: todayRecord.day_type as DayType,
        },
        todaySchedule
          ? { weekly_hours: todaySchedule.weeklyHours, standard_entry_time: todaySchedule.standardEntryTime }
          : null,
        now,
        resolveOvertimeOptions(todayRecord.count_early_arrival_as_overtime, settings?.count_early_arrival_as_overtime)
      )
    : null;
  const todaySaldo = todayCalc && todaySchedule ? balanceDisplay(todayCalc.balanceMinutes) : null;
  const todayStatus = !todayCalc
    ? "--"
    : todayCalc.isComplete
      ? "Completo"
      : todayCalc.isInProgress
        ? "Em andamento"
        : "não iniciado";

  const byStatus = { complete: [] as Date[], incomplete: [] as Date[], inconsistent: [] as Date[] };
  for (const [dateIso, record] of Object.entries(records)) {
    const status = statusOf(record);
    if (status) byStatus[status].push(toLocalDate(dateIso));
  }

  const dayButton = useCallback(
    (props: React.ComponentProps<typeof CalendarDayButton>) => (
      <DayButtonWithPreview
        recordsByDate={records}
        schedules={schedules}
        countEarlyArrivalAsOvertime={settings?.count_early_arrival_as_overtime}
        now={now}
        {...props}
      />
    ),
    [records, schedules, settings?.count_early_arrival_as_overtime, now]
  );

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="calendario"
        title="Calendario"
        description="Veja e edite qualquer dia do mes num so lugar."
        tips={[
          { icon: CalendarDays, text: "As cores mostram o status de cada dia: completo, incompleto ou com inconsistência." },
          { icon: MousePointerClick, text: "Passe o mouse sobre um dia para uma prévia rapida das horas trabalhadas." },
          { icon: Pencil, text: "Clique em qualquer dia para editar os horários direto no painel ao lado." },
          { icon: Clock, text: "No final da tela, acompanhe em tempo real o resumo do dia de hoje." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Calendario</h1>

      <div className="flex flex-wrap items-center gap-4">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2.5 rounded-full ${item.color}`} />
            {item.label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="w-fit">
          <CardContent className="pt-6">
            <Calendar
              mode="single"
              selected={toLocalDate(selectedDate)}
              onSelect={(date) => date && setSelectedDate(`${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`)}
              onMonthChange={setMonthCursor}
              month={monthCursor}
              modifiers={byStatus}
              modifiersClassNames={{
                complete: "bg-success/20 text-success",
                incomplete: "bg-warning/20 text-warning",
                inconsistent: "bg-destructive/20 text-destructive",
              }}
              components={{ DayButton: dayButton }}
            />
          </CardContent>
        </Card>

        <Card className="flex-1">
          <CardContent className="pt-6">
            <DayEditor
              key={selectedDate}
              workDate={selectedDate}
              onChanged={() => {
                loadMonth();
                loadToday();
              }}
            />
          </CardContent>
        </Card>
      </div>

      <section aria-label="Resumo de hoje" className="space-y-3">
        <h2 className="text-base font-medium">Resumo de hoje</h2>
        <div className="grid grid-cols-1 divide-y divide-foreground/10 rounded-2xl bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <TodayMetric
            label="Horas trabalhadas ate agora"
            value={formatMinutesAsHours(todayCalc?.workedMinutes ?? 0)}
            info="Tempo já registrado hoje a partir da sua entrada. Atualiza sozinho enquanto o dia está em andamento."
          />
          <TodayMetric
            label="Saldo de horas do dia"
            value={todaySaldo?.text ?? "--"}
            accentClassName={todaySaldo?.accentClassName}
            info="Diferença entre o que você já trabalhou hoje e a carga prevista para o dia — é medido em horas, não em dinheiro. Positivo (+) é hora a mais; negativo (−) é hora que falta."
          />
          <TodayMetric
            label="Situacao do registro"
            value={todayStatus}
            info="Mostra se hoje está completo (entrada, almoço e saída preenchidos), em andamento, ou se você ainda não bateu o ponto."
          />
        </div>
        {!todaySchedule && (
          <p className="text-sm text-muted-foreground">
            Nenhuma carga horaria configurada ainda. Defina em Configuracoes para ver o saldo de horas previsto.
          </p>
        )}
      </section>
    </div>
  );
}

function TodayMetric({
  label,
  value,
  info,
  accentClassName,
}: {
  label: string;
  value: string;
  info: string;
  accentClassName?: string;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        <InfoTip label={label} text={info} />
      </div>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accentClassName ?? ""}`}>{value}</p>
    </div>
  );
}
