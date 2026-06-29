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
  // Sidebar logo enlarged 40% from previous lg (h-28 → h-40).
  const dim =
    size === "sm" ? "h-[88px] w-[88px]" : size === "lg" ? "h-40 w-40" : "h-32 w-32";
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
