// Builds the wa.me link the QR scan opens. The "Ref" token at the end is what
// the Infobip inbound webhook (whatsapp-scan-optin.server.ts) parses to know
// which product the shopper scanned — keep the two in sync.

export type ChatTarget = { kind: "G" | "T"; value: string };

export function scanChatMessage(productName: string, target: ChatTarget): string {
  return `Hi TAG 👋 Please keep me posted on ${productName}. (Ref ${target.kind}:${target.value})`;
}

export function whatsappChatUrl(numberDigits: string, message: string): string {
  return `https://wa.me/${numberDigits}?text=${encodeURIComponent(message)}`;
}
