import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { isSupabaseConfigured } from "./config";

export async function createAuthServerClient() {
  if (!isSupabaseConfigured()) throw new Error("Supabase Auth is not configured");
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot write cookies; proxy refresh handles that path.
          }
        },
      },
    },
  );
}
