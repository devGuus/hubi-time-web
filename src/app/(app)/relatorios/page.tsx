"use client";

/** Tela de relatorios: exportacao de jornada e financeiro em Excel/CSV/PDF. */
import { useState } from "react";
import { Decimal } from "decimal.js";
import { toast } from "sonner";
import { Check, FileDown, FileSpreadsheet, FileText, ListFilter, Loader2, type LucideIcon } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { computeDay, overtimeValue, regularHoursValue, resolveOvertimeOptions, summarizePeriod } from "@/lib/calculation-service";
import { DayType, DAY_TYPE_LABELS_PT } from "@/lib/constants";
import { formatDateBR, iterDates, weekdayLabel, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours, formatTimeOrPlaceholder } from "@/lib/formatting";
import { formatBRL } from "@/lib/money";
import { exportCsv, exportPdf, exportXlsx, FINANCE_REPORT_HEADERS, WORK_REPORT_HEADERS } from "@/lib/report-service";
import { ScheduleRepository } from "@/lib/repositories/schedule-repository";
import { hourlyRateOf, SalaryRepository } from "@/lib/repositories/salary-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, rangeForOption, type PeriodOption } from "@/components/shared/period-filter";
import { ScreenIntro } from "@/components/shared/screen-intro";

type ReportType = "work" | "finance";
type ExportFormat = "xlsx" | "csv" | "pdf";

const FORMATS: { format: ExportFormat; label: string; description: string; icon: LucideIcon }[] = [
  { format: "xlsx", label: "Excel", description: "Planilha .xlsx formatada", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", description: "Dados brutos, separados por virgula", icon: FileText },
  { format: "pdf", label: "PDF", description: "Pronto para impressao", icon: FileDown },
];

export default function ReportsPage() {
  const { user, settings } = useAuth();
  const [filter, setFilter] = useState<{ option: PeriodOption; customStart: DateISO; customEnd: DateISO }>({
    option: "month",
    customStart: "",
    customEnd: "",
  });
  const [reportType, setReportType] = useState<ReportType>("work");
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const [succeededFormat, setSucceededFormat] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    if (!user) return;
    setLoadingFormat(format);
    try {
      const [start, end] = rangeForOption(filter.option, filter.customStart, filter.customEnd);
      const supabase = createClient();
      const workRepository = new WorkRepository(supabase);
      const scheduleRepository = new ScheduleRepository(supabase);

      const [records, schedules] = await Promise.all([
        workRepository.listByRange(user.id, start, end, false),
        scheduleRepository.listHistory(user.id),
      ]);
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
          undefined,
          resolveOvertimeOptions(record?.count_early_arrival_as_overtime, settings?.count_early_arrival_as_overtime)
        );
      });

      let rows: Record<string, string>[];
      let headers: string[];
      let title: string;

      if (reportType === "work") {
        headers = WORK_REPORT_HEADERS;
        title = "Relatorio de Jornada";
        rows = days.map((day) => {
          const record: WorkRecord | undefined = byDate.get(day.workDate);
          return {
            Data: formatDateBR(day.workDate),
            "Dia da semana": weekdayLabel(day.workDate),
            Entrada: formatTimeOrPlaceholder(record?.entry_time),
            "Saida almoco": formatTimeOrPlaceholder(record?.lunch_start),
            Retorno: formatTimeOrPlaceholder(record?.lunch_end),
            Saida: formatTimeOrPlaceholder(record?.exit_time),
            "Horas trabalhadas": formatMinutesAsHours(day.workedMinutes),
            "Horas previstas": formatMinutesAsHours(day.expectedMinutes),
            Saldo: formatMinutesAsHours(day.balanceMinutes, true),
            "Horas extras": formatMinutesAsHours(Math.max(day.balanceMinutes, 0)),
            "Tipo de dia": DAY_TYPE_LABELS_PT[day.dayType],
            Observacoes: record?.notes ?? "",
            Status: day.isComplete ? "Completo" : "Incompleto",
          };
        });
      } else {
        headers = FINANCE_REPORT_HEADERS;
        title = "Relatorio Financeiro (estimativa)";
        const salaryRepository = new SalaryRepository(supabase);
        const [salaryHistory, overtimeRules] = await Promise.all([
          salaryRepository.listHistory(user.id),
          salaryRepository.listOvertimeRules(user.id),
        ]);
        const salaryEntry = SalaryRepository.pickEffective(salaryHistory, end);
        const hourlyRate = salaryEntry ? hourlyRateOf(salaryEntry) : new Decimal(0);
        const rule = SalaryRepository.pickEffectiveRule(overtimeRules, end);
        const summary = summarizePeriod(days, start, end);
        const overtimeMinutes = days.reduce((t, d) => t + Math.max(d.balanceMinutes, 0), 0);
        const overtimeVal = overtimeValue(overtimeMinutes, hourlyRate, rule);
        const regularVal = regularHoursValue(summary.workedMinutes, overtimeMinutes, hourlyRate);

        rows = [
          {
            Periodo: `${formatDateBR(start)} a ${formatDateBR(end)}`,
            "Horas normais": formatMinutesAsHours(summary.workedMinutes - overtimeMinutes),
            "Horas extras": formatMinutesAsHours(overtimeMinutes),
            "Valor hora": formatBRL(hourlyRate),
            "Valor normal": formatBRL(regularVal),
            "Valor extra": formatBRL(overtimeVal),
            "Total estimado": formatBRL(regularVal.plus(overtimeVal)),
          },
        ];
      }

      const filename = `relatorio_${start}_a_${end}.${format}`;
      if (format === "xlsx") await exportXlsx(filename, rows, headers, title);
      else if (format === "csv") await exportCsv(filename, rows, headers);
      else exportPdf(filename, rows, headers, title);

      toast.success("Relatorio exportado com sucesso.");
      setSucceededFormat(format);
      setTimeout(() => setSucceededFormat(null), 1500);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao exportar relatorio.");
    } finally {
      setLoadingFormat(null);
    }
  }

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="relatorios"
        title="Relatorios"
        description="Exporte seus dados para usar fora do app."
        tips={[
          { icon: ListFilter, text: "Escolha o periodo e o tipo de relatorio: jornada ou financeiro." },
          { icon: FileSpreadsheet, text: "Exporte em Excel, CSV ou PDF com um clique nos cards abaixo." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Relatorios</h1>

      <PeriodFilter value={filter} onChange={setFilter} />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Tipo de relatorio</span>
        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="work">Registros de jornada</SelectItem>
            <SelectItem value="finance">Financeiro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FORMATS.map(({ format, label, description, icon: Icon }) => {
          const isLoading = loadingFormat === format;
          const isSuccess = succeededFormat === format;
          const disabled = loadingFormat !== null;
          return (
            <Card
              key={format}
              interactive={!disabled}
              onClick={() => !disabled && handleExport(format)}
              className={disabled && !isLoading ? "pointer-events-none opacity-50" : undefined}
            >
              <CardContent className="flex items-center gap-3 pt-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {isLoading ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : isSuccess ? (
                    <Check className="size-5 animate-in zoom-in-50 text-success" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </span>
                <div>
                  <div className="font-medium">
                    {isLoading ? "Exportando..." : `Exportar ${label}`}
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
