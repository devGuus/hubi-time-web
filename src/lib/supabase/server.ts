/**
 * Cliente Supabase para uso em Server Components/Actions/Route Handlers.
 * Le/escreve a sessao via cookies HTTP-only, gerenciados pelo middleware.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll chamado a partir de um Server Component (sem acesso de
            // escrita a cookies) - inofensivo, pois o middleware ja cuida
            // de renovar a sessao em toda requisicao.
          }
        },
      },
    }
  );
}
