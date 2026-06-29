import logoAsset from "@/assets/tag-logo.png.asset.json";

export function TagLogo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <img src={logoAsset.url} alt="Tag" className="h-8 w-8 object-contain" />
      {withWordmark && (
        <span className="text-lg font-bold tracking-tight text-foreground">Tag</span>
      )}
    </div>
  );
}
