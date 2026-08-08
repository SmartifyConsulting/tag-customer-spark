import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader, MarketingFooter } from "@/components/marketing-page";

export const Route = createFileRoute("/popia")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "POPIA Notice — Tag" },
      {
        name: "description",
        content: "How Tag complies with South Africa's Protection of Personal Information Act.",
      },
    ],
  }),
  component: PopiaPage,
});

function PopiaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">POPIA Notice</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 8 August 2026</p>
        <p className="mt-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
          This is a standard template covering the sections South Africa's Protection of
          Personal Information Act (POPIA) typically requires of a "responsible party." It has
          not been reviewed by a lawyer — have it checked against your specific data flows
          before relying on it, and fill in the Information Officer's registered details below.
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground">1. Purpose of This Notice</h2>
            <p>
              This POPIA Notice supplements our{" "}
              <a href="/privacy" className="font-medium text-foreground underline">
                Privacy Policy
              </a>{" "}
              and explains specifically how Smartify Consulting, trading as Tag ("Tag", "we",
              "us", "our"), complies with the Protection of Personal Information Act 4 of 2013
              ("POPIA") as the responsible party for personal information processed through the
              Tag platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">2. Information Officer</h2>
            <p>
              Our Information Officer, as required by POPIA, is registered with the Information
              Regulator and can be contacted at:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Name: [Information Officer Name]</li>
              <li>
                Email:{" "}
                <a href="mailto:privacy@tag-tech.co.za" className="font-medium text-foreground underline">
                  privacy@tag-tech.co.za
                </a>
              </li>
              <li>Registered address: [Registered Business Address]</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">3. The Eight Conditions for Lawful Processing</h2>
            <p>We process personal information in line with POPIA's eight conditions:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Accountability</strong> — we take
                responsibility for meeting these conditions across our own processing and that of
                our operators (service providers).
              </li>
              <li>
                <strong className="text-foreground">Processing limitation</strong> — we only
                process what's necessary, lawfully, and with the data subject's consent or
                another justification recognised by POPIA (e.g. performance of a contract,
                legitimate interest, or legal obligation).
              </li>
              <li>
                <strong className="text-foreground">Purpose specification</strong> — information
                is collected for specific, explicitly defined purposes described in our{" "}
                <a href="/privacy" className="font-medium text-foreground underline">
                  Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong className="text-foreground">Further processing limitation</strong> — we
                don't process information in a manner incompatible with the purpose it was
                collected for.
              </li>
              <li>
                <strong className="text-foreground">Information quality</strong> — we take
                reasonable steps to keep personal information accurate, complete, and up to date.
              </li>
              <li>
                <strong className="text-foreground">Openness</strong> — this notice, our Privacy
                Policy, and our Information Officer's contact details are published and kept
                current.
              </li>
              <li>
                <strong className="text-foreground">Security safeguards</strong> — we use
                encryption in transit, role-based access controls, and row-level database
                security to protect personal information against loss, unauthorised access, and
                unlawful processing.
              </li>
              <li>
                <strong className="text-foreground">Data subject participation</strong> — data
                subjects may request access to, correction of, or deletion of their personal
                information, as set out below.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">4. Your Rights as a Data Subject</h2>
            <p>Under POPIA, you have the right to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Be notified that your personal information is being collected;</li>
              <li>Access the personal information we hold about you;</li>
              <li>Request correction or deletion of inaccurate, outdated, or unlawfully processed information;</li>
              <li>Object, on reasonable grounds, to the processing of your personal information;</li>
              <li>Withdraw consent (e.g. for WhatsApp messages) at any time, without affecting processing that already took place; and</li>
              <li>Lodge a complaint with the Information Regulator (contact details below) if you believe we've processed your information unlawfully.</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact our Information Officer using the details
              in section 2. We'll respond within the timeframes POPIA requires.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">5. Special Personal Information</h2>
            <p>
              Tag does not intentionally collect special personal information (e.g. religious
              beliefs, health, biometric, or criminal history data) from Retailers or End
              Customers. If a Retailer uploads such information as part of product or customer
              records, they are responsible for having a lawful basis to do so.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">6. Direct Marketing</h2>
            <p>
              Where WhatsApp messages or other direct marketing communications are sent to an End
              Customer, this only happens with that person's prior opt-in consent, and every
              message provides a clear way to opt out, as required by section 69 of POPIA.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">7. Cross-Border Transfers</h2>
            <p>
              Some of our infrastructure providers operate outside South Africa. Where personal
              information is transferred across borders, we ensure the recipient is subject to
              laws, binding agreements, or other measures that provide an adequate and comparable
              level of protection to POPIA, as required by section 72.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">8. Complaints to the Information Regulator</h2>
            <p>
              If you're not satisfied with how we've handled your personal information, you may
              lodge a complaint with South Africa's Information Regulator:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Website:{" "}
                <a
                  href="https://inforegulator.org.za"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline"
                >
                  inforegulator.org.za
                </a>
              </li>
              <li>
                Email:{" "}
                <a href="mailto:complaints.IR@justice.gov.za" className="font-medium text-foreground underline">
                  complaints.IR@justice.gov.za
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground">9. Contact Us</h2>
            <p>
              Questions about this POPIA Notice? Contact our Information Officer at{" "}
              <a href="mailto:privacy@tag-tech.co.za" className="font-medium text-foreground underline">
                privacy@tag-tech.co.za
              </a>
              . See also our{" "}
              <a href="/privacy" className="font-medium text-foreground underline">
                Privacy Policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="font-medium text-foreground underline">
                Terms and Conditions
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
