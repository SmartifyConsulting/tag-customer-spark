import { useState } from "react";
import { X, ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";

export type TourStep = {
  title: string;
  body: string;
};

// A small dismissible step card shown the first time a signed-in user visits
// a given page. Purely additive — doesn't anchor to specific DOM elements,
// so it can't break as the surrounding page's layout evolves. Dismissing
// (via "Got it" on the last step, or the close button) marks it seen for
// that user/page forever; see use-onboarding-tour.ts.
export function OnboardingTour({
  userId,
  tourKey,
  steps,
}: {
  userId: string | undefined;
  tourKey: string;
  steps: TourStep[];
}) {
  const { show, dismiss } = useOnboardingTour(userId, tourKey);
  const [index, setIndex] = useState(0);

  if (!show || steps.length === 0) return null;

  const step = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close tips"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 text-[color:var(--mint)]">
        <Lightbulb className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wide">Tip</span>
      </div>

      <h3 className="mt-2 text-base font-bold text-foreground">{step.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index ? "bg-[color:var(--mint)]" : "bg-muted"
              }`}
            />
          ))}
        </div>
        {isLast ? (
          <Button size="sm" onClick={dismiss} className="gap-1.5">
            Got it
          </Button>
        ) : (
          <Button size="sm" onClick={() => setIndex((i) => i + 1)} className="gap-1.5">
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
