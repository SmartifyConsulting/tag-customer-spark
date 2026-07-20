// Server-only image resolver for TAG products.
// Priority: retailer_upload > retailer_import_url > official (OpenFoodFacts)
//   > ai_suggested (Lovable AI) > brand_logo > placeholder (SVG).
// The pipeline downloads and re-uploads to the `product-images` public bucket
// so consumers are never served flaky third-party URLs.

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 6000;

// Open Food Facts is queried across up to 7 GTIN variants (plus Serper on
// top) with no timeout — for barcodes that were never going to be there
// (e.g. an appliance, or a synthetic/demo GTIN), a single slow or hung
// upstream response stalled the entire resolver indefinitely with nothing
// to catch, leaving image_status stuck on "pending" forever. This bounds
// every external call so the pipeline always converges, worst case on the
// guaranteed-fast local placeholder.
async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type ResolveInput = {
  productId: string;
  retailerId: string;
  gtin: string | null;
  name: string;
  brand: string | null;
  categoryName: string | null;
  currentImageUrl: string | null;
  currentImageStatus: string | null;
  openFoodFactsImageUrl?: string | null;
  brandLogoUrl?: string | null;
  planTier?: string | null;
};

type ResolveOutput = {
  image_url: string;
  thumbnail_url: string;
  hero_image: string;
  image_status: "retailer" | "official" | "ai_suggested" | "brand_logo" | "placeholder";
  image_source: string;
  image_gallery: Array<{
    url: string;
    role: string;
    kind: string;
    source: string;
    license: string;
  }>;
};

function bucketPath(retailerId: string, gtin: string | null, productId: string, file: string) {
  const key = gtin && gtin.length > 0 ? gtin : productId;
  return `products/${retailerId}/${key}/${file}`;
}

function publicUrl(path: string): string {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/product-images/${path}`;
}

async function downloadAndUpload(
  supabaseAdmin: any,
  url: string,
  destPath: string,
): Promise<{ ok: true; contentType: string; url: string } | { ok: false; reason: string }> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { "User-Agent": "TAG-Product-Image/1.0" },
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(ct)) return { ok: false, reason: `Unsupported type ${ct}` };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) return { ok: false, reason: "Empty file" };
    if (buf.byteLength > MAX_BYTES) return { ok: false, reason: "File too large" };
    const up = await supabaseAdmin.storage
      .from("product-images")
      .upload(destPath, buf, { contentType: ct, upsert: true });
    if (up.error) return { ok: false, reason: up.error.message };
    return { ok: true, contentType: ct, url: publicUrl(destPath) };
  } catch (e: any) {
    return { ok: false, reason: e?.message ?? "download failed" };
  }
}

function extForContentType(ct: string): string {
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  return "jpg";
}

// ----- Placeholder generator (deterministic SVG) -------------------------

const BRAND_PALETTE = [
  ["#0A1F5C", "#4C7EFF"],
  ["#0E7C66", "#3ED1B3"],
  ["#B15E00", "#FFB040"],
  ["#8E1E5C", "#FF8AC7"],
  ["#1D4E2B", "#79D67F"],
  ["#3B2A6B", "#A38CFF"],
  ["#7A2D2D", "#FF8080"],
  ["#004466", "#4FC3E0"],
];

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialsFor(name: string, brand: string | null): string {
  const source = (brand || name || "TAG").trim();
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
  return letters || "T";
}

function xmlEscape(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function generatePlaceholderSvg(input: {
  name: string;
  brand: string | null;
  categoryName: string | null;
}): string {
  const seedKey = `${input.brand ?? ""}|${input.name}`;
  const palette = BRAND_PALETTE[hashString(seedKey) % BRAND_PALETTE.length];
  const [bg, accent] = palette;
  const initials = initialsFor(input.name, input.brand);
  const nameLine = xmlEscape(input.name.slice(0, 44));
  const brandLine = xmlEscape((input.brand ?? input.categoryName ?? "TAG Product").slice(0, 32));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#g)"/>
  <circle cx="600" cy="520" r="260" fill="rgba(255,255,255,0.14)"/>
  <text x="600" y="600" text-anchor="middle" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif"
        font-size="260" font-weight="800" fill="#ffffff" letter-spacing="4">${xmlEscape(initials)}</text>
  <text x="600" y="900" text-anchor="middle" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif"
        font-size="52" font-weight="700" fill="#ffffff">${nameLine}</text>
  <text x="600" y="980" text-anchor="middle" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif"
        font-size="34" font-weight="500" fill="rgba(255,255,255,0.82)">${brandLine}</text>
  <text x="600" y="1130" text-anchor="middle" font-family="ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif"
        font-size="28" font-weight="600" fill="rgba(255,255,255,0.7)" letter-spacing="6">TAG</text>
</svg>`;
}

