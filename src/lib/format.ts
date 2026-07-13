// A currency-appropriate locale so e.g. ZAR renders as "R 100" (its native
// symbol) rather than falling back to the visitor's own browser locale,
// which would spell it out as "ZAR 100" for anyone outside South Africa.
const CURRENCY_LOCALE: Record<string, string> = {
  ZAR: "en-ZA",
  GBP: "en-GB",
  USD: "en-US",
  AUD: "en-AU",
  KES: "en-KE",
  NGN: "en-NG",
  EUR: "en-IE",
  NAD: "en-NA",
  BWP: "en-BW",
  CAD: "en-CA",
};

export function formatMoney(
  cents: number | null | undefined,
  currency = "ZAR",
  opts: { maximumFractionDigits?: number } = {},
) {
  const v = ((cents ?? 0) / 100);
  const maximumFractionDigits = opts.maximumFractionDigits ?? 2;
  const locale = CURRENCY_LOCALE[currency.toUpperCase()];
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(maximumFractionDigits)}`;
  }
}

export function deviceLabel(d: string | null | undefined) {
  if (!d) return "Unknown";
  return d.charAt(0).toUpperCase() + d.slice(1);
}
