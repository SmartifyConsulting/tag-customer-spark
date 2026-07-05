import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const PLACEHOLDERS = [
  { id: "customer_name", label: "Customer Name", example: "John", color: "bg-blue-100 dark:bg-blue-950/40" },
  { id: "store_name", label: "Store Name", example: "Your Store", color: "bg-green-100 dark:bg-green-950/40" },
  { id: "product", label: "Product Name", example: "Winter Coat", color: "bg-purple-100 dark:bg-purple-950/40" },
  { id: "discount", label: "Discount %", example: "30%", color: "bg-red-100 dark:bg-red-950/40" },
  { id: "code", label: "Promo Code", example: "TAG-2026-0705", color: "bg-yellow-100 dark:bg-yellow-950/40" },
  { id: "price", label: "Price", example: "R599", color: "bg-orange-100 dark:bg-orange-950/40" },
  { id: "expiry", label: "Expiry Date", example: "July 10", color: "bg-pink-100 dark:bg-pink-950/40" },
];

interface MessagePlaceholdersProps {
  onInsert: (placeholder: string) => void;
}

export function MessagePlaceholders({ onInsert }: MessagePlaceholdersProps) {
  const handleDragStart = (e: React.DragEvent, placeholder: typeof PLACEHOLDERS[0]) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", `{${placeholder.id}}`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Field placeholders</CardTitle>
        <CardDescription>Drag into the headline or body, or click to insert.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {PLACEHOLDERS.map((placeholder) => (
          <div
            key={placeholder.id}
            draggable
            onDragStart={(e) => handleDragStart(e, placeholder)}
            onClick={() => onInsert(`{${placeholder.id}}`)}
            className={`p-2 rounded cursor-move border-2 border-dashed ${placeholder.color} hover:opacity-80 transition`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">{placeholder.label}</p>
                <p className="text-xs text-muted-foreground">{placeholder.example}</p>
              </div>
              <Plus className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function getPreviewMessage(message: string): string {
  let preview = message;
  PLACEHOLDERS.forEach(placeholder => {
    preview = preview.replace(
      new RegExp(`{${placeholder.id}}`, 'g'),
      placeholder.example
    );
  });
  return preview;
}
