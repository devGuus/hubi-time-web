"use client";

/** Tela "Hoje": visao rapida do dia atual com relogio ao vivo e registro. */
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Scale } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { computeDay } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { formatDateBR, todayIso, weekdayLabel } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import type { WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DayEditor } from "@/components/shared/day-editor";
import { StatCard } from "@/components/shared/stat-card";

export default function TodayPage() {
  const { user } = useAuth();
  const [now, setNow] = useState(new Date());
  const [schedule, setSchedule] = useState<WorkScheduleEntry | null>(null);
  const [record, setRecord] = useState<WorkRecord | null>(null);

  const today = todayIso();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const scheduleRepository = new ScheduleRepository(supabase);
    scheduleRepository.getEffectiveAt(user.id, today).then(setSchedule);
  }, [user, today]);

  const calc = record
    ? computeDay(
        {
          work_date: record.work_date,
          entry_time: record.entry_time,
          lunch_start: record.lunch_start,
          lunch_end: record.lunch_end,
          exit_time: record.exit_time,
          day_type: record.day_type as DayType,
        },
        schedule ? { weekly_hours: schedule.weeklyHours } : null,
        now
      )
    : null;

  const status = !calc
    ? "--"
    : calc.isComplete
      ? "Completo"
      : calc.isInProgress
        ? "Em andamento"
        : "Nao iniciado";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hoje, {formatDateBR(today)}</h1>
        <p className="text-muted-foreground">
          {weekdayLabel(today)} - {now.toLocaleTimeString("pt-BR")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Horas trabalhadas ate agora"
          value={calc ? formatMinutesAsHours(calc.workedMinutes) : "00h00"}
          icon={Clock}
        />
        <StatCard
          label="Saldo estimado do dia"
          value={calc ? formatMinutesAsHours(calc.balanceMinutes, true) : "00h00"}
          icon={Scale}
          accentClassName={calc && calc.balanceMinutes < 0 ? "text-destructive" : "text-success"}
        />
        <StatCard label="Situacao do registro" value={status} icon={CheckCircle2} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DayEditor workDate={today} onChanged={setRecord} />
        </CardContent>
      </Card>

      {!schedule && (
        <p className="text-sm text-muted-foreground">
          Nenhuma carga horaria configurada ainda. Defina em Configuracoes para ver o saldo previsto.
        </p>
      )}
    </div>
  );
}
