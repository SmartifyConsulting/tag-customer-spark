// Shared public GTIN → product resolution.
//
// Scanners always hand us a padded 14-digit GTIN, but rows in `products`
// store whatever the source supplied (12 / 13 / 14 digits), and some early
// products were captured with the real barcode typed into `sku`. Every
// public entry point (passport page, WhatsApp opt-in endpoint) must match
// identically, otherwise a page can load while its opt-in returns
// "Product not found".

export function validGtin14(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const g = digits.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = Number(g[i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(g[13])) return null;
  return g;
}

export function gtinCandidates(gtin14: string): string[] {
  return Array.from(
    new Set([gtin14, gtin14.replace(/^0+/, "") || gtin14, gtin14.slice(1), gtin14.slice(2)]),
  );
}

export async function findActiveProductByGtin(
  supabaseAdmin: any,
  gtin14: string,
  select: string,
): Promise<any | null> {
  const candidates = gtinCandidates(gtin14);

  const { data: byGtin } = await supabaseAdmin
    .from("products")
    .select(select)
    .in("gtin", candidates)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  if (byGtin?.[0]) return byGtin[0];

  const { data: bySku } = await supabaseAdmin
    .from("products")
    .select(select)
    .in("sku", candidates)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1);
  return bySku?.[0] ?? null;
}
