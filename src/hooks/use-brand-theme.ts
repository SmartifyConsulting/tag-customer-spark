import { useEffect, useState } from "react";

type BrandTheme = {
  background: string;
  primary: string;
  primaryForeground: string;
} | null;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s * 100, l * 100];
}

// Reads a retailer's logo and decides how to tint the workspace:
//  - a logo with a real colour → background becomes a light tint of that
//    hue, primary becomes a usable mid-tone of the same hue
//  - a logo that's effectively black/grey only → background stays crisp
//    white, nothing else changes
//  - anything ambiguous (too few solid pixels, e.g. a mostly-transparent
//    or mostly-white logo) → no override, default theme stands
export function useBrandTheme(logoUrl: string | null | undefined): BrandTheme {
  const [theme, setTheme] = useState<BrandTheme>(null);

  useEffect(() => {
    if (!logoUrl) {
      setTheme(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 48;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let opaqueCount = 0;
        let blackCount = 0;
        let colorCount = 0;
        let hueSin = 0;
        let hueCos = 0;
        let satSum = 0;
        let lightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 200) continue;
          opaqueCount++;
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          if (l > 92) continue; // near-white background/padding, ignore
          if (s < 15) {
            if (l < 35) blackCount++;
            continue; // low-saturation grey, not a "colour"
          }
          colorCount++;
          const rad = (h * Math.PI) / 180;
          hueSin += Math.sin(rad);
          hueCos += Math.cos(rad);
          satSum += s;
          lightSum += l;
        }

        if (cancelled || opaqueCount === 0) return;

        if (colorCount > 0 && colorCount / opaqueCount > 0.05) {
          const hue = (Math.atan2(hueSin, hueCos) * 180) / Math.PI;
          const hueNorm = ((hue % 360) + 360) % 360;
          const avgSat = Math.min(70, Math.max(35, satSum / colorCount));
          setTheme({
            background: `hsl(${hueNorm.toFixed(1)} ${Math.min(avgSat, 30).toFixed(0)}% 96%)`,
            primary: `hsl(${hueNorm.toFixed(1)} ${avgSat.toFixed(0)}% 38%)`,
            primaryForeground: "hsl(0 0% 100%)",
          });
        } else if (blackCount / opaqueCount > 0.3) {
          // Logo is (essentially) black-only — crisp white background,
          // leave primary/foreground at their existing defaults.
          setTheme({ background: "hsl(0 0% 100%)", primary: "", primaryForeground: "" });
        } else {
          setTheme(null);
        }
      } catch {
        // Canvas can throw on cross-origin taint if the storage bucket ever
        // stops sending CORS headers — fail silently to the default theme.
        setTheme(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setTheme(null);
    };
    img.src = logoUrl;
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  return theme;
}
