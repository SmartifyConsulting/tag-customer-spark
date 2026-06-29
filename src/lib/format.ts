export function formatMoney(cents: number | null | undefined, currency = "ZAR") {
  const v = ((cents ?? 0) / 100);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export function deviceLabel(d: string | null | undefined) {
  if (!d) return "Unknown";
  return d.charAt(0).toUpperCase() + d.slice(1);
}
