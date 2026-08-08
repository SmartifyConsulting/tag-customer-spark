import { Card, CardContent } from "@/components/ui/card";
import { ReceiptText } from "lucide-react";

export function ReceiptsDisabled() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <ReceiptText className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Receipts is currently unavailable</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This feature has been temporarily switched off. Please check back later.
        </p>
      </CardContent>
    </Card>
  );
}
