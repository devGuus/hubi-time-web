/**
 * Cliente Supabase para uso no navegador (Client Components).
 * Usa apenas a URL e a chave anon/publishable - nunca a service_role key.
 */
import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
