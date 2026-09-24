"use client";

/**
 * Tela de Configuracoes: tema, notificacoes, carga horaria, salario e horas extras.
 * Vigencias de carga horaria e salario nao sao sobrescritas ao criar uma nova
 * (cada mudanca real gera uma nova linha com effective_from) - mas o usuario
 * pode editar ou excluir uma vigencia especifica para corrigir um erro de
 * cadastro (ex.: data errada, valor errado).
 */
import { useCallback, useEffect, useState } from "react";
import { Decimal } from "decimal.js";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Clock, Pencil, SlidersHorizontal, Trash2, Wallet, X } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { DEFAULT_WEEKLY_HOURS, WEEKDAY_KEYS, WEEKDAY_LABELS_PT, type WeekdayKey } from "@/lib/constants";
import { formatDateBR, todayIso } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import {
  hourlyRateOf,
  SalaryRepository,
  type OvertimeRule,
  type SalaryEntry,
} from "@/lib/repositories/salary-repository";
import { createClient } from "@/lib/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenIntro } from "@/components/shared/screen-intro";

const NOTIFICATION_LABELS: Record<string, string> = {
  missing_lunch_return: "Avisar quando faltar registrar o retorno do almoco",
  incomplete_today: "Avisar quando o registro do dia estiver incompleto",
  time_inconsistency: "Avisar sobre horarios inconsistentes",
  incomplete_month: "Avisar sobre registros incompletos no mes",
};

