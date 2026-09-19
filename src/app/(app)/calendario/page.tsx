"use client";

/** Tela de calendario mensal com indicacao visual de status por dia. */
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { DayType } from "@/lib/constants";
import { monthRange, todayIso, toLocalDate, type DateISO } from "@/lib/dates";
import { detectTimeInconsistencies } from "@/lib/validators";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { DayEditor } from "@/components/shared/day-editor";

const LEGEND = [
  { color: "bg-emerald-500", label: "Completo" },
  { color: "bg-amber-500", label: "Incompleto" },
  { color: "bg-red-500", label: "Inconsistencia" },
  { color: "bg-muted-foreground/30", label: "Sem jornada" },
  { color: "bg-primary", label: "Selecionado" },
];

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
                complete: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
                incomplete: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
                inconsistent: "bg-red-500/20 text-red-700 dark:text-red-400",
              }}
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
