import logoAsset from "@/assets/tag-logo-v2.png.asset.json";

export function TagLogo({
  className,
  withWordmark = false,
  size = "default",
}: {
  className?: string;
  withWordmark?: boolean;
  size?: "default" | "sm" | "lg";
}) {
  // Doubled in size per latest brief.
  const dim =
    size === "sm" ? "h-16 w-16" : size === "lg" ? "h-28 w-28" : "h-24 w-24";
  return (
    <div className={`flex items-center justify-center ${className ?? ""}`}>
      <img
        src={logoAsset.url}
        alt="Tag"
        className={`${dim} object-contain drop-shadow-[0_4px_18px_rgba(0,176,116,0.25)]`}
      />
      {withWordmark && (
        <span className="ml-2 text-lg font-bold tracking-tight">Tag</span>
      )}
    </div>
  );
}
