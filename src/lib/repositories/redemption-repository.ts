/**
 * Acesso a dados de codigos de resgate (presentes/promocoes). So e chamado
 * com o client de service role (ver src/lib/supabase/admin.ts) - a tabela tem
 * RLS habilitado sem nenhuma policy, de proposito (ver a migracao), o que
 * nega qualquer acesso de "anon"/"authenticated".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { isPaidPlanId, type PaidPlanId } from "@/lib/plans";
import type { Database } from "@/types/database";
import { translatePostgrestError } from "./errors";

type RedemptionCodeRow = Database["public"]["Tables"]["redemption_codes"]["Row"];

export interface RedemptionCode {
  id: string;
  plan: PaidPlanId;
  active: boolean;
}

function toRedemptionCode(row: RedemptionCodeRow): RedemptionCode | null {
  if (!isPaidPlanId(row.plan)) return null;
  return { id: row.id, plan: row.plan, active: row.active };
}

export class RedemptionCodeRepository {
  constructor(private client: SupabaseClient<Database>) {}

  /** Busca pelo hash do codigo. Retorna null se nao existir ou se o plano gravado for invalido. */
  async findByHash(codeHash: string): Promise<RedemptionCode | null> {
    const { data, error } = await this.client
      .from("redemption_codes")
      .select("*")
      .eq("code_hash", codeHash)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar codigo de resgate");
    return data ? toRedemptionCode(data) : null;
  }

  /**
   * Registra o uso deste codigo por este usuario. Retorna false (sem lancar
   * erro) se ele ja tiver usado este mesmo codigo antes - a constraint unique
   * (code_id, user_id) e a unica fonte de verdade, o que evita corrida entre
   * duas requisicoes simultaneas com o mesmo codigo.
   */
  async recordUse(codeId: string, userId: string): Promise<boolean> {
    const { error } = await this.client
      .from("redemption_code_uses")
      .insert({ code_id: codeId, user_id: userId });
    if (error) {
      if (error.code === "23505") return false;
      throw translatePostgrestError(error, "registrar uso do codigo de resgate");
    }
    return true;
  }
}