async function uploadPlaceholder(
  supabaseAdmin: any,
  path: string,
  svg: string,
): Promise<string | null> {
  try {
    const up = await supabaseAdmin.storage
      .from("product-images")
      .upload(path, new Blob([svg], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml",
        upsert: true,
      });
    if (up.error) return null;
    return publicUrl(path);
  } catch {
    return null;
  }
}

// ----- Main resolver -----------------------------------------------------

export async function resolveProductImage(input: ResolveInput): Promise<ResolveOutput> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Retailer-supplied URL (already on the row and not sourced by us before).
  // Excludes every status *we* assign as a fallback (official/ai_suggested/
  // placeholder/brand_logo) so a refresh can always try to upgrade to a real
  // photo — otherwise a product stuck on a fallback status short-circuits
  // here forever and never reaches Open Food Facts / Serper / AI again. The
  // brand-logo.png filename check also self-heals older rows that were
  // mislabeled "retailer" by this same bug before the fix.
  const isBrandLogoFile = input.currentImageUrl?.includes("/brand-logo.png") ?? false;
  if (
    input.currentImageUrl &&
    !isBrandLogoFile &&
    input.currentImageStatus !== "official" &&
    input.currentImageStatus !== "ai_suggested" &&
    input.currentImageStatus !== "placeholder" &&
    input.currentImageStatus !== "brand_logo"
  ) {
    // If it's already a supabase public URL for our bucket, keep as-is.
    const alreadyOurs = input.currentImageUrl.includes("/storage/v1/object/public/product-images/");
    if (alreadyOurs) {
      return finalize({
        primary: input.currentImageUrl,
        status: "retailer",
        source: "retailer_upload",
      });
    }
    const ext = extForContentType("image/jpeg");
    const dest = bucketPath(input.retailerId, input.gtin, input.productId, `original.${ext}`);
    const r = await downloadAndUpload(supabaseAdmin, input.currentImageUrl, dest);
    if (r.ok) {
      return finalize({ primary: r.url, status: "retailer", source: "retailer_import_url" });
    }
    // fall through
  }

  // 2) Official image (Open Food Facts, if we already know one)
  if (input.openFoodFactsImageUrl) {
    const dest = bucketPath(input.retailerId, input.gtin, input.productId, `original.jpg`);
    const r = await downloadAndUpload(supabaseAdmin, input.openFoodFactsImageUrl, dest);
    if (r.ok) {
      return finalize({ primary: r.url, status: "official", source: "openfoodfacts" });
    }
  }

  // 2b) Serper Google Images lookup — real product photos from the web,
  // then a Vision verification pass to pick the candidate that actually
  // depicts this product (Serper's first result is often the wrong pack
  // size, a category thumbnail, or a watermarked listing).
  {
    const candidates = await lookupSerperImageCandidates({
      gtin: input.gtin,
      name: input.name,
      brand: input.brand,
    });
    const chosen = await pickBestCandidateWithVision(candidates, {
      name: input.name,
      brand: input.brand,
      gtin: input.gtin,
      categoryName: input.categoryName,
    });
    if (chosen) {
      const dest = bucketPath(input.retailerId, input.gtin, input.productId, `original.jpg`);
      const r = await downloadAndUpload(supabaseAdmin, chosen, dest);
      if (r.ok) {
        return finalize({ primary: r.url, status: "official", source: "serper" });
      }
    }
  }


  // 3) AI suggested — gated to Growth+ plan, and only for products with no
  // GTIN. A barcode means real, manufacturer-designed packaging exists —
  // an AI image (deliberately generated without text/logo, since we can't
  // ask it to draw a specific real label) would misrepresent it. For those
  // products we'd rather show the honest placeholder than a wrong photo.
  const canAI =
    !input.gtin &&
    !!process.env.LOVABLE_API_KEY &&
    ["growth", "pro", "enterprise"].includes((input.planTier ?? "").toLowerCase());
  if (canAI) {
    const ai = await generateAiImage(input);
    if (ai) {
      const dest = bucketPath(input.retailerId, input.gtin, input.productId, `original.png`);
      const up = await supabaseAdmin.storage
        .from("product-images")
        .upload(dest, ai, { contentType: "image/png", upsert: true });
      if (!up.error) {
        return finalize({ primary: publicUrl(dest), status: "ai_suggested", source: "ai_gateway" });
      }
    }
  }

  // 4) Brand logo — when no product-specific photo could be found or
  // generated (very common for barcoded products, since step 3 is
  // deliberately skipped for those), a real, recognisable brand mark is a
  // much more honest fallback than the generic initials placeholder.
  if (input.brandLogoUrl) {
    const dest = bucketPath(input.retailerId, input.gtin, input.productId, "brand-logo.png");
    const r = await downloadAndUpload(supabaseAdmin, input.brandLogoUrl, dest);
    if (r.ok) {
      return finalize({ primary: r.url, status: "brand_logo", source: "brand_logo" });
    }
  }

  // 5) Placeholder
  const svg = generatePlaceholderSvg({
    name: input.name,
    brand: input.brand,
    categoryName: input.categoryName,
  });
  const placeholderPath = bucketPath(
    input.retailerId,
    input.gtin,
    input.productId,
    "placeholder.svg",
  );
  const placeholderUrl = await uploadPlaceholder(supabaseAdmin, placeholderPath, svg);
  return finalize({
    primary: placeholderUrl ?? "",
    status: "placeholder",
    source: "placeholder",
  });
}

