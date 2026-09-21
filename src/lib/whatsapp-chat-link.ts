// Builds the wa.me link the QR scan opens. The "TAG ref" line at the end is
// what the Infobip inbound webhook (whatsapp-scan-optin.server.ts) parses to
// know which product the shopper scanned — keep the two in sync.

export type ChatTarget = { kind: "G" | "T"; value: string };

export function scanChatMessage(
  productName: string,
  target: ChatTarget,
  retailerName?: string | null,
): string {
  const where = retailerName ? ` at ${retailerName}` : "";
  return [
    "Hi TAG 👋",
    `I'd like WhatsApp updates on the *${productName}*${where} — price drops, low stock and restocks.`,
    "",
    `🏷️ TAG ref: ${target.kind}-${target.value}`,
  ].join("\n");
}

export function whatsappChatUrl(numberDigits: string, message: string): string {
  return `https://wa.me/${numberDigits}?text=${encodeURIComponent(message)}`;
}
