import { createFileRoute, redirect } from "@tanstack/react-router";

// Keep existing printed QR codes and saved links working with multi-scan.
export const Route = createFileRoute("/tools/barcode-reader")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/shop" });
  },
  head: () => ({
    meta: [
      { title: "TAG Barcode Reader — TAG as you shop" },
      { name: "description", content: "Scan products and follow your TAG list on WhatsApp." },
      { property: "og:title", content: "TAG Barcode Reader" },
      { property: "og:description", content: "Scan products and follow your TAG list on WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});