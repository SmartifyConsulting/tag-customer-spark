import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
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
  bulkGenerateQrAndImages,
  listIncompleteDigitalIdentityIds,
} from "@/lib/products.functions";
import { bulkReenrichPassports } from "@/lib/passport.functions";
import { assignMissingBarcodes } from "@/lib/barcode-assign.functions";
import {
  previewCustomerImport,
  commitCustomerImport,
  type CustomerImportRow,
} from "@/lib/customer-import.functions";
import {
  previewStoreImport,
  commitStoreImport,
  type StoreImportRow,
} from "@/lib/stores-import.functions";
import { saveRetailerPosSystem } from "@/lib/settings.functions";
import { TagLogo } from "@/components/tag-logo";

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
  | "storeFile"
  | "storeImporting"
  | "done";

// Steps a person can land the Back button on — i.e. every real screen
// they actively looked at. Ephemeral/auto-advancing steps (connecting,
// *Importing) are excluded from the history push below, so Back always
// lands on the last screen the person actually chose, not mid-animation.
const EPHEMERAL_STEPS: Step[] = ["connecting", "importing", "customerImporting", "storeImporting"];
const BACK_BUTTON_STEPS: Step[] = ["system", "file", "customerFile", "storeFile"];

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [history, setHistory] = useState<Step[]>([]);

  // Wraps setStep so leaving a real (non-ephemeral) screen remembers it,
  // enabling a real Back button instead of browser history hacks.
  const goTo = (next: Step) => {
    setHistory((h) => (EPHEMERAL_STEPS.includes(step) ? h : [...h, step]));
    setStep(next);
  };
  const goBack = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setStep(prev);
      return h.slice(0, -1);
    });
  };
  const canGoBack = BACK_BUTTON_STEPS.includes(step) && history.length > 0;
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

  const [storeFile, setStoreFile] = useState<File | null>(null);
  const [storeRows, setStoreRows] = useState<StoreImportRow[]>([]);
  const [storeResult, setStoreResult] = useState<{ created: number; updated: number } | null>(null);
  const [storeImportLabel, setStoreImportLabel] = useState("");
  const [storeImportProgress, setStoreImportProgress] = useState(0);
  const storeInputRef = useRef<HTMLInputElement>(null);

  const savePosFn = useServerFn(saveRetailerPosSystem);
  const previewFn = useServerFn(previewProductImport);
  const commitFn = useServerFn(commitProductImport);
  const assignBarcodesFn = useServerFn(assignMissingBarcodes);
  const listIncompleteFn = useServerFn(listIncompleteDigitalIdentityIds);
  const bulkQrImagesFn = useServerFn(bulkGenerateQrAndImages);
  const bulkEnrichFn = useServerFn(bulkReenrichPassports);
  const customerPreviewFn = useServerFn(previewCustomerImport);
  const customerCommitFn = useServerFn(commitCustomerImport);
  const storePreviewFn = useServerFn(previewStoreImport);
  const storeCommitFn = useServerFn(commitStoreImport);

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
      goTo("importing");
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
      goTo("customerImporting");
    },
    onError: () => toast.error("That file didn't come through — please try another export."),
  });

  const storePreview = useMutation({
    mutationFn: async (f: File) => {
      const base64 = await fileToBase64(f);
      return storePreviewFn({
        data: { filename: f.name, mime: f.type || "application/octet-stream", base64 },
      });
    },
    onSuccess: (res) => {
      if (!res.rows.length) {
        toast.warning("We couldn't find any stores/branches in that file.");
        return;
      }
      setStoreRows(res.rows);
      goTo("storeImporting");
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
      if (!cancelled) goTo("file");
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

    // Four honest, distinct phases instead of one opaque "importing" step —
    // each does genuinely different (and separately network/AI-bound) work,
    // so labelling them separately both tells the truth about what's
    // happening and gives the progress bar something to visibly move on
    // every few products instead of appearing frozen for minutes on a
    // single big request.
    (async () => {
      try {
        let created = 0;
        let updated = 0;
        const DESC_CHUNK = 5;
        setImportProgress(2);
        for (let i = 0; i < rows.length; i += DESC_CHUNK) {
          if (cancelled) return;
          const chunk = rows.slice(i, i + DESC_CHUNK);
          const done = Math.min(i + chunk.length, rows.length);
          setImportLabel(`Importing product descriptions… ${done} / ${rows.length}`);
          const res = await commitFn({ data: { rows: chunk } });
          created += res.created;
          updated += res.updated;
          setImportProgress(2 + Math.round((done / rows.length) * 20));
        }
        if (cancelled) return;
        setImportProgress(22);

        setImportLabel("Importing barcodes…");
        await assignBarcodesFn();
        if (cancelled) return;
        setImportProgress(30);

        const { ids } = await listIncompleteFn();
        if (cancelled) return;

        if (ids.length > 0) {
          const CHUNK = 5;
          let done = 0;
          for (let i = 0; i < ids.length; i += CHUNK) {
            if (cancelled) return;
            const chunk = ids.slice(i, i + CHUNK);
            setImportLabel(`Converting to QR codes… ${done} / ${ids.length}`);
            await bulkQrImagesFn({ data: { productIds: chunk } });
            done += chunk.length;
            setImportProgress(30 + Math.round((done / ids.length) * 40));
          }
        }
        if (cancelled) return;
        setImportProgress(70);

        const { ids: needEnrich } = await listIncompleteFn();
        if (cancelled) return;

        if (needEnrich.length > 0) {
          const CHUNK = 5;
          let done = 0;
          for (let i = 0; i < needEnrich.length; i += CHUNK) {
            if (cancelled) return;
            const chunk = needEnrich.slice(i, i + CHUNK);
            setImportLabel(`Enhancing intelligence… ${done} / ${needEnrich.length}`);
            await bulkEnrichFn({ data: { productIds: chunk } });
            done += chunk.length;
            setImportProgress(70 + Math.round((done / needEnrich.length) * 30));
          }
        } else {
          setImportProgress(100);
        }
        if (cancelled) return;

        setImportLabel("All done — your products are ready.");
        setResult({ created, updated });
        await sleep(500);
        if (!cancelled) goTo("customerFile");
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
        if (!cancelled) goTo("storeFile");
      } catch {
        if (!cancelled) toast.error("We hit a snag importing your customers — please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, customerRows]);

  // Same real-progress approach as the product/customer imports above.
  useEffect(() => {
    if (step !== "storeImporting" || storeRows.length === 0) return;
    let cancelled = false;

    (async () => {
      try {
        setStoreImportProgress(20);
        setStoreImportLabel(
          `Importing ${storeRows.length} store${storeRows.length === 1 ? "" : "s"}…`,
        );
        const res = await storeCommitFn({ data: { rows: storeRows } });
        if (cancelled) return;
        setStoreImportProgress(100);
        const total = res.created + res.updated;
        if (total === 0 && res.errors.length > 0) {
          // Every row failed — surface it instead of quietly moving on
          // (e.g. a schema column the file needs isn't deployed yet).
          console.warn("Store import errors:", res.errors);
          toast.error(
            `None of your ${storeRows.length} stores could be saved — ${res.errors[0]}${res.errors.length > 1 ? ` (+${res.errors.length - 1} more)` : ""}`,
          );
        } else if (res.errors.length > 0) {
          console.warn("Store import errors:", res.errors);
          toast.warning(`${total} store${total === 1 ? "" : "s"} saved, ${res.errors.length} had issues.`);
        }
        setStoreImportLabel("All done — your stores are ready.");
        setStoreResult({ created: res.created, updated: res.updated });
        await sleep(500);
        if (!cancelled) goTo("done");
      } catch {
        if (!cancelled) toast.error("We hit a snag importing your stores — please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, storeRows]);

  const handlePickSystem = (system: string) => {
    setPosSystem(system);
    savePosFn({ data: { posSystem: system } }).catch(() => {});
    goTo("connecting");
  };

  const handleFile = (f: File) => {
    setFile(f);
    preview.mutate(f);
  };

  const handleCustomerFile = (f: File) => {
    setCustomerFile(f);
    customerPreview.mutate(f);
  };

  const handleStoreFile = (f: File) => {
    setStoreFile(f);
    storePreview.mutate(f);
  };

  const totalProducts = (result?.created ?? 0) + (result?.updated ?? 0);
  const totalCustomers = (customerResult?.created ?? 0) + (customerResult?.updated ?? 0);
  const totalStores = (storeResult?.created ?? 0) + (storeResult?.updated ?? 0);

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      {/* Header with top-left logo */}
      <header className="border-b border-border/20 px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-7xl">
          <Link to="/dashboard" className="shrink-0">
            <TagLogo variant="wordmark" size="sm" />
          </Link>
        </div>
      </header>

      {/* Main content - centered card */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <Card className="rounded-2xl border-border/60 p-8 shadow-sm">
          {canGoBack && (
            <button
              type="button"
              onClick={goBack}
              className="mb-4 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          )}
          {step === "welcome" && <WelcomeStep onNext={() => goTo("system")} />}
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
              onSkip={() => goTo("storeFile")}
            />
          )}
          {step === "customerImporting" && (
            <ImportingStep
              title="Getting your customers ready…"
              label={customerImportLabel}
              progress={customerImportProgress}
            />
          )}
          {step === "storeFile" && (
            <StoreFileStep
              inputRef={storeInputRef}
              file={storeFile}
              loading={storePreview.isPending}
              posSystem={posSystem}
              onFile={handleStoreFile}
              onSkip={() => goTo("done")}
            />
          )}
          {step === "storeImporting" && (
            <ImportingStep
              title="Getting your stores ready…"
              label={storeImportLabel}
              progress={storeImportProgress}
            />
          )}
          {step === "done" && (
            <DoneStep
              productCount={totalProducts}
              customerCount={totalCustomers}
              storeCount={totalStores}
              onGoToDashboard={() => navigate({ to: "/dashboard" })}
            />
          )}
        </Card>
        </div>
      </main>
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

function StoreFileStep({
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
        <h1 className="text-xl font-bold tracking-tight">Add your store branches</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {posSystem
            ? `If ${posSystem} manages more than one branch, export your store/branch list and upload it here.`
            : "If you have more than one branch, upload your store/branch list — we'll map the columns automatically."}
        </p>
      </div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/30 p-10 hover:bg-muted/50">
        <FileUp className="mb-3 h-8 w-8 text-muted-foreground" />
        <span className="font-medium">Choose your store file</span>
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
  storeCount,
  onGoToDashboard,
}: {
  productCount: number;
  customerCount: number;
  storeCount: number;
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
          {storeCount > 0 && (
            <>
              {" "}
              {storeCount.toLocaleString()} store{storeCount === 1 ? "" : "s"}{" "}
              {storeCount === 1 ? "was" : "were"} set up too.
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
