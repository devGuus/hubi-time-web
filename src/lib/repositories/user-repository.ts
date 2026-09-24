/** Acesso a dados de profiles e user_settings. */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { NotFoundError, translatePostgrestError } from "./errors";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type NotificationsEnabled = {
  missing_lunch_return?: boolean;
  incomplete_today?: boolean;
  time_inconsistency?: boolean;
  incomplete_month?: boolean;
};

export class UserRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.client
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar perfil");
    if (!data) throw new NotFoundError("Perfil nao encontrado.");
    return data;
  }

  async updateProfileName(userId: string, name: string): Promise<Profile> {
    const { data, error } = await this.client
      .from("profiles")
      .update({ name })
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "atualizar perfil");
    if (!data) throw new NotFoundError("Perfil nao encontrado.");
    return data;
  }

  async getSettings(userId: string): Promise<UserSettings> {
    const { data, error } = await this.client
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "buscar configuracoes");
    if (!data) throw new NotFoundError("Configuracoes nao encontradas.");
    return data;
  }

  async updateSettings(
    userId: string,
    fields: Partial<
      Pick<
        UserSettings,
        "theme" | "locale" | "notifications_enabled" | "keep_signed_in" | "count_early_arrival_as_overtime"
      >
    >
  ): Promise<UserSettings> {
    const { data, error } = await this.client
      .from("user_settings")
      .update(fields)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw translatePostgrestError(error, "atualizar configuracoes");
    if (!data) throw new NotFoundError("Configuracoes nao encontradas.");
    return data;
  }
}
