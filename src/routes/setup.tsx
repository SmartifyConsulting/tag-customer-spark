import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, FileUp, PartyPopper, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { previewProductImport, commitProductImport, type ImportRow } from "@/lib/import.functions";
import { saveRetailerPosSystem } from "@/lib/settings.functions";
import heroLogo from "@/assets/tag-logo-clear.png.asset.json";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({ meta: [{ title: "TAG Setup — Tag" }] }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: SetupWizard,
});

const RETAIL_SYSTEMS = [
  "Shopify",
  "Lightspeed",
  "Vend",
  "Square",
  "WooCommerce",
  "Odoo",
  "SAP Business One",
  "Sage",
  "Xero",
  "QuickBooks",
  "Zoho Inventory",
  "Cin7",
  "Unleashed",
  "NetSuite",
  "Clover",
  "Other / not listed",
];

const CONNECTING_STEPS = [
  "Connecting your products…",
  "Getting everything ready…",
  "Preparing your product experience…",
];

const IMPORTING_STEPS = [
  "Getting your products ready…",
  "Preparing your products…",
  "Creating your digital products…",
  "Adding product details…",
  "Finalising your products…",
];

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Step = "welcome" | "system" | "connecting" | "file" | "importing" | "done";

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [posSystem, setPosSystem] = useState<string | null>(null);
  const [connectingIdx, setConnectingIdx] = useState(0);
  const [importingIdx, setImportingIdx] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const savePosFn = useServerFn(saveRetailerPosSystem);
  const previewFn = useServerFn(previewProductImport);
  const commitFn = useServerFn(commitProductImport);

  const preview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return previewFn({ data: { filename: f.name, mime: f.type || "application/octet-stream", base64 } });
    },
    onSuccess: (res) => {
      if (!res.rows.length) {
        toast.warning("We couldn't find any products in that file — try another export.");
        return;
      }
      setRows(res.rows);
      setStep("importing");
    },
    onError: () => toast.error("That file didn't come through — please try another export."),
  });

  const commit = useMutation({
    mutationFn: (importRows: ImportRow[]) => commitFn({ data: { rows: importRows } }),
  });

  // Themed "connecting" animation — always resolves to the fallback file
  // picker, framed as the next step rather than a failure.
  useEffect(() => {
    if (step !== "connecting") return;
    setConnectingIdx(0);
    let cancelled = false;
    (async () => {
      for (let i = 0; i < CONNECTING_STEPS.length; i++) {
        await sleep(750);
        if (cancelled) return;
        setConnectingIdx(i + 1);
      }
      await sleep(500);
      if (!cancelled) setStep("file");
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  // Perceived-progress ticker for the real import, coordinated with the
  // actual commitProductImport call so it never shows "done" before the
  // work has actually finished.
  useEffect(() => {
    if (step !== "importing" || rows.length === 0) return;
    setImportingIdx(0);
    let cancelled = false;

    const tick = (async () => {
      for (let i = 0; i < IMPORTING_STEPS.length - 1; i++) {
        await sleep(900);
        if (cancelled) return;
        setImportingIdx(i + 1);
      }
    })();

    const work = commit.mutateAsync(rows).then((res) => {
      if (cancelled) return null;
      return res;
    });

    Promise.all([tick, work]).then(([, res]) => {
      if (cancelled || !res) return;
      setImportingIdx(IMPORTING_STEPS.length);
      setResult({ created: res.created, updated: res.updated });
      sleep(600).then(() => {
        if (!cancelled) setStep("done");
      });
    }).catch(() => {
      if (!cancelled) toast.error("We hit a snag getting your products ready — please try again.");
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rows]);

  const handlePickSystem = (system: string) => {
    setPosSystem(system);
    savePosFn({ data: { posSystem: system } }).catch(() => {});
    setStep("connecting");
  };

  const handleFile = (f: File) => {
    setFile(f);
    preview.mutate(f);
  };

  const totalProducts = (result?.created ?? 0) + (result?.updated ?? 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <img src={heroLogo.url} alt="Tag" className="h-24 w-auto object-contain" />
        </div>
        <Card className="rounded-2xl border-border/60 p-8 shadow-sm">
          {step === "welcome" && <WelcomeStep onNext={() => setStep("system")} />}
          {step === "system" && <SystemStep onPick={handlePickSystem} />}
          {step === "connecting" && <ConnectingStep activeIdx={connectingIdx} />}
          {step === "file" && (
            <FileStep
              inputRef={inputRef}
              file={file}
              loading={preview.isPending}
              onFile={handleFile}
            />
          )}
          {step === "importing" && <ImportingStep activeIdx={importingIdx} />}
          {step === "done" && (
            <DoneStep
              count={totalProducts}
              onGoToDashboard={() => navigate({ to: "/dashboard" })}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome to TAG</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll get everything ready for you in just a few minutes.
        </p>
      </div>
      <Button size="lg" className="w-full" onClick={onNext}>
        Get Started
      </Button>
    </div>
  );
}

function SystemStep({ onPick }: { onPick: (system: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Which retail system do you use?</h1>
        <p className="mt-1 text-sm text-muted-foreground">This helps us set things up the right way for you.</p>
      </div>
      <Command className="rounded-xl border">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <CommandInput placeholder="Search for your system…" className="border-0 focus:ring-0" />
        </div>
        <CommandList className="max-h-64">
          <CommandEmpty>No matches — pick "Other / not listed" below.</CommandEmpty>
          <CommandGroup>
            {RETAIL_SYSTEMS.map((system) => (
              <CommandItem key={system} value={system} onSelect={() => onPick(system)} className="cursor-pointer">
                {system}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

function ConnectingStep({ activeIdx }: { activeIdx: number }) {
  return (
    <div className="space-y-6 py-4 text-center">
      <h1 className="text-xl font-bold tracking-tight">Setting up TAG</h1>
      <div className="space-y-4">
        {CONNECTING_STEPS.map((label, i) => (
          <ProgressLine key={label} label={label} done={i < activeIdx} active={i === activeIdx} />
        ))}
      </div>
    </div>
  );
}

function FileStep({
  inputRef,
  file,
  loading,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  loading: boolean;
  onFile: (f: File) => void;
}) {
  return (
    <div className="space-y-5 text-center">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Almost there!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          To finish setting up TAG, simply choose your latest product export.
        </p>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 hover:bg-muted/50">
        <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
        <span className="font-medium">Choose your product file</span>
        <span className="mt-1 text-xs text-muted-foreground">XLSX, CSV, or PDF</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      {loading && (
        <p className="text-sm text-muted-foreground">Reading {file?.name}…</p>
      )}
    </div>
  );
}

function ImportingStep({ activeIdx }: { activeIdx: number }) {
  return (
    <div className="space-y-6 py-4 text-center">
      <h1 className="text-xl font-bold tracking-tight">Connecting your products…</h1>
      <div className="space-y-4">
        {IMPORTING_STEPS.map((label, i) => (
          <ProgressLine key={label} label={label} done={i < activeIdx} active={i === activeIdx} />
        ))}
      </div>
    </div>
  );
}

function ProgressLine({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3 text-left">
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-white transition-colors ${
          done ? "border-primary bg-primary" : "border-muted-foreground/30 bg-transparent"
        }`}
      >
        {done && <Check className="h-3 w-3" />}
      </span>
      <span className={done || active ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function DoneStep({ count, onGoToDashboard }: { count: number; onGoToDashboard: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <PartyPopper className="h-12 w-12 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">You're all set!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {count.toLocaleString()} product{count === 1 ? "" : "s"} {count === 1 ? "is" : "are"} now ready on TAG.
        </p>
      </div>
      <Button size="lg" className="w-full" onClick={onGoToDashboard}>
        Go to Dashboard
      </Button>
    </div>
  );
}
