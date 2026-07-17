import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Fynbos-style horizontal nav: grouped dropdowns + a pill-highlighted
// Pricing link, reused across every marketing/auth page so it never drifts
// out of sync between them.
function NavGroup({ label, items }: { label: string; items: { label: string; to: string; hash?: string }[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1 text-base font-bold text-foreground outline-none hover:text-primary">
        {label}
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        {items.map((item) => (
          <DropdownMenuItem key={item.label} asChild>
            <Link to={item.to} hash={item.hash} className="cursor-pointer">
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MarketingNav() {
  return (
    <nav className="hidden items-center gap-8 md:flex">
      <NavGroup
        label="Product"
        items={[
          { label: "How it works", to: "/about", hash: "how" },
          { label: "Features", to: "/about", hash: "features" },
          { label: "Intelligence Engine", to: "/about", hash: "intelligence" },
          { label: "Interest Graph & Gap", to: "/about", hash: "proprietary" },
        ]}
      />
      <NavGroup
        label="Company"
        items={[{ label: "About Tag", to: "/about" }]}
      />
      <Link
        to="/pricing"
        className="rounded-full bg-muted px-4 py-2 text-base font-bold text-foreground hover:bg-muted/70"
      >
        Pricing
      </Link>
    </nav>
  );
}
