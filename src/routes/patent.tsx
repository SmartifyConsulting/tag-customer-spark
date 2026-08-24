import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/patent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Patent Notice — Tag" },
      {
        name: "description",
        content: "The proprietary technology underlying the Tag platform.",
      },
    ],
  }),
  component: PatentPage,
});

function PatentPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Patent Notice</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 8 August 2026</p>
        <p className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          This is a plain-language summary of the proprietary technology developed for the Tag
          platform, prepared for transparency and IP record-keeping. It is not a substitute for
          an actual patent application or a freedom-to-operate opinion — have a registered
          patent attorney review these innovations, confirm novelty, and file the appropriate
          application(s) before relying on any patent claim. Application numbers, filing dates,
          and jurisdictions below are placeholders until a filing exists.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Ownership and Status</h2>
            <p>
              The systems and methods described below were conceived and developed by Smartify
              Consulting for the Tag platform. They are treated as confidential, proprietary
              trade secrets in the interim, and Smartify Consulting intends to seek formal patent
              protection for the eligible innovations.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Applicant / assignee: Smartify Consulting</li>
              <li>Application number: [to be inserted upon filing]</li>
              <li>Filing date: [to be inserted upon filing]</li>
              <li>Jurisdiction(s): [to be inserted upon filing — e.g. South Africa (CIPC), PCT]</li>
              <li>Status: Not yet filed — proprietary / confidential</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. The Unified Consumer TAG Identifier</h2>
            <p>
              A persistent, retailer-agnostic identifier ("TAG ID") issued to a shopper that links
              together, under a single QR/NFC-readable reference: in-store barcode scans, expressed
              purchase intent, completed purchases across one or more stores, digital receipts,
              warranty registrations, product returns, and after-sales service history — without
              requiring the shopper to create a traditional account before their first scan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. Intent-Capture and Scoring Method ("Follow Me")</h2>
            <p>
              A method by which a shopper scans a product's barcode in-store to register interest
              without completing a purchase, which triggers an automated, consent-based WhatsApp
              re-engagement flow. Scan recency, frequency, and message engagement are combined
              into a retailer-tunable 0–100 interest score used to prioritise which not-yet-converted
              shoppers a retailer follows up with.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Paperless Receipt-to-Ownership Linkage</h2>
            <p>
              A method of issuing a digital receipt that automatically and permanently links each
              purchased line item to its warranty period, return window, and any manufacturer
              documentation, retrievable later from the single TAG ID — replacing the need for a
              shopper to retain a paper receipt to prove purchase date, warranty eligibility, or
              return eligibility.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Derived Sustainability Quantification</h2>
            <p>
              A method of calculating environmental impact metrics (paper sheets, CO₂e, and water
              avoided) directly from the volume of digital receipts issued through the platform in
              place of paper receipts, presented to retailers as exportable ESG reporting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. No License Granted</h2>
            <p>
              Nothing on this page or elsewhere on the Tag platform grants any license, express or
              implied, to any patent, trade secret, or other intellectual property right of
              Smartify Consulting, except as set out in a separate written agreement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Contact Us</h2>
            <p>
              Questions about this notice or Smartify Consulting's intellectual property? Contact
              us at{" "}
              <a href="mailto:hello@tag-tech.co.za" className="font-medium text-foreground underline">
                hello@tag-tech.co.za
              </a>
              .
            </p>
          </section>
        </div>
      </article>
      <MarketingFooter />
    </div>
  );
}
