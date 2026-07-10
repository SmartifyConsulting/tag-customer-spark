import { useState } from "react";
import { Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// TAG's shared product image renderer.
// - Never renders an empty container: falls back to an inline SVG placeholder.
// - Uses `thumbnail_url` at list sizes, `hero_image` for headers, `image_url`
//   for full-size detail views.

export function ProductImage({
  product,
  variant = "thumb",
  className,
  alt,
}: {
  product: {
    name?: string | null;
    brand?: string | null;
    image_url?: string | null;
    thumbnail_url?: string | null;
    hero_image?: string | null;
  } | null;
  variant?: "thumb" | "hero" | "full";
  className?: string;
  alt?: string;
}) {
  const src =
    (variant === "thumb"
      ? product?.thumbnail_url || product?.image_url || product?.hero_image
      : variant === "hero"
        ? product?.hero_image || product?.image_url || product?.thumbnail_url
        : product?.image_url || product?.hero_image || product?.thumbnail_url) ?? null;

  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div
        className={cn(
          "grid h-full w-full place-items-center bg-gradient-to-br from-slate-800 to-slate-500 text-white",
          className,
        )}
        aria-label={alt ?? product?.name ?? "Product"}
      >
        <div className="text-center leading-none">
          <Tag className="mx-auto h-6 w-6 opacity-90" />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest opacity-80">TAG</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? product?.name ?? ""}
      loading="lazy"
      className={cn("h-full w-full object-cover", className)}
      onError={() => setBroken(true)}
    />
  );
}
