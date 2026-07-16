import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, FileUp, PartyPopper, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { previewProductImport, commitProductImport, type ImportRow } from "@/lib/import.functions";
import {
  bulkCompleteDigitalIdentity,
  listIncompleteDigitalIdentityIds,
} from "@/lib/products.functions";
import { assignMissingBarcodes } from "@/lib/barcode-assign.functions";
import {
  previewCustomerImport,
  commitCustomerImport,
  type CustomerImportRow,
} from "@/lib/customer-import.functions";
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

type Step =
  | "welcome"
  | "system"
  | "connecting"
  | "file"
  | "importing"
  | "customerFile"
  | "customerImporting"
  | "done";

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [posSystem, setPosSystem] = useState<string | null>(null);
  const [connectingIdx, setConnectingIdx] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [importLabel, setImportLabel] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const [customerFile, setCustomerFile] = useState<File | null>(null);
  const [customerRows, setCustomerRows] = useState<CustomerImportRow[]>([]);
  const [customerResult, setCustomerResult] = useState<{ created: number; updated: number } | null>(
    null,
  );
  const [customerImportLabel, setCustomerImportLabel] = useState("");
  const [customerImportProgress, setCustomerImportProgress] = useState(0);
  const customerInputRef = useRef<HTMLInputElement>(null);

  const savePosFn = useServerFn(saveRetailerPosSystem);
  const previewFn = useServerFn(previewProductImport);
  const commitFn = useServerFn(commitProductImport);
  const assignBarcodesFn = useServerFn(assignMissingBarcodes);
  const listIncompleteFn = useServerFn(listIncompleteDigitalIdentityIds);
  const bulkCompleteFn = useServerFn(bulkCompleteDigitalIdentity);
  const customerPreviewFn = useServerFn(previewCustomerImport);
  const customerCommitFn = useServerFn(commitCustomerImport);

  const preview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return previewFn({
        data: { filename: f.name, mime: f.type || "application/octet-stream", base64 },
      });
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

  const customerPreview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return customerPreviewFn({
        data: { filename: f.name, mime: f.type || "application/octet-stream", base64 },
      });
    },
    onSuccess: (res) => {
      if (!res.rows.length) {
        toast.warning("We couldn't find any customers with a name and phone number in that file.");
        return;
      }
      setCustomerRows(res.rows);
      setStep("customerImporting");
    },
    onError: () => toast.error("That file didn't come through — please try another export."),
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

  // The real import, then the same barcode-to-QR pipeline as "Tag
  // Intelligence" — the progress bar tracks actual completion (not a fixed
  // timer), so "done" only shows once every imported product genuinely has
  // a complete digital identity and is ready to appear in Inventory and
  // Taxonomy, however long that takes.
  useEffect(() => {
    if (step !== "importing" || rows.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        setImportProgress(5);
        setImportLabel(`Importing ${rows.length} product${rows.length === 1 ? "" : "s"}…`);
        const commitRes = await commitFn({ data: { rows } });
        if (cancelled) return;
        setImportProgress(35);

        setImportLabel("Assigning missing barcodes…");
        await assignBarcodesFn();
        if (cancelled) return;
        setImportProgress(45);

        setImportLabel("Finding products that still need a QR code…");
        const { ids } = await listIncompleteFn();
        if (cancelled) return;

        if (ids.length > 0) {
          const CHUNK = 10;
          let done = 0;
          for (let i = 0; i < ids.length; i += CHUNK) {
            if (cancelled) return;
            const chunk = ids.slice(i, i + CHUNK);
            setImportLabel(`Generating QR codes… ${done} / ${ids.length}`);
            await bulkCompleteFn({ data: { productIds: chunk } });
            done += chunk.length;
            setImportProgress(45 + Math.round((done / ids.length) * 55));
          }
        } else {
          setImportProgress(100);
        }
        if (cancelled) return;

        setImportLabel("All done — your products are ready.");
        setResult({ created: commitRes.created, updated: commitRes.updated });
        await sleep(500);
        if (!cancelled) setStep("customerFile");
      } catch {
        if (!cancelled)
          toast.error("We hit a snag getting your products ready — please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, rows]);

  // Same real-progress approach as the product import above.
  useEffect(() => {
    if (step !== "customerImporting" || customerRows.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        setCustomerImportProgress(20);
        setCustomerImportLabel(
          `Importing ${customerRows.length} customer${customerRows.length === 1 ? "" : "s"}…`,
        );
        const res = await customerCommitFn({ data: { rows: customerRows } });
        if (cancelled) return;
        setCustomerImportProgress(100);
        setCustomerImportLabel("All done — your customers are ready.");
        setCustomerResult({ created: res.created, updated: res.updated });
        await sleep(500);
        if (!cancelled) setStep("done");
      } catch {
        if (!cancelled) toast.error("We hit a snag importing your customers — please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, customerRows]);

  const handlePickSystem = (system: string) => {
    setPosSystem(system);
    savePosFn({ data: { posSystem: system } }).catch(() => {});
    setStep("connecting");
  };

  const handleFile = (f: File) => {
    setFile(f);
    preview.mutate(f);
  };

  const handleCustomerFile = (f: File) => {
    setCustomerFile(f);
    customerPreview.mutate(f);
  };

  const totalProducts = (result?.created ?? 0) + (result?.updated ?? 0);
  const totalCustomers = (customerResult?.created ?? 0) + (customerResult?.updated ?? 0);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex justify-center">
          <img src={heroLogo.url} alt="Tag" className="h-[9.6rem] w-auto object-contain" />
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
          {step === "importing" && <ImportingStep label={importLabel} progress={importProgress} />}
          {step === "customerFile" && (
            <CustomerFileStep
              inputRef={customerInputRef}
              file={customerFile}
              loading={customerPreview.isPending}
              posSystem={posSystem}
              onFile={handleCustomerFile}
              onSkip={() => setStep("done")}
            />
          )}
          {step === "customerImporting" && (
            <ImportingStep
              title="Getting your customers ready…"
              label={customerImportLabel}
              progress={customerImportProgress}
            />
          )}
          {step === "done" && (
            <DoneStep
              productCount={totalProducts}
              customerCount={totalCustomers}
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
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us set things up the right way for you.
        </p>
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
              <CommandItem
                key={system}
                value={system}
                onSelect={() => onPick(system)}
                className="cursor-pointer"
              >
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
      {loading && <p className="text-sm text-muted-foreground">Reading {file?.name}…</p>}
    </div>
  );
}

function CustomerFileStep({
  inputRef,
  file,
  loading,
  posSystem,
  onFile,
  onSkip,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  file: File | null;
  loading: boolean;
  posSystem: string | null;
  onFile: (f: File) => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-5 text-center">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Bring in your customers too</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posSystem
            ? `Export your customer list from ${posSystem} and upload it here — we'll map the columns automatically.`
            : "Upload your customer list — we'll map the columns automatically."}
        </p>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 hover:bg-muted/50">
        <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
        <span className="font-medium">Choose your customer file</span>
        <span className="mt-1 text-xs text-muted-foreground">XLSX or CSV</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>
      {loading && <p className="text-sm text-muted-foreground">Reading {file?.name}…</p>}
      <Button variant="ghost" className="w-full" onClick={onSkip} disabled={loading}>
        Skip for now
      </Button>
    </div>
  );
}

function ImportingStep({
  label,
  progress,
  title = "Getting your products ready…",
}: {
  label: string;
  progress: number;
  title?: string;
}) {
  return (
    <div className="space-y-6 py-4 text-center">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{label}</p>
      <Progress value={progress} className="mx-auto max-w-sm" />
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
      <span
        className={
          done || active ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"
        }
      >
        {label}
      </span>
    </div>
  );
}

function DoneStep({
  productCount,
  customerCount,
  onGoToDashboard,
}: {
  productCount: number;
  customerCount: number;
  onGoToDashboard: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <PartyPopper className="h-12 w-12 text-primary" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">You're all set!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {productCount.toLocaleString()} product{productCount === 1 ? "" : "s"}{" "}
          {productCount === 1 ? "is" : "are"} now ready on TAG.
          {customerCount > 0 && (
            <>
              {" "}
              {customerCount.toLocaleString()} customer{customerCount === 1 ? "" : "s"}{" "}
              {customerCount === 1 ? "was" : "were"} imported too.
            </>
          )}
        </p>
      </div>
      <Button size="lg" className="w-full" onClick={onGoToDashboard}>
        Go to Dashboard
      </Button>
    </div>
  );
}
