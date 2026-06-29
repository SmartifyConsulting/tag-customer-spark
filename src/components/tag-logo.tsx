import logoAsset from "@/assets/tag-logo.png.asset.json";

export function TagLogo({
  className,
  withWordmark = false,
  size = "default",
}: {
  className?: string;
  withWordmark?: boolean;
  size?: "default" | "sm" | "lg";
}) {
  const dim = size === "sm" ? "h-10 w-10" : size === "lg" ? "h-14 w-14" : "h-12 w-12";
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <img
        src={logoAsset.url}
        alt="Tag"
        className={`${dim} object-contain drop-shadow-sm`}
      />
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight">Tag</span>
      )}
    </div>
  );
}
