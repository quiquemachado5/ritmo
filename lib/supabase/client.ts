import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Cliente de navegador (Client Components). Singleton por pestaña. */
export function createClient() {
  if (typeof window !== 'undefined') {
    console.log('DEBUG Supabase:', {
      url: SUPABASE_URL?.substring(0, 30) + '...',
      keyLength: SUPABASE_ANON_KEY?.length,
    });
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
