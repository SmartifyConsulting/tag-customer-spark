import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingTip } from "@/hooks/use-onboarding-tips";

export function OnboardingTipOverlay({
  tip,
  totalTips,
  currentIndex,
  onNext,
  onPrevious,
  onDismiss,
}: {
  tip: OnboardingTip;
  totalTips: number;
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onDismiss: () => void;
}) {
  const isLastTip = currentIndex === totalTips - 1;
  const isFirstTip = currentIndex === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute right-4 top-4 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-800"
          aria-label="Close tips"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="pr-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{tip.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{tip.body}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Tip {currentIndex + 1} of {totalTips}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              disabled={isFirstTip}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={isLastTip}
              className="gap-1"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={onDismiss}
              className="ml-2"
            >
              {isLastTip ? "Got it!" : "Skip"}
            </Button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-4 flex justify-center gap-1">
          {Array.from({ length: totalTips }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition ${
                i === currentIndex ? "bg-blue-500" : "bg-gray-300 dark:bg-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
