"use client";

/**
 * Tela de Configuracoes: tema, notificacoes, carga horaria, salario e horas extras.
 * Vigencias de carga horaria e salario nunca sao sobrescritas: cada alteracao
 * cria uma nova linha com effective_from.
 */
import { useCallback, useEffect, useState } from "react";
import { Decimal } from "decimal.js";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Clock, SlidersHorizontal, Wallet } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScreenIntro } from "@/components/shared/screen-intro";

const NOTIFICATION_LABELS: Record<string, string> = {
  missing_lunch_return: "Avisar quando faltar registrar o retorno do almoco",
  incomplete_today: "Avisar quando o registro do dia estiver incompleto",
  time_inconsistency: "Avisar sobre horarios inconsistentes",
  incomplete_month: "Avisar sobre registros incompletos no mes",
};

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
          { icon: Clock, text: "Em 'Jornada', defina sua carga horaria - cada mudanca cria uma nova vigencia, sem apagar o historico." },
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

        <TabsContent value="jornada" className="pt-4">
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

function ScheduleCard({ userId }: { userId: string }) {
  const [current, setCurrent] = useState<WorkScheduleEntry | null>(null);
  const [hours, setHours] = useState<Record<WeekdayKey, number>>(DEFAULT_WEEKLY_HOURS);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const repo = new ScheduleRepository(supabase);
    setCurrent(await repo.getEffectiveAt(userId, todayIso()));
  }, [userId]);

  useEffect(() => {
    // busca a vigencia atual ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const supabase = createClient();
      const repo = new ScheduleRepository(supabase);
      await repo.create(userId, effectiveFrom, hours);
      toast.success("Nova vigencia de carga horaria salva.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Carga horaria</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {current
            ? `Vigente desde ${formatDateBR(current.effectiveFrom)} - ${WEEKDAY_KEYS.map(
                (k) => `${WEEKDAY_LABELS_PT[k].slice(0, 3)}: ${current.weeklyHours[k]}h`
              ).join(" | ")}`
            : "Nenhuma carga horaria configurada ainda. Defina abaixo."}
        </p>

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

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Vigente a partir de</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar nova vigencia"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SalaryCard({ userId }: { userId: string }) {
  const [current, setCurrent] = useState<SalaryEntry | null>(null);
  const [salaryText, setSalaryText] = useState("");
  const [monthlyHours, setMonthlyHours] = useState(220);
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const repo = new SalaryRepository(supabase);
    setCurrent(await repo.getEffectiveAt(userId, todayIso()));
  }, [userId]);

  useEffect(() => {
    // busca a vigencia atual ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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
      await repo.create(userId, effectiveFrom, salary, new Decimal(monthlyHours));
      toast.success("Nova vigencia salarial salva.");
      setSalaryText("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Salario</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {current
            ? `Vigente desde ${formatDateBR(current.effectiveFrom)} - ${formatBRL(current.salary)} / ${current.monthlyHours}h - hora estimada: ${formatBRL(hourlyRateOf(current))}`
            : "Nenhum salario configurado ainda. Defina abaixo."}
        </p>

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
            {saving ? "Salvando..." : "Salvar nova vigencia"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OvertimeRulesCard({ userId }: { userId: string }) {
  const [rules, setRules] = useState<OvertimeRule[]>([]);
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
    // busca a vigencia atual ao montar - setState acontece apos o await
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Informe um nome para a regra (ex.: Hora extra 50%).");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const repo = new SalaryRepository(supabase);
      await repo.createOvertimeRule(userId, name, new Decimal(percentage), effectiveFrom);
      toast.success("Regra de hora extra adicionada.");
      setName("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
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
          <ul className="space-y-1 text-sm">
            {rules.map((rule) => (
              <li key={rule.id}>
                {rule.name} - {rule.percentage.toString()}% - vigente desde {formatDateBR(rule.effectiveFrom)}
              </li>
            ))}
          </ul>
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
            {saving ? "Salvando..." : "Adicionar regra"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
