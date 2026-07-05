import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, FileJson, FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/customers/export")({
  head: () => ({
    meta: [
      { title: "Export Leads — Tag" },
      { name: "description", content: "Export your customer leads to CSV or Excel" },
    ],
  }),
  component: ExportLeadsPage,
});

function ExportLeadsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // TODO: Call backend to export
      alert("Export functionality coming soon");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Export Leads"
        description="Download your customer list as CSV or Excel file"
      />

      <Card>
        <CardHeader>
          <CardTitle>Download Options</CardTitle>
          <CardDescription>Choose format and filters for export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <Button onClick={() => handleExport()} disabled={isExporting} size="lg">
              <FileText className="w-4 h-4 mr-2" />
              {isExporting ? "Exporting..." : "Download CSV"}
            </Button>
            <Button variant="outline" size="lg" disabled>
              <FileJson className="w-4 h-4 mr-2" />
              Download Excel (Coming Soon)
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Export includes: phone number, opted-in date, segment tags, and engagement metrics
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
