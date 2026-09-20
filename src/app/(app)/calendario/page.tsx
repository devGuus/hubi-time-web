"use client";

/** Tela de calendario mensal com indicacao visual de status por dia. */
import { useCallback, useEffect, useState } from "react";
import type { DayButton } from "react-day-picker";

import { useAuth } from "@/lib/auth/auth-provider";
import { DayType } from "@/lib/constants";
import { formatMinutesAsHours } from "@/lib/formatting";
import { monthRange, todayIso, toLocalDate, type DateISO } from "@/lib/dates";
import { detectTimeInconsistencies } from "@/lib/validators";
import { computeDay } from "@/lib/calculation-service";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DayEditor } from "@/components/shared/day-editor";

const LEGEND = [
  { color: "bg-success", label: "Completo" },
  { color: "bg-warning", label: "Incompleto" },
  { color: "bg-destructive", label: "Inconsistencia" },
  { color: "bg-muted-foreground/30", label: "Sem jornada" },
  { color: "bg-primary", label: "Selecionado" },
];

const STATUS_LABEL_PT: Record<"complete" | "incomplete" | "inconsistent", string> = {
  complete: "Completo",
  incomplete: "Incompleto",
  inconsistent: "Inconsistencia",
};

/** Dia do calendario com preview rapido (horas trabalhadas/status) ao passar o mouse. */
function DayButtonWithPreview({
  recordsByDate,
  ...props
}: React.ComponentProps<typeof DayButton> & { recordsByDate: Record<DateISO, WorkRecord> }) {
  const dateIso = `${props.day.date.getFullYear()}-${(props.day.date.getMonth() + 1).toString().padStart(2, "0")}-${props.day.date.getDate().toString().padStart(2, "0")}`;
  const record = recordsByDate[dateIso];
  const status = statusOf(record);

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
        null
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
  const { user } = useAuth();
  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState<DateISO>(today);
  const [monthCursor, setMonthCursor] = useState(toLocalDate(today));
  const [records, setRecords] = useState<Record<DateISO, WorkRecord>>({});

  const loadMonth = useCallback(async () => {
    if (!user) return;
    const [start, end] = monthRange(monthCursor.getFullYear(), monthCursor.getMonth() + 1);
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const list = await workRepository.listByRange(user.id, start, end, false);
    const map: Record<DateISO, WorkRecord> = {};
    for (const r of list) map[r.work_date] = r;
    setRecords(map);
  }, [user, monthCursor]);

  useEffect(() => {
    // busca de dados ao montar/trocar mes - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMonth();
  }, [loadMonth]);

  const byStatus = { complete: [] as Date[], incomplete: [] as Date[], inconsistent: [] as Date[] };
  for (const [dateIso, record] of Object.entries(records)) {
    const status = statusOf(record);
    if (status) byStatus[status].push(toLocalDate(dateIso));
  }

  const dayButton = useCallback(
    (props: React.ComponentProps<typeof CalendarDayButton>) => (
      <DayButtonWithPreview recordsByDate={records} {...props} />
    ),
    [records]
  );

  return (
    <div className="space-y-6">
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
            <DayEditor key={selectedDate} workDate={selectedDate} onChanged={() => loadMonth()} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