function finalize(args: {
  primary: string;
  status: ResolveOutput["image_status"];
  source: string;
}): ResolveOutput {
  return {
    image_url: args.primary,
    thumbnail_url: args.primary,
    hero_image: args.primary,
    image_status: args.status,
    image_source: args.source,
    image_gallery: args.primary
      ? [
          {
            url: args.primary,
            role: "primary",
            kind: "image",
            source: args.source,
            license: args.status === "ai_suggested" ? "ai-generated" : "unspecified",
          },
        ]
      : [],
  };
}

async function generateAiImage(input: ResolveInput): Promise<Uint8Array | null> {
  try {
    const prompt = [
      "Professional studio product photograph on a clean neutral background.",
      "Sharp focus, soft even lighting, minimal shadow, e-commerce style.",
      `Product: ${input.name}.`,
      input.brand ? `Brand: ${input.brand}.` : "",
      input.categoryName ? `Category: ${input.categoryName}.` : "",
      "No text, no logo, no watermark, no people.",
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return null;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

// ----- Serper (Google Images) lookup --------------------------------------
// Uses https://serper.dev to find real product photos on the web. Requires
// SERPER_API_KEY. Returns null silently on missing key, HTTP failure, or
// when no result looks like a usable https image URL — the pipeline then
// falls through to AI / brand logo / placeholder.

// Minimum pixel dimensions before a result is treated as "good enough" —
// below this, thumbnails/icons routinely outrank the actual product photo
// and previously got picked simply for being first in the results.
const MIN_QUALITY_PX = 500;

async function serperImageSearch(apiKey: string, query: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout("https://google.serper.dev/images", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      // imgSize biases Google toward higher-resolution results up front;
      // num:20 gives the width/height ranking below more to choose from.
      body: JSON.stringify({ q: query, num: 20, safe: "active", imgSize: "large" }),
    });
    if (!res.ok) {
      console.warn(`[serper] HTTP ${res.status} for query "${query}"`);
      return null;
    }
    const json: any = await res.json();
    const items: any[] = Array.isArray(json?.images) ? json.images : [];
    const isImageUrl = (u: string) =>
      u.startsWith("https://") && /\.(jpe?g|png|webp)(\?|$)/i.test(u);

    const candidates = items
      .map((item) => ({
        link: typeof item?.imageUrl === "string" ? item.imageUrl : null,
        width: Number(item?.imageWidth) || 0,
        height: Number(item?.imageHeight) || 0,
      }))
      .filter((c) => c.link && c.link.startsWith("https://"));

    // Prefer the largest real image (by pixel area) that clears the quality
    // floor, so a small icon/thumbnail Google ranked first doesn't win just
    // because it appeared first — genuine product photos are usually the
    // biggest images returned, not the earliest.
    const goodQuality = candidates
      .filter((c) => c.link && isImageUrl(c.link) && c.width >= MIN_QUALITY_PX && c.height >= MIN_QUALITY_PX)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    if (goodQuality[0]?.link) return goodQuality[0].link;

    // Nothing cleared the quality floor — fall back to the largest
    // recognised-extension image regardless of size.
    const anySizedImage = candidates
      .filter((c) => c.link && isImageUrl(c.link))
      .sort((a, b) => b.width * b.height - a.width * a.height);
    if (anySizedImage[0]?.link) return anySizedImage[0].link;

    // Last resort: any https URL at all — downloadAndUpload validates MIME.
    return candidates[0]?.link ?? null;
  } catch (e: any) {
    console.warn("[serper] fetch failed", e?.message ?? e);
    return null;
  }
}

async function lookupSerperImage(input: {
  gtin: string | null;
  name: string;
  brand: string | null;
}): Promise<string | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const nameQuery = [input.brand, input.name].filter(Boolean).join(" ").trim();
  const cleanGtin = input.gtin?.replace(/\D/g, "") ?? "";

  // A barcode is only useful to search if a real manufacturer actually
  // registered it online — many demo/import GTINs are synthetic and will
  // never match, so always fall back to a brand+name search rather than
  // giving up (this previously left barcoded products stuck on placeholder
  // forever, even across repeated backfill attempts).
  if (cleanGtin) {
    const byGtin = await serperImageSearch(apiKey, `"${cleanGtin}"`);
    if (byGtin) return byGtin;
  }
  if (nameQuery.length >= 3) {
    return serperImageSearch(apiKey, nameQuery);
  }
  return null;
}

