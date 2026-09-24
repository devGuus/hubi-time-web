/** Acesso a dados de work_records e work_record_history. */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { DateISO } from "@/lib/dates";
import { ConflictError, NotFoundError, translatePostgrestError } from "./errors";

export type WorkRecord = Database["public"]["Tables"]["work_records"]["Row"];
export type WorkRecordInsert = Database["public"]["Tables"]["work_records"]["Insert"];
export type WorkRecordHistoryEntry = Database["public"]["Tables"]["work_record_history"]["Row"];

export interface WorkRecordFieldsPayload {
  entry_time: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  exit_time: string | null;
  day_type: WorkRecord["day_type"];
  notes: string | null;
  /** null = segue a configuracao geral; true/false = excecao so para este dia. */
  count_early_arrival_as_overtime?: boolean | null;
}

export class WorkRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async getByDate(userId: string, workDate: DateISO): Promise<WorkRecord | null> {
    const { data, error } = await this.client
      .from("work_records")
      .select("*")
      .eq("user_id", userId)
      .eq("work_date", workDate)
      .limit(1)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar registro do dia");
    return data;
  }

  async listByRange(
    userId: string,
    startDate: DateISO,
    endDate: DateISO,
    includeArchived = false
  ): Promise<WorkRecord[]> {
    let query = this.client
      .from("work_records")
      .select("*")
      .eq("user_id", userId)
      .gte("work_date", startDate)
      .lte("work_date", endDate);
    if (!includeArchived) query = query.eq("status", "active");
    const { data, error } = await query.order("work_date", { ascending: true });
    if (error) throw translatePostgrestError(error, "listar registros do periodo");
    return data ?? [];
  }

  async listArchived(userId: string): Promise<WorkRecord[]> {
    const { data, error } = await this.client
      .from("work_records")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "archived")
      .order("work_date", { ascending: false });
    if (error) throw translatePostgrestError(error, "listar registros arquivados");
    return data ?? [];
  }

  async create(userId: string, workDate: DateISO, fields: WorkRecordFieldsPayload): Promise<WorkRecord> {
    const payload: WorkRecordInsert = { user_id: userId, work_date: workDate, ...fields };
    const { data, error } = await this.client.from("work_records").insert(payload).select("*").single();
    if (error) throw translatePostgrestError(error, "criar registro de jornada");
    return data;
  }

  /** Atualiza com verificacao de concorrencia otimista via `version`. */
  async update(
    recordId: string,
    userId: string,
    expectedVersion: number,
    fields: WorkRecordFieldsPayload
  ): Promise<WorkRecord> {
    const { data, error } = await this.client
      .from("work_records")
      .update(fields)
      .eq("id", recordId)
      .eq("user_id", userId)
      .eq("version", expectedVersion)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "atualizar registro de jornada");
    if (!data) {
      throw new ConflictError(
        "Este registro foi alterado em outro lugar. Recarregue o dia e tente novamente."
      );
    }
    return data;
  }

  async archive(recordId: string, userId: string, archivedBy: string): Promise<WorkRecord> {
    const { data, error } = await this.client
      .from("work_records")
      .update({ status: "archived", archived_at: new Date().toISOString(), archived_by: archivedBy })
      .eq("id", recordId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "arquivar registro");
    if (!data) throw new NotFoundError("Registro nao encontrado para arquivar.");
    return data;
  }

  async restore(recordId: string, userId: string): Promise<WorkRecord> {
    const { data, error } = await this.client
      .from("work_records")
      .update({ status: "active", archived_at: null, archived_by: null })
      .eq("id", recordId)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "restaurar registro");
    if (!data) throw new NotFoundError("Registro nao encontrado para restaurar.");
    return data;
  }

  async getHistory(userId: string, workRecordId: string): Promise<WorkRecordHistoryEntry[]> {
    const { data, error } = await this.client
      .from("work_record_history")
      .select("*")
      .eq("user_id", userId)
      .eq("work_record_id", workRecordId)
      .order("changed_at", { ascending: true });
    if (error) throw translatePostgrestError(error, "buscar historico do registro");
    return data ?? [];
  }
}
