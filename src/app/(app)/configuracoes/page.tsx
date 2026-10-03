"use client";

/**
 * Tela de Configuracoes: tema, notificações, carga horaria, salario e horas extras.
 * vigências de carga horaria e salario não sao sobrescritas ao criar uma nova
 * (cada mudanca real gera uma nova linha com effective_from) - mas o usuario
 * pode editar ou excluir uma vigência especifica para corrigir um erro de
 * cadastro (ex.: data errada, valor errado).
 */
import { useCallback, useEffect, useState } from "react";
import { Decimal } from "decimal.js";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Check, Clock, Pencil, SlidersHorizontal, Trash2, Wallet, X } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { DEFAULT_WEEKLY_HOURS, WEEKDAY_KEYS, WEEKDAY_LABELS_PT, type WeekdayKey } from "@/lib/constants";
import { formatDateBR, todayIso } from "@/lib/dates";
import { formatBRL, parseBRL } from "@/lib/money";
import { monthlyEquivalent, PAID_PLANS, savingsVsMonthly, type PaidPlanId } from "@/lib/plans";
import { ScheduleRepository, type WorkScheduleEntry } from "@/lib/repositories/schedule-repository";
import {
  hourlyRateOf,
  monthlyHoursDivisorFor,
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
  missing_lunch_return: "Avisar quando faltar registrar o retorno do almoço",
  incomplete_today: "Avisar quando o registro do dia estiver incompleto",
  time_inconsistency: "Avisar sobre horários inconsistentes",
  incomplete_month: "Avisar sobre registros incompletos no mes",
};

const PREMIUM_FEATURES = [
  "Indicadores e saldo completos em Controle de Horas e Banco de Horas",
  "Indicadores financeiros completos (salario, hora extra, saldo)",
  "Gráficos de evolução (banco de horas, salario, horas trabalhadas, previsto e realizado)",
  "Exportação de relatórios",
  "Importação de registros em lote",
];

/** Botao de excluir com confirmacao - reutilizado nas 3 listas de vigência abaixo. */
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
            Esta ação não pode ser desfeita. Os dias já calculados com base nesta vigência serão recalculados
            com a vigência anterior.
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
        description="Personalize sua jornada e preferências."
        tips={[
          { icon: SlidersHorizontal, text: "Em 'preferências', ajuste tema e notificações." },
          { icon: Clock, text: "Em 'Jornada', defina sua carga horaria e corrija vigências erradas a qualquer momento." },
          { icon: Wallet, text: "Em 'Financeiro', configure seu salario e os percentuais de hora extra." },
        ]}
      />
      <h1 className="text-2xl font-semibold">Configuracoes</h1>

      <Tabs defaultValue="preferências">
        <TabsList>
          <TabsTrigger value="preferências">preferências</TabsTrigger>
          <TabsTrigger value="jornada">Jornada</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="assinatura">Assinatura</TabsTrigger>
        </TabsList>

        <TabsContent value="preferências" className="space-y-6 pt-4">
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
              <CardTitle className="text-base">notificações</CardTitle>
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
                Chegar antes do horário de entrada, está configurado que não vale como hora extra -
                você so &quot;chegou mais cedo&quot;. Ative se quiser que qualquer chegada antecipada conte como
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
                  : "Chegada antecipada não conta como hora extra (padrão)"}
              </span>
            </CardContent>
          </Card>

          {user && <ScheduleCard userId={user.id} />}
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 pt-4">
          {user && <SalaryCard userId={user.id} />}
          {user && <OvertimeRulesCard userId={user.id} />}
        </TabsContent>

        <TabsContent value="assinatura" className="space-y-6 pt-4">
          <SubscriptionCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function emptySchedule(): Record<WeekdayKey, number> {
  return { ...DEFAULT_WEEKLY_HOURS };
}

