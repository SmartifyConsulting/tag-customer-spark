// Variables offered to whichever template is configured as the scan
// confirmation. The contract registry picks only the placeholders its
// approved template actually declares, so supplying the full set here means
// switching the configured template never leaves a placeholder unfilled.

import { formatMoney } from "@/lib/format";

export function buildScanTemplateVariables(input: {
  productName: string;
  priceCents: number | null | undefined;
  originalPriceCents?: number | null | undefined;
  currency?: string;
}): Record<string, string> {
  const currency = input.currency ?? "ZAR";
  const price = input.priceCents ?? input.originalPriceCents ?? null;
  const original = input.originalPriceCents ?? input.priceCents ?? null;

  const vars: Record<string, string> = { productName: input.productName };
  if (price != null) {
    vars.price = formatMoney(price, currency);
    vars.newPrice = formatMoney(price, currency);
  }
  if (original != null) {
    vars.oldPrice = formatMoney(original, currency);
  }
  return vars;
}
