import type { LucideIcon } from "lucide-react";
import { PageHeader } from "./page-header";
import { Card, CardContent } from "@/components/ui/card";

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  body,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  body: string;
}) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary">
            <Icon className="h-7 w-7" />
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{body}</p>
        </CardContent>
      </Card>
    </div>
  );
}
