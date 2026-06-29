import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";

export type ProductsToolbarValue = {
  search: string;
  status: "all" | "active" | "draft" | "archived";
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
    <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Search name, SKU or brand…"
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={value.status} onValueChange={(v: any) => onChange({ status: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={value.category_id ?? "all"}
          onValueChange={(v) => onChange({ category_id: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select
          value={value.store_id ?? "all"}
          onValueChange={(v) => onChange({ store_id: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Store" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stores</SelectItem>
            {stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Toggle pressed={value.promotion} onPressedChange={(p) => onChange({ promotion: p })}>
          On promo
        </Toggle>
        <Toggle pressed={value.low_stock} onPressedChange={(p) => onChange({ low_stock: p })}>
          Low stock
        </Toggle>
        <Select value={value.sort} onValueChange={(v: any) => onChange({ sort: v })}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
            <SelectItem value="price">Lowest price</SelectItem>
            <SelectItem value="stock">Lowest stock</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
