import { useEffect, useRef, useState } from "react";
import { X, ArrowRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";

export type TourStep = {
  title: string;
  body: string;
  // DOM id of the element this step is about. When present (and found on
  // the page), the tip card floats next to that element instead of sitting
  // in a fixed corner, so each step points at the part of the screen it's
  // actually describing.
  targetId?: string;
};

const CARD_WIDTH = 352; // w-[22rem]
const MARGIN = 16;

type Position = { top: number; left: number } | null;

function computePosition(targetId: string | undefined): Position {
  if (!targetId) return null;
  const el = document.getElementById(targetId);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  // Prefer sitting just below the target, left-aligned to it; clamp so the
  // card never runs off any edge of the viewport.
  let top = rect.bottom + 12;
  let left = rect.left;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  if (left + CARD_WIDTH + MARGIN > viewportW) {
    left = viewportW - CARD_WIDTH - MARGIN;
  }
  if (left < MARGIN) left = MARGIN;

  // Not enough room below — place it above the target instead.
  const estimatedCardHeight = 180;
  if (top + estimatedCardHeight + MARGIN > viewportH) {
    top = rect.top - estimatedCardHeight - 12;
  }
  if (top < MARGIN) top = MARGIN;

  return { top, left };
}

// A small dismissible step card shown the first time a signed-in user visits
// a given page. When a step names a `targetId`, the card floats next to that
// element (recalculated on step change, resize, and scroll); otherwise it
// falls back to a fixed corner. Dismissing (via "Got it" on the last step,
// or the close button) marks it seen for that user/page forever; see
// use-onboarding-tour.ts.
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
  const [position, setPosition] = useState<Position>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const step = steps[index];

  useEffect(() => {
    if (!show || !step) return;

    const update = () => setPosition(computePosition(step.targetId));
    update();
    // The target may only exist after data loads or a layout shift — retry
    // shortly in case it wasn't in the DOM yet on the first measurement.
    const retry = setTimeout(update, 300);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(retry);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [show, step]);

  if (!show || steps.length === 0 || !step) return null;

  const isLast = index === steps.length - 1;
  const floating = position !== null;

  return (
    <div
      ref={cardRef}
      className={
        floating
          ? "fixed z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl bg-[#C75984] p-5 shadow-lg transition-[top,left] duration-300 before:absolute before:w-0 before:h-0 before:border-8 before:border-transparent before:border-t-[#C75984] before:-bottom-2 before:left-6 text-white"
          : "fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-3rem)] rounded-2xl bg-[#C75984] p-5 shadow-lg text-white"
      }
      style={floating ? { top: position!.top, left: position!.left } : undefined}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Close tips"
        className="absolute right-3 top-3 text-white/70 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 text-white">
        <Lightbulb className="h-4 w-4" />
        <span className="text-xs font-bold uppercase tracking-wide">Tip</span>
      </div>

      <h3 className="mt-2 text-base font-bold text-white">{step.title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/90">{step.body}</p>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
        {isLast ? (
          <Button size="sm" onClick={dismiss} className="gap-1.5 bg-white text-[#C75984] hover:bg-white/90">
            Got it
          </Button>
        ) : (
          <Button size="sm" onClick={() => setIndex((i) => i + 1)} className="gap-1.5 bg-white text-[#C75984] hover:bg-white/90">
            Next <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
