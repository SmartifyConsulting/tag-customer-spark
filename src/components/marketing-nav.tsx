import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Features", to: "/features" as const },
  { label: "How it Works", to: "/how-it-works" as const },
  { label: "Intelligence Engine", to: "/intelligence-engine" as const },
  { label: "Intent Gap Analytics", to: "/intent-gap-analytics" as const },
  { label: "Pricing", to: "/pricing" as const },
];

// Just the pill row. Consumers place it inside the shared header grid and
// decide what sits in the right slot (see MarketingHeader).
export function MarketingNav() {
  return (
    <nav className="hidden items-center gap-1.5 text-[13px] font-bold text-foreground md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="rounded-full border-2 border-[color:var(--mint)] bg-[color:var(--mint)] px-2.5 py-1 text-white transition-colors hover:bg-gray-200 hover:text-[color:var(--mint)]"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// Default right-slot CTA for marketing sub-pages.
export function MarketingCtaButton() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);
  const primaryHref = authed ? "/dashboard" : "/auth";
  const primaryLabel = authed ? "Open dashboard" : "Start Setup";
  return (
    <Button onClick={() => navigate({ to: primaryHref })} className="gap-2">
      {primaryLabel} <ArrowRight className="h-4 w-4" />
    </Button>
  );
}
