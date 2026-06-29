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

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        scope: z.enum(["all", "unread", "mine", "unassigned", "resolved"]).default("all"),
        search: z.string().trim().optional(),
        tag: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("conversations")
      .select(
        "id, subject, status, is_resolved, last_message_at, unread_count, tags, assigned_to, customer:customers(id, full_name, whatsapp_e164)",
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100);

    if (data.scope === "unread") q = q.gt("unread_count", 0);
    if (data.scope === "mine") q = q.eq("assigned_to", userId);
    if (data.scope === "unassigned") q = q.is("assigned_to", null);
    if (data.scope === "resolved") q = q.eq("is_resolved", true);
    else if (data.scope !== "all") q = q.eq("is_resolved", false);
    if (data.tag) q = q.contains("tags", [data.tag]);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let result = rows ?? [];
    if (data.search) {
      const s = data.search.toLowerCase();
      result = result.filter(
        (r: any) =>
          r.subject?.toLowerCase().includes(s) ||
          r.customer?.full_name?.toLowerCase().includes(s) ||
          r.customer?.whatsapp_e164?.includes(s),
      );
    }
    return result;
  });

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: convo, error } = await supabase
      .from("conversations")
      .select("*, customer:customers(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !convo) throw new Error("Conversation not found");

    const { data: messages } = await supabase
      .from("conversation_messages")
      .select("*")
      .eq("conversation_id", data.id)
      .order("sent_at", { ascending: true });

    const { data: interests } = await supabase
      .from("customer_interests")
      .select("id, created_at, product:products(id, name, image_url, price)")
      .eq("customer_id", convo.customer_id)
      .order("created_at", { ascending: false })
      .limit(20);

    return { conversation: convo, messages: messages ?? [], interests: interests ?? [] };
  });

export const sendReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        conversation_id: z.string().uuid(),
        body: z.string().trim().min(1).max(2000),
        is_internal: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: convo } = await supabase
      .from("conversations")
      .select("retailer_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (!convo) throw new Error("Not found");

    const { error } = await supabase.from("conversation_messages").insert({
      conversation_id: data.conversation_id,
      retailer_id: convo.retailer_id,
      direction: "outbound",
      body: data.body,
      is_internal: data.is_internal,
      author_user_id: userId,
      created_by: userId,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    if (!data.is_internal) {
      await supabase
        .from("conversations")
        .update({ unread_count: 0, last_message_at: new Date().toISOString() })
        .eq("id", data.conversation_id);
    }
    return { ok: true };
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        assigned_to: z.string().uuid().nullable().optional(),
        is_resolved: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        mark_read: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: any = {};
    if (data.assigned_to !== undefined) patch.assigned_to = data.assigned_to;
    if (data.is_resolved !== undefined) {
      patch.is_resolved = data.is_resolved;
      patch.status = data.is_resolved ? "resolved" : "open";
    }
    if (data.tags !== undefined) patch.tags = data.tags;
    if (data.mark_read) patch.unread_count = 0;
    const { error } = await supabase.from("conversations").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAssignableStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("staff")
      .select("user_id, full_name, role")
      .eq("retailer_id", retailerId)

      .eq("status", "active");
    return (data ?? []).filter((s: any) => s.user_id);
  });
