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

// Flat, bold, left-aligned nav shared by every marketing/auth page so it
// never drifts out of sync between them. showStartSetup adds a trailing
// CTA button — used on every page except the hero and the sign-in page
// itself, which already have their own primary actions.
export function MarketingNav({ showStartSetup = false }: { showStartSetup?: boolean }) {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  const primaryHref = authed ? "/dashboard" : "/auth";
  const primaryLabel = authed ? "Open dashboard" : "Start Setup";

  return (
    <div className="flex flex-1 items-center gap-8">
      <nav className="hidden items-center gap-6 text-base font-bold text-foreground md:flex">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="hover:text-[color:var(--mint)]">
            {l.label}
          </Link>
        ))}
      </nav>
      {showStartSetup && (
        <Button onClick={() => navigate({ to: primaryHref })} className="ml-auto gap-2">
          {primaryLabel} <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
