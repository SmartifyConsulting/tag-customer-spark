// Delivery status for WhatsApp sends.
//
// Normally a delivery report arrives from Infobip at the webhook and promotes a
// row in notification_history from "queued" to sent / delivered / read / failed.
// When those reports don't arrive, syncQueuedDeliveryStatuses asks Infobip
// directly for each still-queued send and applies the same mapping.

/** Infobip delivery-report group/status → notification_history.status */
export function mapDeliveryStatus(groupName?: string | null, name?: string | null): string {
  const g = (groupName ?? "").toUpperCase();
  const n = (name ?? "").toUpperCase();
  if (n.includes("READ") || g === "READ" || g === "SEEN") return "read";
  // Failures are checked before "delivered": names like UNDELIVERABLE_NOT_DELIVERED
  // contain the word DELIVERED but mean the opposite.
  if (
    g === "REJECTED" ||
    g === "UNDELIVERABLE" ||
    g === "EXPIRED" ||
    g === "FAILED" ||
    /^(REJECTED|UNDELIVERABLE|EXPIRED|FAILED)/.test(n)
  )
    return "failed";
  if (g === "DELIVERED" || n.startsWith("DELIVERED")) return "delivered";
  if (g === "PENDING" || n.startsWith("PENDING")) return "queued";
  if (g === "SENT") return "sent";
  return "sent";
}

export type DeliverySyncResult = {
  /** Sends we asked Infobip about. */
  checked: number;
  /** Rows moved out of "queued". */
  updated: number;
  delivered: number;
  failed: number;
  /** Infobip has no record (usually older than its log retention). */
  notFound: number;
  /** Infobip knows the message but it is still pending. */
  stillPending: number;
};

const MIN_AGE_MS = 60_000;

export async function syncQueuedDeliveryStatuses(
  supabaseAdmin: any,
  retailerId: string,
  opts: { limit?: number } = {},
): Promise<DeliverySyncResult> {
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 50);
  const result: DeliverySyncResult = {
    checked: 0,
    updated: 0,
    delivered: 0,
    failed: 0,
    notFound: 0,
    stillPending: 0,
  };

  const cutoff = new Date(Date.now() - MIN_AGE_MS).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("notification_history")
    .select("id, provider_message_sid")
    .eq("retailer_id", retailerId)
    .eq("status", "queued")
    .not("provider_message_sid", "is", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  if (!rows?.length) return result;

  const { lookupInfobipMessageStatus } = await import("@/lib/whatsapp-infobip.server");

  // Small batches so a long list doesn't hammer Infobip.
  const BATCH = 5;
  for (let i = 0; i < rows.length; i += BATCH) {
    await Promise.all(
      rows.slice(i, i + BATCH).map(async (row: { id: string; provider_message_sid: string }) => {
        result.checked++;
        let report: any;
        try {
          report = await lookupInfobipMessageStatus(row.provider_message_sid);
        } catch {
          result.notFound++;
          return;
        }
        const found = (report?.result ?? null) as any;
        if (!report?.ok || !found?.status) {
          result.notFound++;
          return;
        }

        const mapped = mapDeliveryStatus(found.status.groupName, found.status.name);
        if (mapped === "queued") {
          result.stillPending++;
          return;
        }

        const doneAt: string = found.doneAt ?? found.sentAt ?? new Date().toISOString();
        const patch: Record<string, unknown> = { status: mapped };
        if (mapped === "delivered") patch["delivered_at"] = doneAt;
        else if (mapped === "read") {
          patch["read_at"] = doneAt;
          patch["delivered_at"] = doneAt;
        } else if (mapped === "sent") patch["sent_at"] = found.sentAt ?? doneAt;
        else if (mapped === "failed") {
          const err = found.error ?? {};
          patch["error"] =
            [err.groupName, err.name, err.description].filter(Boolean).join(" | ") ||
            `${found.status.groupName ?? ""} ${found.status.name ?? ""}`.trim() ||
            "Delivery failed";
        }

        const { error: upErr } = await supabaseAdmin.from("notification_history").update(patch).eq("id", row.id);
        if (upErr) return;
        result.updated++;
        if (mapped === "failed") result.failed++;
        else if (mapped === "delivered" || mapped === "read") result.delivered++;
      }),
    );
  }
  return result;
}
