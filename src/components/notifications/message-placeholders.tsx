import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const PLACEHOLDERS = [
  { id: "customer_name", label: "Customer Name", example: "John", color: "bg-blue-100" },
  { id: "store_name", label: "Store Name", example: "Your Store", color: "bg-green-100" },
  { id: "product_name", label: "Product Name", example: "Winter Coat", color: "bg-purple-100" },
  { id: "discount", label: "Discount %", example: "30%", color: "bg-red-100" },
  { id: "promo_code", label: "Promo Code", example: "TAG-2026-0705", color: "bg-yellow-100" },
  { id: "price", label: "Price", example: "R599", color: "bg-orange-100" },
  { id: "expiry", label: "Expiry Date", example: "July 10", color: "bg-pink-100" },
];

interface MessagePlaceholdersProps {
  onInsert: (placeholder: string) => void;
}

export function MessagePlaceholders({ onInsert }: MessagePlaceholdersProps) {
  const handleDragStart = (e: React.DragEvent, placeholder: typeof PLACEHOLDERS[0]) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", `{{${placeholder.id}}}`);
  };

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <CardTitle className="text-base">Field Placeholders</CardTitle>
        <CardDescription>Drag or click to add to message</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {PLACEHOLDERS.map((placeholder) => (
          <div
            key={placeholder.id}
            draggable
            onDragStart={(e) => handleDragStart(e, placeholder)}
            onClick={() => onInsert(`{{${placeholder.id}}} `)}
            className={`p-2 rounded cursor-move border-2 border-dashed ${placeholder.color} hover:opacity-80 transition`}
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">{placeholder.label}</p>
                <p className="text-xs text-gray-600">{placeholder.example}</p>
              </div>
              <Plus className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        ))}
        <div className="text-xs text-gray-500 mt-4 p-2 bg-gray-50 rounded">
          Drag placeholders into message or click to insert
        </div>
      </CardContent>
    </Card>
  );
}

export function getPreviewMessage(message: string): string {
  let preview = message;
  PLACEHOLDERS.forEach(placeholder => {
    preview = preview.replace(
      new RegExp(`{{${placeholder.id}}}`, 'g'),
      placeholder.example
    );
  });
  return preview;
}
