/** Acesso a dados de salary_history e overtime_rules. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { Decimal } from "decimal.js";

import type { WeekdayKey } from "@/lib/constants";
import type { DateISO } from "@/lib/dates";
import type { Database } from "@/types/database";
import { NotFoundError, translatePostgrestError } from "./errors";

export interface SalaryEntry {
  id: string;
  userId: string;
  effectiveFrom: DateISO;
  salary: Decimal;
  monthlyHours: Decimal;
}

export interface OvertimeRule {
  id: string;
  userId: string;
  name: string;
  percentage: Decimal;
  effectiveFrom: DateISO;
}

export function hourlyRateOf(entry: SalaryEntry): Decimal {
  if (entry.monthlyHours.lessThanOrEqualTo(0)) return new Decimal(0);
  return entry.salary.dividedBy(entry.monthlyHours).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Divisor mensal padrao a partir do total de horas semanais da jornada -
 * mesma tabela usada por escritorios de contabilidade (44h -> 220, 40h ->
 * 200, 36h -> 180: sempre horas semanais x 5). Evita que o usuario digite a
 * carga semanal por engano onde deveria ir o divisor mensal. */
export function monthlyHoursDivisorFor(weeklyHours: Record<WeekdayKey, number>): number {
  const totalWeekly = Object.values(weeklyHours).reduce((sum, h) => sum + h, 0);
  return Math.round(totalWeekly * 5);
}

type SalaryRow = Database["public"]["Tables"]["salary_history"]["Row"];
type OvertimeRow = Database["public"]["Tables"]["overtime_rules"]["Row"];

function toSalaryEntry(row: SalaryRow): SalaryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    effectiveFrom: row.effective_from,
    salary: new Decimal(row.salary),
    monthlyHours: new Decimal(row.monthly_hours),
  };
}

function toOvertimeRule(row: OvertimeRow): OvertimeRule {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    percentage: new Decimal(row.percentage),
    effectiveFrom: row.effective_from,
  };
}

export class SalaryRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listHistory(userId: string): Promise<SalaryEntry[]> {
    const { data, error } = await this.client
      .from("salary_history")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false });
    if (error) throw translatePostgrestError(error, "listar historico salarial");
    return (data ?? []).map(toSalaryEntry);
  }

  async getEffectiveAt(userId: string, atDate: DateISO): Promise<SalaryEntry | null> {
    const { data, error } = await this.client
      .from("salary_history")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", atDate)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar salario vigente");
    return data ? toSalaryEntry(data) : null;
  }

  async create(userId: string, effectiveFrom: DateISO, salary: Decimal, monthlyHours: Decimal): Promise<SalaryEntry> {
    const { data, error } = await this.client
      .from("salary_history")
      .insert({
        user_id: userId,
        effective_from: effectiveFrom,
        salary: salary.toNumber(),
        monthly_hours: monthlyHours.toNumber(),
      })
      .select("*")
      .single();
    if (error) throw translatePostgrestError(error, "criar vigencia salarial");
    return toSalaryEntry(data);
  }

  async listOvertimeRules(userId: string): Promise<OvertimeRule[]> {
    const { data, error } = await this.client
      .from("overtime_rules")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false });
    if (error) throw translatePostgrestError(error, "listar regras de hora extra");
    return (data ?? []).map(toOvertimeRule);
  }

  async createOvertimeRule(
    userId: string,
    name: string,
    percentage: Decimal,
    effectiveFrom: DateISO
  ): Promise<OvertimeRule> {
    const { data, error } = await this.client
      .from("overtime_rules")
      .insert({ user_id: userId, name, percentage: percentage.toNumber(), effective_from: effectiveFrom })
      .select("*")
      .single();
    if (error) throw translatePostgrestError(error, "criar regra de hora extra");
    return toOvertimeRule(data);
  }

  async update(
    id: string,
    userId: string,
    fields: { effectiveFrom: DateISO; salary: Decimal; monthlyHours: Decimal }
  ): Promise<SalaryEntry> {
    const { data, error } = await this.client
      .from("salary_history")
      .update({
        effective_from: fields.effectiveFrom,
        salary: fields.salary.toNumber(),
        monthly_hours: fields.monthlyHours.toNumber(),
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "atualizar vigencia salarial");
    if (!data) throw new NotFoundError("Vigencia salarial nao encontrada.");
    return toSalaryEntry(data);
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.client.from("salary_history").delete().eq("id", id).eq("user_id", userId);
    if (error) throw translatePostgrestError(error, "excluir vigencia salarial");
  }

  async updateOvertimeRule(
    id: string,
    userId: string,
    fields: { name: string; percentage: Decimal; effectiveFrom: DateISO }
  ): Promise<OvertimeRule> {
    const { data, error } = await this.client
      .from("overtime_rules")
      .update({
        name: fields.name,
        percentage: fields.percentage.toNumber(),
        effective_from: fields.effectiveFrom,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "atualizar regra de hora extra");
    if (!data) throw new NotFoundError("Regra de hora extra nao encontrada.");
    return toOvertimeRule(data);
  }

  async deleteOvertimeRule(id: string, userId: string): Promise<void> {
    const { error } = await this.client.from("overtime_rules").delete().eq("id", id).eq("user_id", userId);
    if (error) throw translatePostgrestError(error, "excluir regra de hora extra");
  }

  static pickEffective(entries: SalaryEntry[], atDate: DateISO): SalaryEntry | null {
    const candidates = entries.filter((e) => e.effectiveFrom <= atDate);
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, e) => (e.effectiveFrom > latest.effectiveFrom ? e : latest));
  }

  static pickEffectiveRule(rules: OvertimeRule[], atDate: DateISO): OvertimeRule | null {
    const candidates = rules.filter((r) => r.effectiveFrom <= atDate);
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, r) => (r.effectiveFrom > latest.effectiveFrom ? r : latest));
  }
}
