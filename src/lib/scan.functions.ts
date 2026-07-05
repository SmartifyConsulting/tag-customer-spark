import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicScan = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ shortCode: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("public_scan_view")
      .select("*")
      .eq("short_code", data.shortCode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return row;
  });
