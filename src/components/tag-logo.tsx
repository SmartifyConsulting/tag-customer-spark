import iconAsset from "@/assets/tag-logo-v2.png.asset.json";
import wordmarkAsset from "@/assets/tag-logo-hero.png.asset.json";

export function TagLogo({
  className,
  withWordmark = false,
  size = "default",
  variant = "icon",
}: {
  className?: string;
  withWordmark?: boolean;
  size?: "default" | "sm" | "lg" | "xl";
  variant?: "icon" | "wordmark";
}) {
  if (variant === "wordmark") {
    const h =
      size === "sm"
        ? "h-12"
        : size === "lg"
          ? "h-20"
          : size === "xl"
            ? "h-[230px]"
            : "h-14";
    return (
      <div className={`flex items-center justify-center ${className ?? ""}`}>
        <img
          src={wordmarkAsset.url}
          alt="Tag"
          className={`${h} w-auto object-contain`}
        />
      </div>
    );
  }
  const dim =
    size === "sm" ? "h-[106px] w-[106px]" : size === "lg" ? "h-48 w-48" : "h-40 w-40";

  return (
    <div className={`flex items-center justify-center ${className ?? ""}`}>
      <img
        src={iconAsset.url}
        alt="Tag"
        className={`${dim} object-contain`}
      />
      {withWordmark && (
        <span className="ml-2 text-lg font-bold tracking-tight">Tag</span>
      )}
    </div>
  );
}
