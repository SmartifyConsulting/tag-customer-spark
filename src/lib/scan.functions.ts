import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function serverPublicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getPublicScan = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ shortCode: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const supabase = serverPublicClient();
    const { data: row, error } = await supabase
      .from("public_scan_view")
      .select("*")
      .eq("short_code", data.shortCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return row;
  });
