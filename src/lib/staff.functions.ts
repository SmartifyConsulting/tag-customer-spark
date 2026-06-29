import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

export const listStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { staff: [], stores: [] };

    const [staff, stores] = await Promise.all([
      supabase
        .from("staff")
        .select("id, full_name, invite_email, role, status, created_at, store:stores(id, name)")
        .eq("retailer_id", retailerId)
        .order("created_at", { ascending: false }),
      supabase.from("stores").select("id, name").eq("retailer_id", retailerId).order("name"),
    ]);

    return { staff: staff.data ?? [], stores: stores.data ?? [] };
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        full_name: z.string().trim().min(1).max(120),
        role: z.enum(["retail_admin", "store_manager", "sales_assistant"]),
        store_id: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");

    // Only admins/managers can invite — verify
    const { data: canManage } = await supabase.rpc("can_manage_retailer", {
      _user_id: userId,
      _retailer_id: retailerId,
    });
    if (!canManage) throw new Error("Forbidden");

    const { error } = await supabase.from("staff").insert({
      retailer_id: retailerId,
      invite_email: data.email,
      full_name: data.full_name,
      role: data.role,
      store_id: data.store_id ?? null,
      status: "invited",
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStaffStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "invited", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("staff").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
