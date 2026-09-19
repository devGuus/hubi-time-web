/** Acesso a dados de work_schedule_history. */
import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_WEEKLY_HOURS, type WeekdayKey } from "@/lib/constants";
import type { DateISO } from "@/lib/dates";
import type { Database } from "@/types/database";
import { translatePostgrestError } from "./errors";

type ScheduleRow = Database["public"]["Tables"]["work_schedule_history"]["Row"];

export interface WorkScheduleEntry {
  id: string;
  userId: string;
  effectiveFrom: DateISO;
  weeklyHours: Record<WeekdayKey, number>;
  monthlyHoursOverride: number | null;
  notes: string | null;
}

function toEntry(row: ScheduleRow): WorkScheduleEntry {
  return {
    id: row.id,
    userId: row.user_id,
    effectiveFrom: row.effective_from,
    weeklyHours: { ...DEFAULT_WEEKLY_HOURS, ...(row.weekly_hours as Record<WeekdayKey, number>) },
    monthlyHoursOverride: row.monthly_hours_override,
    notes: row.notes,
  };
}

export class ScheduleRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listHistory(userId: string): Promise<WorkScheduleEntry[]> {
    const { data, error } = await this.client
      .from("work_schedule_history")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false });
    if (error) throw translatePostgrestError(error, "listar historico de carga horaria");
    return (data ?? []).map(toEntry);
  }

  async getEffectiveAt(userId: string, atDate: DateISO): Promise<WorkScheduleEntry | null> {
    const { data, error } = await this.client
      .from("work_schedule_history")
      .select("*")
      .eq("user_id", userId)
      .lte("effective_from", atDate)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar carga horaria vigente");
    return data ? toEntry(data) : null;
  }

  async create(
    userId: string,
    effectiveFrom: DateISO,
    weeklyHours: Record<WeekdayKey, number>,
    monthlyHoursOverride: number | null = null,
    notes: string | null = null
  ): Promise<WorkScheduleEntry> {
    const { data, error } = await this.client
      .from("work_schedule_history")
      .insert({
        user_id: userId,
        effective_from: effectiveFrom,
        weekly_hours: weeklyHours,
        monthly_hours_override: monthlyHoursOverride,
        notes,
      })
      .select("*")
      .single();
    if (error) throw translatePostgrestError(error, "criar vigencia de carga horaria");
    return toEntry(data);
  }

  /** Seleciona, em uma lista ja carregada, a vigencia valida para `atDate`. */
  static pickEffective(entries: WorkScheduleEntry[], atDate: DateISO): WorkScheduleEntry | null {
    const candidates = entries.filter((e) => e.effectiveFrom <= atDate);
    if (candidates.length === 0) return null;
    return candidates.reduce((latest, e) => (e.effectiveFrom > latest.effectiveFrom ? e : latest));
  }
}
