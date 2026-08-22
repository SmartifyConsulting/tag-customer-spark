import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { activeWhatsAppProvider } = await import("@/lib/whatsapp.server");
    const { resolveAutomationRetailerId } = await import("@/lib/automation.server");
    const provider = activeWhatsAppProvider();

    const retailerId = await resolveAutomationRetailerId(supabase, userId);
    if (!retailerId) return { settings: [], provider, lastFailure: null };

    const { getAutomationSettingsList } = await import("@/lib/automation.server");

    // Surface the most recent delivery failure so a broken sender/API key is
    // visible here instead of showing up as silence on the customer's phone.
    const [settings, { data: lastSent }, { data: lastFailed }] = await Promise.all([
      getAutomationSettingsList(supabase, retailerId),
      supabase
        .from("notification_history")
        .select("created_at")
        .eq("retailer_id", retailerId)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("notification_history")
        .select("created_at, error, payload")
        .eq("retailer_id", retailerId)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Only warn when the failure is the LATEST outcome — an old failure that a
    // later successful send has superseded is noise.
    const stillBroken =
      lastFailed &&
      (!lastSent || new Date(lastFailed.created_at) > new Date(lastSent.created_at));

    return {
      settings,
      provider,
      lastFailure: stillBroken
        ? {
            at: lastFailed.created_at as string,
            error: (lastFailed.error as string) ?? "Unknown error",
            template: ((lastFailed.payload as any)?.template as string) ?? null,
          }
        : null,
    };
  });


export const saveAutomationSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        automation_key: z.enum([
          "scan_confirmation",
          "price_drop",
          "low_stock",
          "last_one",
          "back_in_stock",
          "high_interest",
          "daily_summary",
        ]),
        enabled: z.boolean(),
        threshold: z.number().nullable().optional(),
        template_name: z.string().trim().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { resolveAutomationRetailerId } = await import("@/lib/automation.server");
    const retailerId = await resolveAutomationRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No workspace found");

    const { upsertAutomationSetting } = await import("@/lib/automation.server");
    await upsertAutomationSetting(supabase, retailerId, {
      automation_key: data.automation_key,
      enabled: data.enabled,
      threshold: data.threshold ?? null,
      template_name: data.template_name,
    });
    return { ok: true };
  });

/**
 * Verifies that the live runtime can authenticate against Infobip, without
 * sending anyone a message. This isolates a credential/authentication problem
 * from a template or recipient problem when a reply reports "Invalid login
 * details": it calls a read-only Infobip endpoint with the exact same binding
 * the send path uses, from the same worker runtime.
 */
export const checkInfobipConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("retailer_id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();
    if (!role) throw new Error("Super administrator access required");

    const { checkInfobipAuth } = await import("@/lib/whatsapp-infobip.server");
    return checkInfobipAuth();
  });


export const testInfobipDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        recipient: z.string().trim().min(8).max(40),
        templateName: z.string().trim().min(1).max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("retailer_id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .not("retailer_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (!role?.retailer_id) throw new Error("Super administrator access required");

    const { data: product } = await supabase
      .from("products")
      .select("id, name, price_cents, sale_price_cents, hero_image, image_url, thumbnail_url")
      .eq("retailer_id", role.retailer_id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(25);
    const { isPublicMediaUrl } = await import("@/lib/whatsapp-templates.server");
    const withImage = ((product ?? []) as any[]).find((row) =>
      [row.hero_image, row.image_url, row.thumbnail_url].some((url: string | null) =>
        isPublicMediaUrl(url),
      ),
    );
    const imageUrl = withImage
      ? [withImage.hero_image, withImage.image_url, withImage.thumbnail_url].find(
          (url: string | null) => isPublicMediaUrl(url),
        )
      : null;
    if (!imageUrl) throw new Error("No active product has a public image for the test template");

    const { buildScanTemplateVariables } = await import("@/lib/scan-template.server");
    const { sendTemplate } = await import("@/lib/whatsapp-service.server");
    const result = await sendTemplate({
      templateName: data.templateName ?? "tag_scan_v5",
      to: data.recipient,
      headerImageUrl: imageUrl,
      // Supply every variable name any known template might ask for —
      // scan/alert-style templates want productName/price/etc., the
      // broadcast template wants heading/body. Extra keys a given
      // template doesn't declare are simply ignored by buildTemplatePayload,
      // so this works regardless of which template the dropdown picks.
      variables: {
        ...buildScanTemplateVariables({
          productName: withImage?.name ?? "this product",
          priceCents: withImage?.sale_price_cents ?? withImage?.price_cents ?? null,
          originalPriceCents: withImage?.price_cents ?? null,
        }),
        heading: "Test broadcast",
        body: `This is a test send of "${data.templateName ?? "tag_scan_v5"}" from Tag's Automations page.`,
      },
    });

    return {
      ok: result.ok,
      status: result.status,
      messageId: result.sid ?? null,
      error: result.error ?? null,
      diagnostic: result.diagnostic ?? null,
    };
  });

/**
 * Live list of the WhatsApp templates registered on this sender, so the
 * delivery test always reflects newly approved templates instead of a
 * hardcoded list that goes stale.
 */
export const listWhatsAppTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles")
      .select("retailer_id")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .limit(1)
      .maybeSingle();
    if (!role) throw new Error("Super administrator access required");

    const { listInfobipTemplates } = await import("@/lib/whatsapp-infobip.server");
    const listed = await listInfobipTemplates();
    const rank = (s: string) =>
      s.toUpperCase() === "APPROVED" ? 0 : s.toUpperCase() === "PENDING" ? 1 : 2;
    return {
      ok: listed.ok,
      error: listed.error,
      templates: listed.templates
        .map((t) => ({ name: t.name, status: t.status.toUpperCase(), language: t.language }))
        .sort((a, b) => rank(a.status) - rank(b.status) || a.name.localeCompare(b.name)),
    };
  });
