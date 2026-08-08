import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Palette } from "lucide-react";

type UIVersion = "v1" | "v2" | "v3";

const UI_VERSIONS: Record<UIVersion, { name: string; description: string }> = {
  v1: { name: "V1", description: "Original black & white" },
  v2: { name: "V2", description: "Cream, Forest Green, Orange" },
  v3: { name: "V3", description: "Coming soon" },
};

const THEME_CONFIGS: Record<UIVersion, Record<string, string>> = {
  v1: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.16 0.005 60)",
    "--primary": "oklch(0.16 0.005 60)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.96 0 0)",
    "--secondary-foreground": "oklch(0.16 0.005 60)",
    "--accent": "oklch(0.16 0.005 60)",
    "--accent-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.90 0 0)",
    "--input": "oklch(0.90 0 0)",
    "--sidebar": "oklch(1 0 0)",
    "--sidebar-foreground": "oklch(0.16 0.005 60)",
    "--sidebar-primary": "oklch(0.16 0.005 60)",
    "--sidebar-primary-foreground": "oklch(1 0 0)",
  },
  v2: {
    "--background": "#F5F1E8",
    "--foreground": "#2C3E50",
    "--primary": "#2C5F4F",
    "--primary-foreground": "#FFFFFF",
    "--secondary": "#F5A623",
    "--secondary-foreground": "#FFFFFF",
    "--accent": "#F5A623",
    "--accent-foreground": "#FFFFFF",
    "--border": "#E8E4D8",
    "--input": "#F9F7F3",
    "--sidebar": "#F5F1E8",
    "--sidebar-foreground": "#2C3E50",
    "--sidebar-primary": "#2C5F4F",
    "--sidebar-primary-foreground": "#FFFFFF",
  },
  v3: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.16 0.005 60)",
    "--primary": "oklch(0.16 0.005 60)",
    "--primary-foreground": "oklch(1 0 0)",
    "--secondary": "oklch(0.96 0 0)",
    "--secondary-foreground": "oklch(0.16 0.005 60)",
    "--accent": "oklch(0.16 0.005 60)",
    "--accent-foreground": "oklch(1 0 0)",
    "--border": "oklch(0.90 0 0)",
    "--input": "oklch(0.90 0 0)",
    "--sidebar": "oklch(1 0 0)",
    "--sidebar-foreground": "oklch(0.16 0.005 60)",
    "--sidebar-primary": "oklch(0.16 0.005 60)",
    "--sidebar-primary-foreground": "oklch(1 0 0)",
  },
};

export function UIVersionSwitcher() {
  const [activeVersion, setActiveVersion] = useState<UIVersion>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ui-version") as UIVersion) || "v2";
    }
    return "v2";
  });

  useEffect(() => {
    // Apply theme to root element
    const root = document.documentElement;
    const theme = THEME_CONFIGS[activeVersion];

    Object.entries(theme).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Save to localStorage
    localStorage.setItem("ui-version", activeVersion);
  }, [activeVersion]);

  const handleVersionChange = (version: UIVersion) => {
    setActiveVersion(version);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Switch UI version"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs font-semibold">
          UI Versions (Demo)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.entries(UI_VERSIONS) as Array<[UIVersion, typeof UI_VERSIONS[UIVersion]]>).map(
          ([version, config]) => (
            <DropdownMenuItem
              key={version}
              onClick={() => handleVersionChange(version)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div>
                <div className="font-medium">{config.name}</div>
                <div className="text-xs text-muted-foreground">{config.description}</div>
              </div>
              {activeVersion === version && (
                <div className="h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
