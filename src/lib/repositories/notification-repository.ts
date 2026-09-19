/** Acesso a dados de notifications. */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { translatePostgrestError } from "./errors";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export class NotificationRepository {
  constructor(private client: SupabaseClient<Database>) {}

  async listRecent(userId: string, limit = 30): Promise<Notification[]> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw translatePostgrestError(error, "listar notificacoes");
    return data ?? [];
  }
}
