"use client";

/** Tela de historico: listagem filtravel de registros e registros arquivados. */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, ListFilter, MoreHorizontal, Pencil } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { computeDay, resolveOvertimeOptions } from "@/lib/calculation-service";
import { DayType } from "@/lib/constants";
import { formatDateBR, iterDates, todayIso, type DateISO } from "@/lib/dates";
import { formatMinutesAsHours, formatTimeOrPlaceholder } from "@/lib/formatting";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import { WorkRepository, type WorkRecord } from "@/lib/repositories/work-repository";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DayEditor } from "@/components/shared/day-editor";
import { PeriodFilter, rangeForOption, type PeriodOption } from "@/components/shared/period-filter";
import { ScreenIntro } from "@/components/shared/screen-intro";

export default function HistoryPage() {
  const { user, settings } = useAuth();
  const today = todayIso();

  const [filter, setFilter] = useState<{ option: PeriodOption; customStart: DateISO; customEnd: DateISO }>({
    option: "month",
    customStart: today,
    customEnd: today,
  });
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [schedules, setSchedules] = useState<WorkScheduleEntry[]>([]);
  const [archived, setArchived] = useState<WorkRecord[]>([]);
  const [openDate, setOpenDate] = useState<DateISO | null>(null);

  const [start, end] = rangeForOption(filter.option, filter.customStart, filter.customEnd);

  const loadRecords = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    const scheduleRepository = new ScheduleRepository(supabase);
    const [recordList, scheduleList] = await Promise.all([
      workRepository.listByRange(user.id, start, end, false),
      scheduleRepository.listHistory(user.id),
    ]);
    setRecords(recordList);
    setSchedules(scheduleList);
  }, [user, start, end]);

  const loadArchived = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    setArchived(await workRepository.listArchived(user.id));
  }, [user]);

  useEffect(() => {
    // busca de dados ao montar/trocar periodo - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRecords();
  }, [loadRecords]);

  async function handleArchive(record: WorkRecord) {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    try {
      await workRepository.archive(record.id, user.id, user.id);
      toast.success("Registro arquivado.");
      await loadRecords();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao arquivar.");
    }
  }

  async function handleRestore(record: WorkRecord) {
    if (!user) return;
    const supabase = createClient();
    const workRepository = new WorkRepository(supabase);
    try {
      await workRepository.restore(record.id, user.id);
      toast.success("Registro restaurado com sucesso.");
      await loadArchived();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao restaurar.");
    }
  }

  const recordsByDate = new Map(records.map((r) => [r.work_date, r]));

  return (
    <div className="space-y-6">
      <ScreenIntro
        screenKey="historico"
        title="Historico"
        description="Consulte e filtre todos os seus registros."
        tips={[
          { icon: ListFilter, text: "Filtre por periodo: hoje, semana, mes, ano ou um intervalo personalizado." },
          { icon: MoreHorizontal, text: "Passe o mouse sobre uma linha para editar ou arquivar aquele registro." },
          { icon: Archive, text: "Registros arquivados ficam na aba 'Arquivados' e podem ser restaurados quando quiser." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Historico</h1>

      <Tabs defaultValue="registros" onValueChange={(v) => v === "arquivados" && loadArchived()}>
        <TabsList>
          <TabsTrigger value="registros">Registros</TabsTrigger>
          <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
        </TabsList>

        <TabsContent value="registros" className="space-y-4 pt-4">
          <PeriodFilter value={filter} onChange={setFilter} />

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead className="hidden md:table-cell">Almoco</TableHead>
                  <TableHead className="hidden md:table-cell">Retorno</TableHead>
                  <TableHead>Saida</TableHead>
                  <TableHead>Trabalhadas</TableHead>
                  <TableHead className="hidden md:table-cell">Previstas</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {iterDates(start, end).map((date) => {
                  const record = recordsByDate.get(date);
                  const schedule = ScheduleRepository.pickEffective(schedules, date);
                  const calc = computeDay(
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
                  return (
                    <TableRow
                      key={date}
                      className="group cursor-pointer hover:bg-accent/50"
                      onClick={() => setOpenDate(date)}
                    >
                      <TableCell>{formatDateBR(date)}</TableCell>
                      <TableCell>{formatTimeOrPlaceholder(record?.entry_time)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatTimeOrPlaceholder(record?.lunch_start)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatTimeOrPlaceholder(record?.lunch_end)}
                      </TableCell>
                      <TableCell>{formatTimeOrPlaceholder(record?.exit_time)}</TableCell>
                      <TableCell>{formatMinutesAsHours(calc.workedMinutes)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatMinutesAsHours(calc.expectedMinutes)}
                      </TableCell>
                      <TableCell>{formatMinutesAsHours(calc.balanceMinutes, true)}</TableCell>
                      <TableCell>
                        <span className={cn("font-medium", calc.isComplete ? "text-success" : "text-warning")}>
                          {calc.isComplete ? "Completo" : "Incompleto"}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                                aria-label="Acoes do registro"
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setOpenDate(date)}>
                              <Pencil className="mr-2 size-4" />
                              Editar
                            </DropdownMenuItem>
                            {record && (
                              <DropdownMenuItem onClick={() => handleArchive(record)}>
                                <Archive className="mr-2 size-4" />
                                Arquivar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="arquivados" className="pt-4">
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo de dia</TableHead>
                  <TableHead>Arquivado em</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {archived.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDateBR(record.work_date)}</TableCell>
                    <TableCell>{record.day_type}</TableCell>
                    <TableCell>
                      {record.archived_at ? new Date(record.archived_at).toLocaleString("pt-BR") : "--"}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => handleRestore(record)}>
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={openDate !== null} onOpenChange={(open) => !open && setOpenDate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registro de {openDate ? formatDateBR(openDate) : ""}</DialogTitle>
          </DialogHeader>
          {openDate && <DayEditor workDate={openDate} onChanged={() => loadRecords()} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
