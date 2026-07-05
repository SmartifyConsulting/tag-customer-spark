import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProductsToolbarValue = {
  search: string;
  showArchived: boolean;
  category_id: string | null;
  store_id: string | null;
  promotion: boolean;
  low_stock: boolean;
  sort: "recent" | "name" | "price" | "stock";
};

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
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search products…"
          className="h-11 rounded-xl border-border bg-card pl-10 text-sm"
        />
      </div>

      <Select
        value={value.category_id ?? "all"}
        onValueChange={(v) => onChange({ category_id: v === "all" ? null : v })}
      >
        <SelectTrigger className="h-11 w-[170px] rounded-xl border-border bg-card text-sm font-medium">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.store_id ?? "all"}
        onValueChange={(v) => onChange({ store_id: v === "all" ? null : v })}
      >
        <SelectTrigger className="h-11 w-[150px] rounded-xl border-border bg-card text-sm font-medium">
          <SelectValue placeholder="All Stores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stores</SelectItem>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <label className="flex h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium">
        <Switch
          checked={value.showArchived}
          onCheckedChange={(v) => onChange({ showArchived: v })}
          aria-label="Show archived"
        />
        <Label className="cursor-pointer">Show archived</Label>
      </label>
    </div>
  );
}
