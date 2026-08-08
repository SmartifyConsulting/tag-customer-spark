import { useEffect, useState } from "react";

export type UIVersion = "v1" | "v2" | "v3";

function readVersion(): UIVersion {
  if (typeof window === "undefined") return "v2";
  return (localStorage.getItem("ui-version") as UIVersion) || "v2";
}

// Components rendered outside UIVersionSwitcher (e.g. the logo) use this to
// react to the active demo theme without a shared context provider.
export function useUIVersion(): UIVersion {
  const [version, setVersion] = useState<UIVersion>(readVersion);

  useEffect(() => {
    const onChange = (e: Event) => setVersion((e as CustomEvent<UIVersion>).detail);
    window.addEventListener("ui-version-change", onChange);
    return () => window.removeEventListener("ui-version-change", onChange);
  }, []);

  return version;
}
