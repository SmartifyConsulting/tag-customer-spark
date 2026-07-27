import { z } from "zod";

// Barcode (GTIN-8 / 12 / 13 / 14) validation with GS1 check digit.
export function isValidGtin(input: string): boolean {
  const digits = String(input).replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const g = digits.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(g[i]) * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === Number(g[13]);
}



export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  sku: z.string().trim().min(1, "SKU is required").max(80),
  gtin: z
    .string()
    .trim()
    .max(14)
    .optional()
    .nullable()
    .refine(
      (v) => !v || isValidGtin(v),
      "Enter a valid 8, 12, 13 or 14 digit barcode (check digit must match)",
    ),

  brand: z.string().trim().max(120).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  store_id: z.string().uuid().optional().nullable(),
  description: z.string().trim().max(4000).optional().nullable(),
  price_cents: z.number().int().min(0),
  sale_price_cents: z.number().int().min(0).optional().nullable(),
  currency: z.string().trim().min(3).max(3).default("ZAR"),
  stock_qty: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(5),
  color: z.string().trim().max(60).optional().nullable(),
  size: z.string().trim().max(60).optional().nullable(),
  status: z.enum(["active", "draft", "archived"]).default("active"),
  promotion_start_date: z.string().datetime().optional().nullable(),
  promotion_end_date: z.string().datetime().optional().nullable(),
  images: z
    .array(z.object({ url: z.string().url(), path: z.string(), sort: z.number().int() }))
    .default([]),
});

export type ProductInput = z.infer<typeof productInputSchema>;

export const listProductsSchema = z.object({
  search: z.string().optional().default(""),
  status: z.enum(["all", "active", "draft", "archived"]).optional().default("all"),
  category_id: z.string().uuid().optional().nullable(),
  brand_id: z.string().uuid().optional().nullable(),
  store_id: z.string().uuid().optional().nullable(),
  tagged: z.enum(["all", "tagged", "untagged"]).optional().default("all"),
  promotion: z.boolean().optional().default(false),
  low_stock: z.boolean().optional().default(false),
  sort: z
    .enum(["recent", "name", "price", "stock"])
    .optional()
    .default("recent"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(5).max(100).optional().default(20),
});

export type ListProductsInput = z.infer<typeof listProductsSchema>;
