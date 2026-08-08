import tagLogoHorizontal from "@/assets/Tag_logo_pink_horizontal.png";
import tagLogoV2 from "@/assets/Tag_logo_forest_green.png";
import tagLogoV3 from "@/assets/Tag_logo_yellow_bg.png";
import { useUIVersion } from "@/hooks/use-ui-version";

export function TagLogo({
  className,
  withWordmark = false,
  size = "default",
  variant = "icon",
  heightClass,
}: {
  className?: string;
  withWordmark?: boolean;
  size?: "default" | "sm" | "lg" | "xl";
  variant?: "icon" | "wordmark";
  // Optional explicit Tailwind height class (e.g. "h-[8.64rem]"). Overrides
  // the size-based height for the wordmark image when a caller needs a
  // specific size the presets don't cover.
  heightClass?: string;
}) {
  // V1 keeps the original pink mark; V2 and V3 drop pink entirely, each
  // with their own logo.
  const uiVersion = useUIVersion();
  const logoSrc = uiVersion === "v3" ? tagLogoV3 : uiVersion === "v2" ? tagLogoV2 : tagLogoHorizontal;

  if (variant === "wordmark") {
    const h =
      heightClass ??
      (size === "sm"
        ? "h-[4.8rem]"
        : size === "lg"
          ? "h-32"
          : size === "xl"
            ? "h-[368px]"
            : "h-[5.6rem]");
    return (
      <div className={`flex items-center justify-center ${className ?? ""}`}>
        <img
          src={logoSrc}
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
        src={logoSrc}
        alt="Tag"
        className={`${dim} object-contain`}
      />
      {withWordmark && (
        <span className="ml-2 text-lg font-bold tracking-tight">Tag</span>
      )}
    </div>
  );
}