/** Botao de excluir com confirmacao - reutilizado nas 3 listas de vigencia abaixo. */
function ConfirmDeleteButton({ itemLabel, onConfirm }: { itemLabel: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Excluir">
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {itemLabel}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acao nao pode ser desfeita. Os dias ja calculados com base nesta vigencia serao recalculados
            com a vigencia anterior.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={onConfirm}>
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SettingsPage() {
  const { user, settings, updateSettings } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="max-w-3xl space-y-6">
      <ScreenIntro
        screenKey="configuracoes"
        title="Configuracoes"
        description="Personalize sua jornada e preferencias."
        tips={[
          { icon: SlidersHorizontal, text: "Em 'Preferencias', ajuste tema e notificacoes." },
          { icon: Clock, text: "Em 'Jornada', defina sua carga horaria e corrija vigencias erradas a qualquer momento." },
          { icon: Wallet, text: "Em 'Financeiro', configure seu salario e os percentuais de hora extra." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Configuracoes</h1>

      <Tabs defaultValue="preferencias">
        <TabsList>
          <TabsTrigger value="preferencias">Preferencias</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="preferencias" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tema</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} onClick={() => { setTheme("light"); updateSettings({ theme: "light" }).catch(() => {}); }}>
                Claro
              </Button>
              <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => { setTheme("dark"); updateSettings({ theme: "dark" }).catch(() => {}); }}>
                Escuro
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notificacoes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => {
                const enabled = (settings?.notifications_enabled as Record<string, boolean> | null)?.[key] ?? true;
                return (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={enabled}
                      onCheckedChange={(checked) => {
                        const current = (settings?.notifications_enabled as Record<string, boolean>) ?? {};
                        updateSettings({ notifications_enabled: { ...current, [key]: Boolean(checked) } }).catch(
                          () => toast.error("Erro ao salvar preferencia.")
                        );
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jornada" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chegada antecipada</CardTitle>
              <CardDescription>
                Chegar antes do horario de entrada configurado abaixo nao vale como hora extra por padrao -
                voce so &quot;chegou mais cedo&quot;. Desligue se quiser que qualquer chegada antecipada conte como
                hora extra.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Switch
                checked={settings?.count_early_arrival_as_overtime ?? false}
                onCheckedChange={(checked) =>
                  updateSettings({ count_early_arrival_as_overtime: checked }).catch(() =>
                    toast.error("Erro ao salvar preferencia.")
                  )
                }
              />
              <span className="text-sm">
                {settings?.count_early_arrival_as_overtime
                  ? "Chegada antecipada sempre conta como hora extra"
                  : "Chegada antecipada nao conta como hora extra (padrao)"}
              </span>
            </CardContent>
          </Card>

          {user && <ScheduleCard userId={user.id} />}
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 pt-4">
          {user && <SalaryCard userId={user.id} />}
          {user && <OvertimeRulesCard userId={user.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function emptySchedule(): Record<WeekdayKey, number> {
  return { ...DEFAULT_WEEKLY_HOURS };
}

function ScheduleCard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<WorkScheduleEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hours, setHours] = useState<Record<WeekdayKey, number>>(emptySchedule());
  const [standardEntryTime, setStandardEntryTime] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const repo = new ScheduleRepository(supabase);
    setEntries(await repo.listHistory(userId));
  }, [userId]);

  useEffect(() => {
    // busca o historico de vigencias ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setHours(emptySchedule());
    setStandardEntryTime("");
    setEffectiveFrom(todayIso());
  }

  function startEdit(entry: WorkScheduleEntry) {
    setEditingId(entry.id);
    setHours({ ...entry.weeklyHours });
    setStandardEntryTime(entry.standardEntryTime ?? "");
    setEffectiveFrom(entry.effectiveFrom);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const repo = new ScheduleRepository(supabase);
      if (editingId) {
        await repo.update(editingId, userId, {
          effectiveFrom,
          weeklyHours: hours,
          monthlyHoursOverride: null,
          notes: null,
          standardEntryTime: standardEntryTime || null,
        });
        toast.success("Vigencia de carga horaria atualizada.");
      } else {
        await repo.create(userId, effectiveFrom, hours, null, null, standardEntryTime || null);
        toast.success("Nova vigencia de carga horaria salva.");
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = createClient();
      const repo = new ScheduleRepository(supabase);
      await repo.delete(id, userId);
      toast.success("Vigencia excluida.");
      if (editingId === id) resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Carga horaria</CardTitle>
        <CardDescription>O horario de entrada padrao (opcional) e usado na regra de chegada antecipada acima.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma carga horaria configurada ainda. Defina abaixo.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                <span className="text-muted-foreground">
                  Vigente desde {formatDateBR(entry.effectiveFrom)}
                  {entry.standardEntryTime && ` - entrada padrao ${entry.standardEntryTime}`} -{" "}
                  {WEEKDAY_KEYS.map((k) => `${WEEKDAY_LABELS_PT[k].slice(0, 3)}: ${entry.weeklyHours[k]}h`).join(" | ")}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => startEdit(entry)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDeleteButton itemLabel="esta vigencia de carga horaria" onConfirm={() => handleDelete(entry.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingId && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
            <span className="flex-1">Editando vigencia de {formatDateBR(effectiveFrom)}.</span>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 size-3.5" /> Cancelar edicao
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {WEEKDAY_KEYS.map((key) => (
            <div key={key} className="w-20 space-y-1">
              <Label className="text-xs">{WEEKDAY_LABELS_PT[key].slice(0, 3)}</Label>
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={hours[key]}
                onChange={(e) => setHours({ ...hours, [key]: Number(e.target.value) })}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Horario de entrada padrao</Label>
            <Input
              type="time"
              className="w-32"
              value={standardEntryTime}
              onChange={(e) => setStandardEntryTime(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vigente a partir de</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Salvar nova vigencia"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SalaryCard({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [salaryText, setSalaryText] = useState("");
  const [monthlyHours, setMonthlyHours] = useState(220);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const repo = new SalaryRepository(supabase);
    setEntries(await repo.listHistory(userId));
  }, [userId]);

  useEffect(() => {
    // busca o historico salarial ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setSalaryText("");
    setMonthlyHours(220);
    setEffectiveFrom(todayIso());
  }

  function startEdit(entry: SalaryEntry) {
    setEditingId(entry.id);
    setSalaryText(entry.salary.toString());
    setMonthlyHours(entry.monthlyHours.toNumber());
    setEffectiveFrom(entry.effectiveFrom);
  }

  async function handleSave() {
    let salary: Decimal;
    try {
      salary = parseBRL(salaryText);
    } catch {
      toast.error("Informe um valor de salario valido.");
      return;
    }
    if (salary.isNegative()) {
      toast.error("O salario nao pode ser negativo.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const repo = new SalaryRepository(supabase);
      if (editingId) {
        await repo.update(editingId, userId, { effectiveFrom, salary, monthlyHours: new Decimal(monthlyHours) });
        toast.success("Vigencia salarial atualizada.");
      } else {
        await repo.create(userId, effectiveFrom, salary, new Decimal(monthlyHours));
        toast.success("Nova vigencia salarial salva.");
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = createClient();
      const repo = new SalaryRepository(supabase);
      await repo.delete(id, userId);
      toast.success("Vigencia excluida.");
      if (editingId === id) resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Salario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum salario configurado ainda. Defina abaixo.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                <span className="text-muted-foreground">
                  Vigente desde {formatDateBR(entry.effectiveFrom)} - {formatBRL(entry.salary)} /{" "}
                  {entry.monthlyHours.toString()}h - hora estimada: {formatBRL(hourlyRateOf(entry))}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => startEdit(entry)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDeleteButton itemLabel="esta vigencia salarial" onConfirm={() => handleDelete(entry.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingId && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
            <span className="flex-1">Editando vigencia de {formatDateBR(effectiveFrom)}.</span>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 size-3.5" /> Cancelar edicao
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Salario mensal (R$)</Label>
            <Input placeholder="Ex.: 3500,00" value={salaryText} onChange={(e) => setSalaryText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Carga mensal (horas)</Label>
            <Input
              type="number"
              min={1}
              value={monthlyHours}
              onChange={(e) => setMonthlyHours(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vigente a partir de</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Salvar nova vigencia"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OvertimeRulesCard({ userId }: { userId: string }) {
  const [rules, setRules] = useState<OvertimeRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState(50);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const repo = new SalaryRepository(supabase);
    setRules(await repo.listOvertimeRules(userId));
  }, [userId]);

  useEffect(() => {
    // busca as regras ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPercentage(50);
    setEffectiveFrom(todayIso());
  }

  function startEdit(rule: OvertimeRule) {
    setEditingId(rule.id);
    setName(rule.name);
    setPercentage(rule.percentage.toNumber());
    setEffectiveFrom(rule.effectiveFrom);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe um nome para a regra (ex.: Hora extra 50%).");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const repo = new SalaryRepository(supabase);
      if (editingId) {
        await repo.updateOvertimeRule(editingId, userId, { name, percentage: new Decimal(percentage), effectiveFrom });
        toast.success("Regra de hora extra atualizada.");
      } else {
        await repo.createOvertimeRule(userId, name, new Decimal(percentage), effectiveFrom);
        toast.success("Regra de hora extra adicionada.");
      }
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const supabase = createClient();
      const repo = new SalaryRepository(supabase);
      await repo.deleteOvertimeRule(id, userId);
      toast.success("Regra excluida.");
      if (editingId === id) resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Percentuais de hora extra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-2">
                <span className="text-muted-foreground">
                  {rule.name} - {rule.percentage.toString()}% - vigente desde {formatDateBR(rule.effectiveFrom)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => startEdit(rule)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDeleteButton itemLabel="esta regra de hora extra" onConfirm={() => handleDelete(rule.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingId && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
            <span className="flex-1">Editando regra &quot;{name}&quot;.</span>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 size-3.5" /> Cancelar edicao
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input placeholder="Ex.: Hora extra 50%" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Percentual</Label>
            <Input type="number" min={0} value={percentage} onChange={(e) => setPercentage(Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vigente a partir de</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : editingId ? "Salvar alteracoes" : "Adicionar regra"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
