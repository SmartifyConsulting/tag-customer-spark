import { createContext, useContext, useEffect, type ReactNode } from "react";

type ThemeContextValue = {
  resolvedTheme: "light";
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Dark mode has been removed entirely — the app is always light, regardless
// of any theme a user previously picked or their OS preference.
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    localStorage.removeItem("tag-theme");
  }, []);

  return <ThemeContext.Provider value={{ resolvedTheme: "light" }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
