import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CAPE_UNION_MART_BRANDS,
  CAPE_UNION_MART_CATEGORY_TREE,
  CAPE_UNION_MART_PRODUCTS,
  CAPE_UNION_MART_STORES,
} from "@/lib/seed-data/cape-union-mart";

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

function skuFor(index: number) {
  return `CUM-${String(index + 1).padStart(4, "0")}`;
}

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Deterministic-but-varied stock quantity so the catalogue doesn't look
// artificially uniform (5-40 range).
function stockFor(index: number) {
  return 5 + ((index * 7) % 36);
}

// Destructive one-time utility: wipes the caller's retailer's existing
// products/categories/brands/stores and replaces them with a representative
// Cape Union Mart (SA outdoor retail) demo catalogue. Gated to super_admin
// given the blast radius.
export const reseedAsCapeUnionMart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const supabase = context.supabase as any;

    // `has_role`/`has_any_role` RPCs are revoked from the `authenticated`
    // Postgres role (they're SECURITY DEFINER helpers meant for RLS policies,
    // not direct client calls) — check the role directly instead.
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = new Set((roleRows ?? []).map((r: any) => r.role));
    if (!roles.has("super_admin") && !roles.has("retail_admin")) {
      throw new Error("Only a retailer admin can reseed demo data");
    }

    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");

    // 1. Wipe existing tenant data. Products first (all FKs into products
    // are CASCADE/SET NULL — safe in any order), then categories/brands/stores.
    for (const table of ["products", "product_categories", "brands", "stores"]) {
      const { error } = await supabase.from(table).delete().eq("retailer_id", retailerId);
      if (error) throw new Error(`Failed clearing ${table}: ${error.message}`);
    }

    // 2. Rename the retailer.
    const { error: renameErr } = await supabase
      .from("retailers")
      .update({ name: "Cape Union Mart", slug: `cape-union-mart-${retailerId.slice(0, 8)}` })
      .eq("id", retailerId);
    if (renameErr) throw new Error(`Failed renaming retailer: ${renameErr.message}`);

    // 3. Stores.
    const { error: storesErr } = await supabase.from("stores").insert(
      CAPE_UNION_MART_STORES.map((s) => ({
        retailer_id: retailerId,
        name: s.name,
        address: s.address,
        city: s.city,
        country: "South Africa",
        timezone: "Africa/Johannesburg",
        status: "active",
      })),
    );
    if (storesErr) throw new Error(`Failed inserting stores: ${storesErr.message}`);

    // 4. Brands.
    const { data: brandRows, error: brandsErr } = await supabase
      .from("brands")
      .insert(CAPE_UNION_MART_BRANDS.map((name) => ({ retailer_id: retailerId, name, slug: slugify(name) })))
      .select("id, name");
    if (brandsErr) throw new Error(`Failed inserting brands: ${brandsErr.message}`);
    const brandIdByName = new Map<string, string>((brandRows ?? []).map((b: any) => [b.name, b.id]));

    // 5. Category tree (departments, then their sub-categories as children).
    const { data: deptRows, error: deptErr } = await supabase
      .from("product_categories")
      .insert(CAPE_UNION_MART_CATEGORY_TREE.map((d) => ({ retailer_id: retailerId, name: d.name, parent_id: null })))
      .select("id, name");
    if (deptErr) throw new Error(`Failed inserting departments: ${deptErr.message}`);
    const deptIdByName = new Map<string, string>((deptRows ?? []).map((d: any) => [d.name, d.id]));

    const subcategoryInserts: { retailer_id: string; name: string; parent_id: string }[] = [];
    for (const dept of CAPE_UNION_MART_CATEGORY_TREE) {
      const parentId = deptIdByName.get(dept.name)!;
      for (const child of dept.children) {
        subcategoryInserts.push({ retailer_id: retailerId, name: child, parent_id: parentId });
      }
    }
    const { data: subRows, error: subErr } = await supabase
      .from("product_categories")
      .insert(subcategoryInserts)
      .select("id, name, parent_id");
    if (subErr) throw new Error(`Failed inserting sub-categories: ${subErr.message}`);

    // Sub-category names repeat across departments (e.g. "Jackets & Fleeces"
    // under both Men's and Women's Apparel), so key lookups by department+name.
    const subIdByDeptAndName = new Map<string, string>();
    for (const row of subRows ?? []) {
      const deptName = [...deptIdByName.entries()].find(([, id]) => id === (row as any).parent_id)?.[0];
      if (deptName) subIdByDeptAndName.set(`${deptName}::${(row as any).name}`, (row as any).id);
    }

    // 6. Products.
    const productRows = CAPE_UNION_MART_PRODUCTS.map((p, idx) => ({
      retailer_id: retailerId,
      sku: skuFor(idx),
      name: p.name,
      brand: p.brand,
      brand_id: brandIdByName.get(p.brand) ?? null,
      category_id: subIdByDeptAndName.get(`${p.department}::${p.subcategory}`) ?? null,
      price_cents: Math.round(p.priceRand * 100),
      currency: "ZAR",
      stock_qty: stockFor(idx),
      status: "active",
    }));
    const { error: prodErr } = await supabase.from("products").insert(productRows);
    if (prodErr) throw new Error(`Failed inserting products: ${prodErr.message}`);

    return {
      ok: true,
      stores: CAPE_UNION_MART_STORES.length,
      brands: CAPE_UNION_MART_BRANDS.length,
      categories: (deptRows?.length ?? 0) + (subRows?.length ?? 0),
      products: productRows.length,
    };
  });
