/** Acesso a dados de salary_history e overtime_rules. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { Decimal } from "decimal.js";

import type { DateISO } from "@/lib/dates";
import type { Database } from "@/types/database";
import { translatePostgrestError } from "./errors";

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
