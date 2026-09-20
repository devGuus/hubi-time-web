"use client";

/**
 * Editor de um dia de jornada: os 4 horarios, tipo de dia, observacoes,
 * avisos de inconsistencia, salvar/arquivar/restaurar e aba de historico.
 * Equivalente ao DayEditorWidget do desktop - usado em Hoje e Registrar.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/auth-provider";
import { DAY_TYPE_LABELS_PT, DayType } from "@/lib/constants";
import type { DateISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import {
  WorkRepository,
  type WorkRecord,
  type WorkRecordHistoryEntry,
} from "@/lib/repositories/work-repository";
import { ConflictError } from "@/lib/repositories/errors";
import { detectTimeInconsistencies } from "@/lib/validators";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TimeField } from "./time-field";

const FIELD_LABELS_PT: Record<string, string> = {
  entry_time: "Entrada",
  lunch_start: "Saida para almoco",
  lunch_end: "Retorno do almoco",
  exit_time: "Saida",
  day_type: "Tipo de dia",
  notes: "Observacoes",
  status: "Status",
};

function describeHistoryEntry(entry: WorkRecordHistoryEntry): string {
  const label = FIELD_LABELS_PT[entry.field_changed ?? ""] ?? entry.field_changed ?? "";
  if (entry.action === "CREATE") return `${label} registrado: ${entry.new_value}`;
  if (entry.action === "ARCHIVE") return "Registro arquivado";
  if (entry.action === "RESTORE") return "Registro restaurado";
  const old = entry.old_value || "--:--";
  return `${label} alterado: ${old} -> ${entry.new_value}`;
}

interface DayEditorProps {
  workDate: DateISO;
  onChanged?: (record: WorkRecord | null) => void;
}

export function DayEditor({ workDate, onChanged }: DayEditorProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const workRepository = new WorkRepository(supabase);

  const [record, setRecord] = useState<WorkRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [history, setHistory] = useState<WorkRecordHistoryEntry[] | null>(null);

  const [entryTime, setEntryTime] = useState<string | null>(null);
  const [lunchStart, setLunchStart] = useState<string | null>(null);
  const [lunchEnd, setLunchEnd] = useState<string | null>(null);
  const [exitTime, setExitTime] = useState<string | null>(null);
  const [dayType, setDayType] = useState<DayType>(DayType.NORMAL);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const found = await workRepository.getByDate(user.id, workDate);
      setRecord(found);
      setEntryTime(found?.entry_time?.slice(0, 5) ?? null);
      setLunchStart(found?.lunch_start?.slice(0, 5) ?? null);
      setLunchEnd(found?.lunch_end?.slice(0, 5) ?? null);
      setExitTime(found?.exit_time?.slice(0, 5) ?? null);
      setDayType((found?.day_type as DayType) ?? DayType.NORMAL);
      setNotes(found?.notes ?? "");
      setHistory(null);
      onChanged?.(found);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar o registro.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, workDate]);

  useEffect(() => {
    // `load` busca o registro no Supabase; o setState acontece so apos o
    // await (nao sincronamente), mas o `setLoading(true)` inicial dispara
    // antes disso - padrao usual de busca de dados por efeito.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const isArchived = record?.status === "archived";
  const isEditable = !isArchived;
  const warnings = detectTimeInconsistencies(entryTime, lunchStart, lunchEnd, exitTime);
  const isIncomplete =
    dayType === DayType.NORMAL && !(entryTime && lunchStart && lunchEnd && exitTime);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        entry_time: entryTime,
        lunch_start: lunchStart,
        lunch_end: lunchEnd,
        exit_time: exitTime,
        day_type: dayType,
        notes: notes.trim() || null,
      };
      const saved = record
        ? await workRepository.update(record.id, user.id, record.version, payload)
        : await workRepository.create(user.id, workDate, payload);
      setRecord(saved);
      onChanged?.(saved);
      toast.success("Registro salvo com sucesso.");
    } catch (error) {
      if (error instanceof ConflictError) {
        toast.warning(error.friendlyMessage);
        await load();
      } else {
        toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!user || !record) return;
    setArchiving(true);
    try {
      const updated = await workRepository.archive(record.id, user.id, user.id);
      setRecord(updated);
      onChanged?.(updated);
      toast.success("Registro arquivado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao arquivar.");
    } finally {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  async function handleRestore() {
    if (!user || !record) return;
    try {
      const updated = await workRepository.restore(record.id, user.id);
      setRecord(updated);
      onChanged?.(updated);
      toast.success("Registro restaurado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao restaurar.");
    }
  }

  async function loadHistory() {
    if (!user || !record || history !== null) return;
    try {
      const entries = await workRepository.getHistory(user.id, record.id);
      setHistory(entries);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar historico.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="registro" onValueChange={(v) => v === "historico" && loadHistory()}>
      <TabsList>
        <TabsTrigger value="registro">Registro</TabsTrigger>
        <TabsTrigger value="historico">Historico de alteracoes</TabsTrigger>
      </TabsList>

      <TabsContent value="registro" className="space-y-4 pt-4">
        {isIncomplete && (
          <p className="text-sm text-warning">Registro deste dia ainda esta incompleto.</p>
        )}
        {warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {warnings.map((w) => (
                <div key={w.field}>{w.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        {isArchived && (
          <p className="text-sm italic text-muted-foreground">
            Este registro esta arquivado e nao pode ser editado.
          </p>
        )}

        <div className="flex flex-wrap gap-6">
          <TimeField label="Entrada" value={entryTime} onChange={setEntryTime} disabled={!isEditable} />
          <TimeField
            label="Saida para almoco"
            value={lunchStart}
            onChange={setLunchStart}
            disabled={!isEditable}
          />
          <TimeField label="Retorno" value={lunchEnd} onChange={setLunchEnd} disabled={!isEditable} />
          <TimeField label="Saida" value={exitTime} onChange={setExitTime} disabled={!isEditable} />
        </div>

        <div className="max-w-xs space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipo de dia</Label>
          <Select value={dayType} onValueChange={(v) => setDayType(v as DayType)} disabled={!isEditable}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(DayType).map((type) => (
                <SelectItem key={type} value={type}>
                  {DAY_TYPE_LABELS_PT[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Observacoes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observacoes sobre o dia (opcional)"
            disabled={!isEditable}
            rows={3}
          />
        </div>

        <div className="flex gap-2">
          {isEditable && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          )}
          {record && !isArchived && (
            <Button variant="outline" className="text-destructive" onClick={() => setShowArchiveConfirm(true)}>
              Arquivar registro
            </Button>
          )}
          {record && isArchived && (
            <Button onClick={handleRestore}>Restaurar registro</Button>
          )}
        </div>

        <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Arquivar registro</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja arquivar este registro? Ele deixara de aparecer na listagem normal, mas podera ser
                restaurado depois em Historico &gt; Arquivados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchive} disabled={archiving}>
                Arquivar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TabsContent>

      <TabsContent value="historico" className="pt-4">
        {!record ? (
          <p className="text-sm text-muted-foreground">Salve o registro para ver o historico.</p>
        ) : history === null ? (
          <Skeleton className="h-24 w-full" />
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma alteracao registrada ainda.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {history.map((entry) => (
              <li key={entry.id} className="border-b border-border pb-2">
                <span className="text-muted-foreground">
                  {new Date(entry.changed_at).toLocaleString("pt-BR")}
                </span>{" "}
                - {describeHistoryEntry(entry)}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
