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
        ? "h-10"
        : size === "lg"
          ? "h-16"
          : size === "xl"
            ? "h-48"
            : "h-12";
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
    size === "sm" ? "h-[88px] w-[88px]" : size === "lg" ? "h-40 w-40" : "h-32 w-32";
  return (
    <div className={`flex items-center justify-center ${className ?? ""}`}>
      <img
        src={iconAsset.url}
        alt="Tag"
        className={`${dim} object-contain drop-shadow-[0_4px_18px_rgba(0,176,116,0.25)]`}
      />
      {withWordmark && (
        <span className="ml-2 text-lg font-bold tracking-tight">Tag</span>
      )}
    </div>
  );
}
