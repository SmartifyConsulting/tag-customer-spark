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
    <nav className="hidden items-center gap-2 text-sm font-bold text-foreground md:flex">
      {LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="rounded-md bg-[color:var(--mint)] px-4 py-2 text-white transition-colors hover:bg-gray-200 hover:text-[#A6446B]"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// Sign in + Start Setup, shown together in the header on every marketing
// page (not just the hero) so the entry points are always consistent.
// Start Setup always lands on the minimal, centered "Create your Tag
// account" view (/auth?mode=signup) — never the split sign-in layout.
export function MarketingCtaGroup() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  if (authed) {
    return (
      <Button onClick={() => navigate({ to: "/dashboard" })} className="gap-2">
        Open dashboard <ArrowRight className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => navigate({ to: "/auth" })}
        className="gap-2 hover:!bg-[#D6B326] hover:!text-white hover:!border-[#D6B326]"
      >
        Sign in
      </Button>
      <Button
        onClick={() => navigate({ to: "/auth", search: { mode: "signup" } })}
        className="gap-2"
      >
        Start Setup <ArrowRight className="h-4 w-4" />
      </Button>
    </>
  );
}
