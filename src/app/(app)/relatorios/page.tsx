"use client";

/** Tela de relatorios: exportação de jornada e financeiro em Excel/CSV/PDF. */
import { useState, type ReactNode } from "react";
import { Decimal } from "decimal.js";
import { toast } from "sonner";
import { Check, FileDown, FileSpreadsheet, FileText, Loader2, type LucideIcon } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { computeDay, overtimeValueForPeriod, regularHoursValue, resolveOvertimeOptions, summarizePeriod } from "@/lib/calculation-service";
import { DayType, DAY_TYPE_LABELS_PT } from "@/lib/constants";
import { formatDateBR, iterDates, weekdayLabel, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours, formatTimeOrPlaceholder } from "@/lib/formatting";
import { usePremiumGate } from "@/lib/hooks/use-premium-gate";
import { formatBRL } from "@/lib/money";
import { exportCsv, exportPdf, exportXlsx, FINANCE_REPORT_HEADERS, WORK_REPORT_HEADERS } from "@/lib/report-service";
import { ScheduleRepository } from "@/lib/repositories/schedule-repository";
import { hourlyRateOf, SalaryRepository } from "@/lib/repositories/salary-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodFilter, rangeForOption, type PeriodOption } from "@/components/shared/period-filter";
import { ScreenIntro } from "@/components/shared/screen-intro";
import { StepBadge } from "@/components/shared/step-badge";

type ReportType = "work" | "finance";
type ExportFormat = "xlsx" | "csv" | "pdf";

const FORMATS: { format: ExportFormat; label: string; description: string; icon: LucideIcon }[] = [
  { format: "xlsx", label: "Excel", description: "Planilha .xlsx formatada", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", description: "Dados brutos, separados por virgula", icon: FileText },
  { format: "pdf", label: "PDF", description: "Pronto para impressao", icon: FileDown },
];

/** "Data" sempre vai no arquivo - sem ela a linha não se identifica. As demais colunas o usuario escolhe. */
const MANDATORY_COLUMN = "Data";

const WORK_COLUMN_GROUPS: { title: string; columns: { key: string; label: string }[] }[] = [
  {
    title: "Horários do dia",
    columns: [
      { key: "Entrada", label: "Entrada" },
      { key: "Saida almoco", label: "Saída p/ almoço" },
      { key: "Retorno", label: "Retorno do almoço" },
      { key: "Saida", label: "Saída" },
    ],
  },
  {
    title: "Totais calculados",
    columns: [
      { key: "Horas trabalhadas", label: "Horas trabalhadas" },
      { key: "Horas previstas", label: "Horas previstas" },
      { key: "Saldo (h)", label: "Saldo de horas" },
      { key: "Horas extras", label: "Horas extras" },
    ],
  },
  {
    title: "Outras informações",
    columns: [
      { key: "Dia da semana", label: "Dia da semana" },
      { key: "Tipo de dia", label: "Tipo de dia" },
      { key: "Observacoes", label: "Observações" },
      { key: "Status", label: "Status" },
    ],
  },
];

const ALL_TOGGLEABLE_KEYS = WORK_COLUMN_GROUPS.flatMap((g) => g.columns.map((c) => c.key));

export default function ReportsPage() {
  const { user, settings } = useAuth();
  const { requirePremium } = usePremiumGate();
  const [filter, setFilter] = useState<{ option: PeriodOption; customStart: DateISO; customEnd: DateISO }>({
    option: "month",
    customStart: "",
    customEnd: "",
  });
  const [reportType, setReportType] = useState<ReportType>("work");
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(ALL_TOGGLEABLE_KEYS));
  const [loadingFormat, setLoadingFormat] = useState<ExportFormat | null>(null);
  const [succeededFormat, setSucceededFormat] = useState<ExportFormat | null>(null);

  function toggleColumn(key: string) {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const noColumnsSelected = reportType === "work" && selectedColumns.size === 0;

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
        headers = WORK_REPORT_HEADERS.filter((h) => h === MANDATORY_COLUMN || selectedColumns.has(h));
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
            "Saldo (h)": formatMinutesAsHours(day.balanceMinutes, true),
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
        const overtimeVal = overtimeValueForPeriod(days, hourlyRate, rule);
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
    <div className="space-y-8">
      <ScreenIntro
        screenKey="relatorios"
        title="Relatorios"
        description="Exporte seus dados para usar fora do app."
        tips={[
          { icon: FileSpreadsheet, text: "Configure o relatorio e escolha o formato de exportacao." },
          { icon: Check, text: "No relatorio de jornada, escolha exatamente quais colunas quer no arquivo." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Relatorios</h1>

      <StepSection step={1} title="Escolha o período e o conteúdo">
        <div className="grid gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="order-2 min-w-0 space-y-4 lg:order-1">
            {reportType === "work" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Data</span> sempre entra. Toque para incluir ou tirar
                    as demais colunas ({selectedColumns.size} de {ALL_TOGGLEABLE_KEYS.length} selecionadas).
                  </p>
                  <div className="flex gap-3 text-xs">
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setSelectedColumns(new Set(ALL_TOGGLEABLE_KEYS))}
                    >
                      Selecionar todas
                    </button>
                    <button
                      type="button"
                      className="font-medium text-muted-foreground hover:underline"
                      onClick={() => setSelectedColumns(new Set())}
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                {WORK_COLUMN_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.title}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.columns.map((col) => (
                        <ColumnChip
                          key={col.key}
                          label={col.label}
                          selected={selectedColumns.has(col.key)}
                          onToggle={() => toggleColumn(col.key)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Inclui: período, horas normais, horas extras, valor da hora e os valores estimados (normal, extra e
                total) — um resumo, não um registro dia a dia.
              </p>
            )}
          </div>

          <div className="order-1 space-y-4 lg:order-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Escolha o período</p>
              <PeriodFilter value={filter} onChange={setFilter} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Escolha o conteúdo</p>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Registros de jornada</SelectItem>
                  <SelectItem value="finance">Financeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </StepSection>

      <StepSection step={2} title="Exporte">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {FORMATS.map(({ format, label, description, icon: Icon }) => {
            const isLoading = loadingFormat === format;
            const isSuccess = succeededFormat === format;
            const disabled = loadingFormat !== null || noColumnsSelected;
            return (
              <Card
                key={format}
                interactive={!disabled}
                onClick={() => !disabled && requirePremium(`Exportar ${label}`, () => handleExport(format))}
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
                    <div className="font-medium">{isLoading ? "Exportando..." : `Exportar ${label}`}</div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {noColumnsSelected && (
          <p className="text-sm text-warning">Selecione ao menos uma coluna no passo 2 para poder exportar.</p>
        )}
      </StepSection>
    </div>
  );
}

function StepSection({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
        <StepBadge step={step} />
        {title}
      </h2>
      {children}
    </section>
  );
}

function ColumnChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {selected && <Check className="size-3.5" />}
      {label}
    </button>
  );
}
