// Server-only image resolver for TAG products.
// Priority: retailer_upload > retailer_import_url > official (OpenFoodFacts)
//   > ai_suggested (Lovable AI) > placeholder (SVG).
// The pipeline downloads and re-uploads to the `product-images` public bucket
// so consumers are never served flaky third-party URLs.

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

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
  planTier?: string | null;
};

type ResolveOutput = {
  image_url: string;
  thumbnail_url: string;
  hero_image: string;
  image_status: "retailer" | "official" | "ai_suggested" | "placeholder";
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
    const res = await fetch(url, {
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
  ["#0A1F5C", "#4C7EFF"], ["#0E7C66", "#3ED1B3"], ["#B15E00", "#FFB040"],
  ["#8E1E5C", "#FF8AC7"], ["#1D4E2B", "#79D67F"], ["#3B2A6B", "#A38CFF"],
  ["#7A2D2D", "#FF8080"], ["#004466", "#4FC3E0"],
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
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
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

export async function resolveProductImage(
  input: ResolveInput,
): Promise<ResolveOutput> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Retailer-supplied URL (already on the row and not sourced by us before)
  if (
    input.currentImageUrl &&
    input.currentImageStatus !== "official" &&
    input.currentImageStatus !== "ai_suggested" &&
    input.currentImageStatus !== "placeholder"
  ) {
    // If it's already a supabase public URL for our bucket, keep as-is.
    const alreadyOurs =
      input.currentImageUrl.includes("/storage/v1/object/public/product-images/");
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

  // 3) AI suggested — gated to Growth+ plan. Best-effort; falls to placeholder.
  const canAI =
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

  // 4) Placeholder
  const svg = generatePlaceholderSvg({
    name: input.name,
    brand: input.brand,
    categoryName: input.categoryName,
  });
  const placeholderPath = bucketPath(input.retailerId, input.gtin, input.productId, "placeholder.svg");
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

// Helper for callers that need to sync the resolved image into products +
// passport in one shot.
export async function resolveAndSyncProductImage(input: {
  supabase: any;
  productId: string;
}): Promise<ResolveOutput | null> {
  const { supabase, productId } = input;
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, retailer_id, gtin, name, brand, image_url, image_status, category:product_categories!products_category_id_fkey(name)",
    )
    .eq("id", productId)
    .maybeSingle();
  if (!product) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("plan")
    .eq("retailer_id", product.retailer_id)
    .maybeSingle();

  // Cheap best-effort Open Food Facts lookup (no AI here — that's in enrichment)
  let offUrl: string | null = null;
  if (product.gtin) {
    try {
      const digits = product.gtin.replace(/^0+/, "") || product.gtin;
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${digits}.json`, {
        headers: { "User-Agent": "TAG-DPP/1.0" },
      });
      if (r.ok) {
        const j: any = await r.json();
        if (j?.status === 1 && j.product) {
          offUrl = j.product.image_url ?? j.product.image_front_url ?? null;
        }
      }
    } catch {
      /* ignore */
    }
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
    planTier: (sub as any)?.plan ?? null,
  });

  // Write to products
  await supabase
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
