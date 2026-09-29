"use client";

/** Tela "Hoje": visao rapida do dia atual com relogio ao vivo e registro. */
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Scale } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { balanceDisplay } from "@/lib/balance-display";
import { computeDay, resolveOvertimeOptions } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { formatDateBR, todayIso, weekdayLabel } from "@/lib/dates";
import { formatMinutesAsHours } from "@/lib/formatting";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import type { WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DayEditor } from "@/components/shared/day-editor";
import { ScreenIntro } from "@/components/shared/screen-intro";
import { StatCard } from "@/components/shared/stat-card";

export default function TodayPage() {
  const { user, settings } = useAuth();
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
        schedule ? { weekly_hours: schedule.weeklyHours, standard_entry_time: schedule.standardEntryTime } : null,
        now,
        resolveOvertimeOptions(record.count_early_arrival_as_overtime, settings?.count_early_arrival_as_overtime)
      )
    : null;

  const saldo = calc && schedule ? balanceDisplay(calc.balanceMinutes) : null;

  const status = !calc
    ? "--"
    : calc.isComplete
      ? "Completo"
      : calc.isInProgress
        ? "Em andamento"
        : "não iniciado";

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="hoje"
        title="Bem-vindo ao Hubi Time"
        description="Esta e a tela Hoje: sua visao rapida do dia atual."
        tips={[
          { icon: Clock, text: "Acompanhe em tempo real quantas horas você já trabalhou hoje." },
          { icon: Scale, text: "Veja o saldo estimado do dia assim que registrar seus horários." },
          { icon: CheckCircle2, text: "Registre entrada, almoço e saida direto aqui embaixo." },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold">Hoje, {formatDateBR(today)}</h1>
        <p className="text-muted-foreground" suppressHydrationWarning>
          {weekdayLabel(today)} - {now.toLocaleTimeString("pt-BR")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Horas trabalhadas ate agora"
          value={formatMinutesAsHours(calc?.workedMinutes ?? 0)}
          icon={Clock}
          info="Tempo já registrado hoje a partir da sua entrada. Atualiza sozinho enquanto o dia está em andamento."
        />
        <StatCard
          label="Saldo estimado do dia"
          value={saldo?.text ?? "--"}
          icon={saldo?.icon ?? Scale}
          accentClassName={saldo?.accentClassName}
          info="Diferença entre o que você já trabalhou hoje e a carga prevista para o dia — é medido em horas, não em dinheiro. Positivo (+) é hora a mais; negativo (−) é hora que falta."
        />
        <StatCard
          label="Situacao do registro"
          value={status}
          icon={CheckCircle2}
          info="Mostra se hoje está completo (entrada, almoço e saída preenchidos), em andamento, ou se você ainda não bateu o ponto."
        />
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
