// Shared country → currency mapping for signup and retailer-level currency
// formatting. Keep in sync with `formatMoney`'s locale table in format.ts.
export type CountryOption = { code: string; name: string; currency: string };

export const SIGNUP_COUNTRIES: CountryOption[] = [
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "NA", name: "Namibia", currency: "NAD" },
  { code: "BW", name: "Botswana", currency: "BWP" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "CA", name: "Canada", currency: "CAD" },
];

export function currencyForCountry(code: string): string {
  return SIGNUP_COUNTRIES.find((c) => c.code === code)?.currency ?? "ZAR";
}
