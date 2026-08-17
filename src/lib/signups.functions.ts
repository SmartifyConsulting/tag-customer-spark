import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SignupRow = {
  id: string;
  email: string | null;
  name: string;
  type: "retailer" | "shopper";
  retailerName: string | null;
  tagId: string | null;
  role: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

// Everyone who has actually registered an account (auth users), classified by
// whether they hold a retailer-linked role. Staff *invites* live in the
// `staff` table and are listed separately — this is the real signup ledger.
export const listSignups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: SignupRow[] }> => {
    const { supabase, userId } = context as any;

    // Caller must be an admin of some kind.
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role, retailer_id")
      .eq("user_id", userId);
    const callerRoles = (roleRows ?? []).map((r: any) => r.role as string);
    const isAdmin = callerRoles.some((r: string) => r === "super_admin" || r === "retail_admin");
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      users.push(...(data?.users ?? []));
      if ((data?.users ?? []).length < 200) break;
    }
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return { rows: [] };

    const [{ data: profiles }, { data: roles }, { data: tags }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role, retailer_id").in("user_id", ids),
      supabaseAdmin.from("consumer_tag_ids").select("user_id, tag_id").in("user_id", ids),
    ]);

    const retailerIds = Array.from(
      new Set((roles ?? []).map((r: any) => r.retailer_id).filter(Boolean)),
    );
    let retailerNames = new Map<string, string>();
    if (retailerIds.length > 0) {
      const { data: retailers } = await supabaseAdmin
        .from("retailers")
        .select("id, name")
        .in("id", retailerIds);
      retailerNames = new Map((retailers ?? []).map((r: any) => [r.id as string, r.name as string]));
    }

    const profileName = new Map((profiles ?? []).map((p: any) => [p.id as string, p.full_name as string | null]));
    const tagById = new Map((tags ?? []).map((t: any) => [t.user_id as string, t.tag_id as string]));
    const rolesByUser = new Map<string, { role: string; retailer_id: string | null }[]>();
    for (const r of roles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push({ role: r.role, retailer_id: r.retailer_id });
      rolesByUser.set(r.user_id, list);
    }

    const rows: SignupRow[] = users.map((u) => {
      const userRoles = rolesByUser.get(u.id) ?? [];
      const retailerRole = userRoles.find((r) => r.retailer_id);
      const retailerName = retailerRole?.retailer_id
        ? (retailerNames.get(retailerRole.retailer_id) ?? null)
        : null;
      const meta = (u.user_metadata ?? {}) as Record<string, any>;
      const email = (u.email as string | null) ?? null;
      const name =
        profileName.get(u.id) ||
        meta.full_name ||
        meta.name ||
        retailerName ||
        (email ? email.split("@")[0] : "Unknown");
      return {
        id: u.id,
        email,
        name,
        type: retailerRole ? "retailer" : "shopper",
        retailerName,
        tagId: tagById.get(u.id) ?? null,
        role: userRoles[0]?.role ?? null,
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    });

    rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return { rows };
  });
