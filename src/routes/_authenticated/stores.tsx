import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StoresView } from "@/components/stores/stores-view";

// The Stores page is now primarily served through the /admin?tab=stores
// tab, but keep this top-level route working so existing bookmarks and
// links (staff on-boarding emails, search hits) still land somewhere.
export const Route = createFileRoute("/_authenticated/stores")({
  head: () => ({ meta: [{ title: "Stores — Tag" }] }),
  component: StoresPage,
});

function StoresPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Stores" description="Every physical retail location using Tag." />
      <StoresView />
    </div>
  );
}
