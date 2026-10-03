/**
 * Cliente Supabase com a service role key - ignora RLS. Uso exclusivo de
 * rotas de servidor sem sessao de usuario (o webhook do Mercado Pago), nunca
 * do navegador.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY nao configurada. Copie a 'service_role key' em Supabase > Settings > API e adicione ao .env.local."
    );
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
