import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  productInputSchema,
  type ProductInput,
} from "@/lib/products.schemas";
import {
  createProduct,
  createProductImageUploadUrl,
  getProductFormOptions,
  setProductImages,
  updateProduct,
} from "@/lib/products.functions";

type Img = { url: string; path: string; sort: number };

export function ProductFormDialog({
  open,
  onOpenChange,
  initial,
  productId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Partial<ProductInput> & { id?: string };
  productId?: string;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createProduct);
  const update = useServerFn(updateProduct);
  const setImages = useServerFn(setProductImages);
  const createUploadUrl = useServerFn(createProductImageUploadUrl);
  const optsFn = useServerFn(getProductFormOptions);
  const { data: opts } = useQuery({
    queryKey: ["product-form-options"],
    queryFn: () => optsFn(),
    staleTime: 60_000,
  });

  const defaults = useMemo<ProductInput>(
    () => ({
      name: "",
      sku: "",
      brand: "",
      category_id: null,
      store_id: null,
      description: "",
      price_cents: 0,
      sale_price_cents: null,
      currency: "ZAR",
      stock_qty: 0,
      low_stock_threshold: 5,
      color: "",
      size: "",
      status: "active",
      promotion_start_date: null,
      promotion_end_date: null,
      images: [],
      ...(initial as any),
    }),
    [initial],
  );

  const form = useForm<ProductInput>({
    resolver: zodResolver(productInputSchema) as any,
    defaultValues: defaults,
  });


  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const [imgs, setImgs] = useState<Img[]>((initial?.images as Img[]) ?? []);
  useEffect(() => {
    if (open) setImgs((initial?.images as Img[]) ?? []);
  }, [open, initial]);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const next: Img[] = [...imgs];
      for (const file of Array.from(files)) {
        const { uploadUrl, publicUrl, path } = await createUploadUrl({
          data: {
            productId,
            filename: file.name,
            contentType: file.type || "image/jpeg",
          },
        });
        const put = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type || "image/jpeg" },
          body: file,
        });
        if (!put.ok) throw new Error("Upload failed");
        next.push({ url: publicUrl, path, sort: next.length });
      }
      setImgs(next);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeImg(i: number) {
    setImgs((prev) => prev.filter((_, idx) => idx !== i).map((m, idx) => ({ ...m, sort: idx })));
  }

  const save = useMutation({
    mutationFn: async (values: ProductInput) => {
      const payload = { ...values, images: imgs };
      if (productId) {
        await update({ data: { id: productId, patch: payload } });
        return productId;
      }
      const { id } = await create({ data: payload });
      if (imgs.length) await setImages({ data: { id, images: imgs } });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
      toast.success(productId ? "Product updated" : "Product created");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{productId ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Fields marked * are required.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((v) => save.mutate(v as ProductInput))}
          className="grid gap-4 py-2"
        >
          <Section title="Basics">
            <Field label="Product name *" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="SKU *" error={form.formState.errors.sku?.message}>
                <Input {...form.register("sku")} />
              </Field>
              <Field label="Brand"><Input {...form.register("brand")} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Category">
                <Select
                  value={form.watch("category_id") ?? "none"}
                  onValueChange={(v) =>
                    form.setValue("category_id", v === "none" ? null : v)
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {opts?.categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Store">
                <Select
                  value={form.watch("store_id") ?? "none"}
                  onValueChange={(v) =>
                    form.setValue("store_id", v === "none" ? null : v)
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {opts?.stores.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={3} {...form.register("description")} />
            </Field>
          </Section>

          <Section title="Pricing">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Price (cents) *">
                <Input
                  type="number"
                  min={0}
                  {...form.register("price_cents", { valueAsNumber: true })}
                />
              </Field>
              <Field label="Sale price (cents)">
                <Input
                  type="number"
                  min={0}
                  {...form.register("sale_price_cents", {
                    setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                  })}
                />
              </Field>
              <Field label="Currency">
                <Input maxLength={3} {...form.register("currency")} />
              </Field>
            </div>
          </Section>

          <Section title="Inventory & variants">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Quantity">
                <Input type="number" min={0} {...form.register("stock_qty", { valueAsNumber: true })} />
              </Field>
              <Field label="Low stock threshold">
                <Input type="number" min={0} {...form.register("low_stock_threshold", { valueAsNumber: true })} />
              </Field>
              <Field label="Colour"><Input {...form.register("color")} /></Field>
              <Field label="Size"><Input {...form.register("size")} /></Field>
            </div>
          </Section>

          <Section title="Promotion">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Promotion start">
                <Input
                  type="datetime-local"
                  onChange={(e) => form.setValue(
                    "promotion_start_date",
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )}
                  defaultValue={
                    initial?.promotion_start_date
                      ? new Date(initial.promotion_start_date).toISOString().slice(0, 16)
                      : ""
                  }
                />
              </Field>
              <Field label="Promotion end">
                <Input
                  type="datetime-local"
                  onChange={(e) => form.setValue(
                    "promotion_end_date",
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )}
                  defaultValue={
                    initial?.promotion_end_date
                      ? new Date(initial.promotion_end_date).toISOString().slice(0, 16)
                      : ""
                  }
                />
              </Field>
            </div>
          </Section>

          <Section title="Status">
            <Field label="Status">
              <Select
                value={form.watch("status")}
                onValueChange={(v: any) => form.setValue("status", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Section title="Images">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {imgs.map((img, i) => (
                <div key={img.path} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImg(i)}
                    className="absolute right-1 top-1 rounded-full bg-background/90 p-1 opacity-0 shadow-sm transition group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                      Primary
                    </span>
                  )}
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground transition hover:bg-muted">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                <span>{uploading ? "Uploading…" : "Add image"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </div>
          </Section>

          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
