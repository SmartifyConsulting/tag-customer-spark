import iconAsset from "@/assets/tag-logo-clear.png.asset.json";
import wordmarkAsset from "@/assets/tag-logo-clear.png.asset.json";

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
        ? "h-[4.8rem]"
        : size === "lg"
          ? "h-32"
          : size === "xl"
            ? "h-[368px]"
            : "h-[5.6rem]";
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
