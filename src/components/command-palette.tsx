import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Package, QrCode, Users, Bell, Inbox, BarChart3, Store, UserCog, Settings,
  Sparkles, Gauge, Eye, DollarSign, Plus,
} from "lucide-react";

const items = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, group: "Go to" },
  { label: "AI Intelligence", to: "/intelligence", icon: Sparkles, group: "Go to" },
  { label: "Intent Engine", to: "/intent", icon: Gauge, group: "Go to" },
  { label: "Watchlists", to: "/watchlists", icon: Eye, group: "Go to" },
  { label: "ROI Engine", to: "/roi", icon: DollarSign, group: "Go to" },
  { label: "Products", to: "/products", icon: Package, group: "Go to" },
  
  { label: "Customers", to: "/customers", icon: Users, group: "Go to" },
  { label: "Inbox", to: "/inbox", icon: Inbox, group: "Go to" },
  { label: "Notifications", to: "/notifications", icon: Bell, group: "Go to" },
  { label: "Analytics", to: "/analytics", icon: BarChart3, group: "Go to" },
  { label: "Stores", to: "/stores", icon: Store, group: "Go to" },
  { label: "Staff", to: "/staff", icon: UserCog, group: "Go to" },
  { label: "Settings", to: "/settings", icon: Settings, group: "Go to" },
  { label: "New campaign", to: "/notifications/new", icon: Plus, group: "Actions" },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = Array.from(new Set(items.map((i) => i.group)));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search Tag — pages, actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {groups.map((g, gi) => (
          <div key={g}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={g}>
              {items.filter((i) => i.group === g).map((i) => (
                <CommandItem key={i.to} onSelect={() => { setOpen(false); navigate({ to: i.to as any }); }}>
                  <i.icon className="mr-2 h-4 w-4" />
                  {i.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