// ----- Open Food Facts lookup with GTIN normalisations + search fallback --

async function offFetch(url: string): Promise<any | null> {
  try {
    const r = await fetchWithTimeout(url, { headers: { "User-Agent": "TAG-DPP/1.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function pickOffImage(prod: any): string | null {
  return (
    prod?.image_front_url ??
    prod?.image_url ??
    prod?.selected_images?.front?.display?.en ??
    prod?.selected_images?.front?.display?.[
      Object.keys(prod?.selected_images?.front?.display ?? {})[0]
    ] ??
    null
  );
}

async function lookupOpenFoodFactsImage(
  gtin: string,
  name: string,
  brand: string | null,
): Promise<string | null> {
  const clean = gtin.replace(/\D/g, "");
  const variants = new Set<string>();
  if (clean) variants.add(clean);
  // Strip leading zeros
  const stripped = clean.replace(/^0+/, "");
  if (stripped) variants.add(stripped);
  // EAN-13 from GTIN-14 (drop leading digit)
  if (clean.length === 14) variants.add(clean.slice(1));
  // UPC-A (12) — either strip leading 0 from EAN-13 or take last 12
  if (clean.length === 13 && clean.startsWith("0")) variants.add(clean.slice(1));
  if (clean.length >= 12) variants.add(clean.slice(-12));
  // Zero-pad shorter codes to 13
  if (clean.length > 0 && clean.length < 13) variants.add(clean.padStart(13, "0"));

  for (const v of variants) {
    const j = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${v}.json`);
    if (j?.status === 1 && j.product) {
      const url = pickOffImage(j.product);
      if (url) return url;
    }
  }

  // Search fallback by brand + name
  const query = [brand, name].filter(Boolean).join(" ").trim();
  if (query.length >= 3) {
    const j = await offFetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&json=1&page_size=5`,
    );
    const products: any[] = j?.products ?? [];
    for (const p of products) {
      const url = pickOffImage(p);
      if (url) return url;
    }
  }

  return null;
}

// Helper for callers that need to sync the resolved image into products +
// passport in one shot.
export async function resolveAndSyncProductImage(input: {
  supabase: any;
  productId: string;
}): Promise<ResolveOutput | null> {
  const { supabase, productId } = input;
  const { data: product, error: productErr } = await supabase
    .from("products")
    .select(
      "id, retailer_id, gtin, name, brand, image_url, image_status, category:product_categories!products_category_id_fkey(name), brands:brand_id(id, name, website, logo_url)",
    )
    .eq("id", productId)
    .maybeSingle();
  // A silent `return null` here previously let the caller report success
  // (resetProductImage never checked the return value) while nothing ran
  // and image_status stayed "pending" forever with zero visible error.
  if (productErr) {
    throw new Error(`Could not load product for image resolution: ${productErr.message}`);
  }
  if (!product) {
    throw new Error("Product not found or not visible to this session (check RLS/permissions)");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan")
    .eq("retailer_id", product.retailer_id)
    .maybeSingle();

  // Try Open Food Facts across several GTIN normalisations, then fall back
  // to a brand+name search. AI/placeholder only kick in if nothing matches.
  let offUrl: string | null = null;
  if (product.gtin) {
    offUrl = await lookupOpenFoodFactsImage(product.gtin, product.name, product.brand);
  }

  // Resolve (and cache) the linked brand's logo as a fallback for when no
  // product-specific photo is available — a no-op if it's already set.
  let brandLogoUrl: string | null = null;
  const linkedBrand = (product as any).brands;
  if (linkedBrand) {
    const { ensureBrandLogo } = await import("./brands.functions");
    brandLogoUrl = await ensureBrandLogo(supabase, linkedBrand);
  }

  const result = await resolveProductImage({
    productId: product.id,
    retailerId: product.retailer_id,
    gtin: product.gtin,
    name: product.name,
    brand: product.brand,
    categoryName: (product.category as any)?.name ?? null,
    currentImageUrl: product.image_url,
    currentImageStatus: product.image_status,
    openFoodFactsImageUrl: offUrl,
    brandLogoUrl,
    planTier: (sub as any)?.plan ?? null,
  });

  // Write to products — checked, unlike before: an unchecked failure here
  // (e.g. an RLS policy rejecting the write) left the caller believing
  // the refresh succeeded while image_status silently stayed "pending"
  // forever, with no error surfaced anywhere.
  const { error: productUpdateErr } = await supabase
    .from("products")
    .update({
      image_url: result.image_url,
      thumbnail_url: result.thumbnail_url,
      hero_image: result.hero_image,
      image_status: result.image_status,
      image_source: result.image_source,
      image_updated_at: new Date().toISOString(),
      image_gallery: result.image_gallery,
    })
    .eq("id", productId);
  if (productUpdateErr) {
    throw new Error(`Resolved image but failed to save it: ${productUpdateErr.message}`);
  }

  // Mirror to passport
  await supabaseAdmin
    .from("product_passports")
    .update({
      hero_image: result.hero_image,
      thumbnail: result.thumbnail_url,
      image_gallery: result.image_gallery,
    })
    .eq("product_id", productId);

  return result;
}