function SubscriptionCard() {
  const { subscription, isPremium, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanId | null>(null);

  useEffect(() => {
    if (searchParams.get("assinatura")) refreshProfile().catch(() => {});
  }, [searchParams, refreshProfile]);

  async function handleSubscribe(plan: PaidPlanId) {
    setLoadingPlan(plan);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Erro ao iniciar pagamento.");
      window.location.assign(data.initPoint);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar pagamento.");
      setLoadingPlan(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-base">
          Seu plano
          {isPremium && <BadgeCheck className="size-4 text-success" />}
        </CardTitle>
        <CardDescription>
          {isPremium && subscription?.currentPeriodEnd
            ? `Plano ${PAID_PLANS[subscription.plan as PaidPlanId]?.label ?? subscription.plan} ativo ate ${formatDateBR(subscription.currentPeriodEnd)}.`
            : "Voce esta no plano Free. Assine para desbloquear relatorios, importacao, financeiro e os indicadores completos."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.values(PAID_PLANS).map((plan) => {
            const savings = savingsVsMonthly(plan);
            return (
              <div key={plan.id} className="flex flex-col gap-1 rounded-lg border border-border p-4">
                <div className="font-medium">{plan.label}</div>
                <div className="text-2xl font-semibold tabular-nums">{formatBRL(plan.price)}</div>
                <div className="text-xs text-muted-foreground">
                  {plan.periodMonths === 1
                    ? "cobrado todo mes"
                    : `equivalente a ${formatBRL(monthlyEquivalent(plan))}/mes`}
                </div>
                {savings && (
                  <span className="mt-1 inline-flex w-fit items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                    Economize {formatBRL(savings.amount)} ({savings.percent}% de desconto)
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-3 text-sm font-medium">Tudo que o Premium desbloqueia</div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {PREMIUM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {Object.values(PAID_PLANS).map((plan) => {
            const isCurrent = isPremium && subscription?.plan === plan.id;
            return (
              <Button
                key={plan.id}
                variant={isCurrent ? "outline" : "default"}
                disabled={loadingPlan !== null || isCurrent}
                onClick={() => handleSubscribe(plan.id)}
              >
                {loadingPlan === plan.id ? "Redirecionando..." : isCurrent ? "Plano atual" : `Assinar ${plan.label}`}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
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
    // busca o historico de vigências ao montar - setState acontece apos o await
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
        toast.success("vigência de carga horaria atualizada.");
      } else {
        await repo.create(userId, effectiveFrom, hours, null, null, standardEntryTime || null);
        toast.success("Nova vigência de carga horaria salva.");
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
      toast.success("vigência excluída.");
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
        <CardDescription>O horário de entrada padrão (opcional) e usado na regra de chegada antecipada acima.</CardDescription>
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
                  {entry.standardEntryTime && ` - entrada padrão ${entry.standardEntryTime}`} -{" "}
                  {WEEKDAY_KEYS.map((k) => `${WEEKDAY_LABELS_PT[k].slice(0, 3)}: ${entry.weeklyHours[k]}h`).join(" | ")}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => startEdit(entry)}>
                    <Pencil className="size-4" />
                  </Button>
                  <ConfirmDeleteButton itemLabel="esta vigência de carga horaria" onConfirm={() => handleDelete(entry.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingId && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
            <span className="flex-1">Editando vigência de {formatDateBR(effectiveFrom)}.</span>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 size-3.5" /> Cancelar edição
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
            <Label className="text-xs">horário de entrada padrão</Label>
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
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar nova vigência"}
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
  const [suggestedMonthlyHours, setSuggestedMonthlyHours] = useState<number | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const repo = new SalaryRepository(supabase);
    const scheduleRepo = new ScheduleRepository(supabase);
    const [entryList, schedule] = await Promise.all([
      repo.listHistory(userId),
      scheduleRepo.getEffectiveAt(userId, todayIso()),
    ]);
    setEntries(entryList);
    const suggestion = schedule ? monthlyHoursDivisorFor(schedule.weeklyHours) : null;
    setSuggestedMonthlyHours(suggestion);
  }, [userId]);

  useEffect(() => {
    // busca o historico salarial ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // aplica a sugestao assim que ela chega, contanto que o usuario não
    // esteja editando uma vigência existente (que já tem seu proprio valor)
    if (!editingId && suggestedMonthlyHours) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMonthlyHours(suggestedMonthlyHours);
    }
  }, [suggestedMonthlyHours, editingId]);

  function resetForm() {
    setEditingId(null);
    setSalaryText("");
    setMonthlyHours(suggestedMonthlyHours ?? 220);
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
      toast.error("Informe um valor de salario válido.");
      return;
    }
    if (salary.isNegative()) {
      toast.error("O salario não pode ser negativo.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const repo = new SalaryRepository(supabase);
      if (editingId) {
        await repo.update(editingId, userId, { effectiveFrom, salary, monthlyHours: new Decimal(monthlyHours) });
        toast.success("vigência salarial atualizada.");
      } else {
        await repo.create(userId, effectiveFrom, salary, new Decimal(monthlyHours));
        toast.success("Nova vigência salarial salva.");
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
      toast.success("vigência excluída.");
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
                  <ConfirmDeleteButton itemLabel="esta vigência salarial" onConfirm={() => handleDelete(entry.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingId && (
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2 text-sm">
            <span className="flex-1">Editando vigência de {formatDateBR(effectiveFrom)}.</span>
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <X className="mr-1 size-3.5" /> Cancelar edição
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Salario mensal (R$)</Label>
            <Input placeholder="Ex.: 3500,00" value={salaryText} onChange={(e) => setSalaryText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Divisor mensal (horas)</Label>
            <Input
              type="number"
              min={1}
              value={monthlyHours}
              onChange={(e) => setMonthlyHours(Number(e.target.value))}
            />
            <p className="max-w-56 text-xs text-muted-foreground">
              {suggestedMonthlyHours
                ? `Calculado pela sua jornada (${suggestedMonthlyHours / 5}h/semana). não e a soma de horas do mes - e o divisor legal (44h/sem = 220, 40h = 200, 36h = 180).`
                : "Divisor legal, não a soma de horas do mes (44h/sem = 220, 40h = 200, 36h = 180). Configure a jornada acima para calcular sozinho."}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vigente a partir de</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar nova vigência"}
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
      toast.success("Regra excluída.");
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
              <X className="mr-1 size-3.5" /> Cancelar edição
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
            {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar regra"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
