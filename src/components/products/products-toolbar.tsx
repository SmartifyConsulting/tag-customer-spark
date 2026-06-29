import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export type ProductsToolbarValue = {
  search: string;
  status: "all" | "active" | "draft" | "archived";
  category_id: string | null;
  store_id: string | null;
  promotion: boolean;
  low_stock: boolean;
  sort: "recent" | "name" | "price" | "stock";
};

const PILL =
  "h-10 rounded-full border-border bg-background px-4 text-sm font-medium hover:bg-accent/40 transition-colors data-[placeholder]:text-muted-foreground [&>svg]:hidden";

function PillSelect({
  value,
  onValueChange,
  placeholder,
  children,
  className = "",
}: any) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`${PILL} ${className} gap-1.5`}>
        <SelectValue placeholder={placeholder} />
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </SelectTrigger>
      <SelectContent className="rounded-xl">{children}</SelectContent>
    </Select>
  );
}

export function ProductsToolbar({
  value,
  onChange,
  categories,
  stores,
}: {
  value: ProductsToolbarValue;
  onChange: (next: Partial<ProductsToolbarValue>) => void;
  categories: { id: string; name: string }[];
  stores: { id: string; name: string }[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Search products, SKU, brand…"
            className="h-10 rounded-full border-border bg-background pl-10 text-sm"
          />
        </div>

        <PillSelect
          value={value.status}
          onValueChange={(v: any) => onChange({ status: v })}
          className="min-w-[130px]"
        >
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </PillSelect>

        <PillSelect
          value={value.category_id ?? "all"}
          onValueChange={(v: string) => onChange({ category_id: v === "all" ? null : v })}
          placeholder="Category"
          className="min-w-[150px]"
        >
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </PillSelect>

        <PillSelect
          value={value.store_id ?? "all"}
          onValueChange={(v: string) => onChange({ store_id: v === "all" ? null : v })}
          placeholder="Store"
          className="min-w-[130px]"
        >
          <SelectItem value="all">All stores</SelectItem>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </PillSelect>

        <PillSelect
          value={value.sort}
          onValueChange={(v: any) => onChange({ sort: v })}
          className="min-w-[140px]"
        >
          <SelectItem value="recent">Most recent</SelectItem>
          <SelectItem value="name">Name A–Z</SelectItem>
          <SelectItem value="price">Lowest price</SelectItem>
          <SelectItem value="stock">Lowest stock</SelectItem>
        </PillSelect>

        <div className="ml-auto flex items-center gap-3 rounded-full border border-border bg-muted/40 px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Switch
              id="promo-toggle"
              checked={value.promotion}
              onCheckedChange={(p) => onChange({ promotion: p })}
              className="data-[state=checked]:bg-[color:var(--mint)]"
            />
            <Label htmlFor="promo-toggle" className="cursor-pointer text-xs font-medium">
              On promo
            </Label>
          </div>
          <span className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Switch
              id="low-toggle"
              checked={value.low_stock}
              onCheckedChange={(p) => onChange({ low_stock: p })}
              className="data-[state=checked]:bg-[color:var(--warning)]"
            />
            <Label htmlFor="low-toggle" className="cursor-pointer text-xs font-medium">
              Low stock
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
