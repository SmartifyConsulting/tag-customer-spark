export function formatMoney(
  cents: number | null | undefined,
  currency = "ZAR",
  opts: { maximumFractionDigits?: number } = {},
) {
  const v = ((cents ?? 0) / 100);
  const maximumFractionDigits = opts.maximumFractionDigits ?? 2;
  try {
    return new Intl.NumberFormat(undefined, {
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
